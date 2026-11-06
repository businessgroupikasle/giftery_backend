import { Prisma } from '@prisma/client';
import prisma from '../config/db.js';
import { HTTP_STATUS } from '../shared/constants/httpStatus.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { deleteArtwork } from './artworkStorage.js';
import { createDesignSchema, updateDesignSchema, reviewStatusSchema } from '../validations/customizationValidation.js';

const STAFF_ROLES = ['ADMIN', 'SUPER_ADMIN', 'STORE_ADMIN'];
const MAX_DESIGNS_PER_USER = 200;
const UNSAVED_MESSAGE = 'Save the current customization and preview before adding it to your cart';
const CONFLICT_MESSAGE = 'This design was changed in another tab or device. Reload to continue.';
const LIMIT_MESSAGE = 'You have reached the saved design limit. Delete an old design to continue.';

const fail = (message, statusCode = HTTP_STATUS.BAD_REQUEST) => Object.assign(new Error(message), { statusCode });

const parseOrFail = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw fail(`Invalid customization: ${[issue?.path.join('.'), issue?.message].filter(Boolean).join(' ')}`);
  }
  return result.data;
};

export const DEFAULT_CUSTOMIZATION_CONFIG = Object.freeze({
  enabled: true,
  tools: { uploads: true, text: true, stickers: true, graphics: true, templates: true, background: true },
  variants: { sizes: [], colors: [], materials: [] },
  chargePerUnit: 0,
});

/** Products without an explicit configuration can be customized with every tool, no options and no charge. */
export function resolveCustomizationConfig(product) {
  const config = product?.customizationConfig;
  if (!config || typeof config !== 'object') return DEFAULT_CUSTOMIZATION_CONFIG;
  return {
    enabled: config.enabled !== false,
    tools: { ...DEFAULT_CUSTOMIZATION_CONFIG.tools, ...config.tools },
    variants: { ...DEFAULT_CUSTOMIZATION_CONFIG.variants, ...config.variants },
    chargePerUnit: Number.isFinite(config.chargePerUnit) && config.chargePerUnit > 0 ? config.chargePerUnit : 0,
  };
}

export const customizationCharge = (product, isCustomized) => (isCustomized ? resolveCustomizationConfig(product).chargePerUnit : 0);

export const designAssetIds = (design, instructions) => {
  const ids = new Set();
  for (const element of design?.elements || []) if (element.assetId) ids.add(element.assetId);
  if (design?.background?.imageAssetId) ids.add(design.background.imageAssetId);
  if (design?.imageAssetId) ids.add(design.imageAssetId); // version 1 designs
  for (const id of instructions?.referenceAssetIds || []) ids.add(id);
  return [...ids];
};

const snapshotAssetIds = (snapshot) => {
  const ids = [snapshot?.imageAssetId, snapshot?.previewAssetId, ...(Array.isArray(snapshot?.assetIds) ? snapshot.assetIds : [])];
  return [...new Set(ids.filter((id) => id != null))];
};

const referencesAsset = (assetId) => [
  { customization: { path: ['assetIds'], array_contains: [assetId] } },
  { customization: { path: ['imageAssetId'], equals: assetId } },
  { customization: { path: ['previewAssetId'], equals: assetId } },
];

export async function canReadArtwork(user, asset) {
  if (asset.userId === user.id) return true;
  if (!STAFF_ROLES.includes(user.role)) return false;
  return Boolean(await prisma.orderItem.findFirst({ where: { order: { userId: asset.userId }, OR: referencesAsset(asset.id) }, select: { id: true } }));
}

/** Confirms a stored cart or order snapshot only references files owned by this customer. */
export async function validateSnapshotAssets(userId, snapshot, db = prisma) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw fail('Invalid customization');
  const ids = snapshotAssetIds(snapshot);
  if (ids.some((id) => typeof id !== 'string' || !id || id.length > 100)) throw fail('Invalid customization asset');
  if (!snapshot.previewAssetId) throw fail(UNSAVED_MESSAGE);
  if (await db.customizationAsset.count({ where: { userId, id: { in: ids } } }) !== ids.length) throw fail('Customization asset not found');
  return snapshot;
}

async function assertAssetsOwned(userId, ids, db) {
  if (ids.length && await db.customizationAsset.count({ where: { userId, id: { in: ids } } }) !== ids.length) {
    throw fail('Customization asset not found');
  }
}

export const variantIdFrom = (options) => {
  const parts = ['size', 'color', 'material'].filter((key) => options?.[key]).map((key) => `${key}=${options[key]}`);
  return parts.length ? parts.join(';') : null;
};

const OPTION_LISTS = [['size', 'sizes'], ['color', 'colors'], ['material', 'materials']];
const ELEMENT_TOOL = { logo: 'uploads', graphic: 'graphics', shape: 'graphics', sticker: 'stickers', text: 'text' };

function assertSupportedByProduct(product, config, input) {
  if (!product || product.isActive === false) throw fail('Product not found', HTTP_STATUS.NOT_FOUND);
  if (!config.enabled) throw fail('This product cannot be customized');
  for (const [key, list] of OPTION_LISTS) {
    if (input.options[key] && !config.variants[list].includes(input.options[key])) throw fail(`The selected ${key} is not available for this product`);
  }
  const images = (product.images || []).map((image) => String(image).trim());
  if (input.design.productImage && !images.includes(input.design.productImage)) throw fail('The selected image does not belong to this product');
  for (const element of input.design.elements) {
    if (!config.tools[ELEMENT_TOOL[element.type]]) throw fail(`This product does not support ${ELEMENT_TOOL[element.type]}`);
  }
  const background = input.design.background;
  if (!config.tools.background && (background.color || background.imageAssetId || background.pattern || background.borderStyle !== 'none')) {
    throw fail('This product does not support background options');
  }
}

async function loadProduct(db, productId) {
  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true, isActive: true, images: true, customizationConfig: true } });
  return { product, config: resolveCustomizationConfig(product) };
}

const designData = (input) => ({
  name: input.name,
  quantity: input.quantity,
  options: input.options,
  variantId: variantIdFrom(input.options),
  design: input.design,
  instructions: input.instructions,
  assetIds: designAssetIds(input.design, input.instructions),
});

/** The immutable copy of a saved design that travels with cart lines and order items. */
export async function buildSnapshot(db, row) {
  const design = row.design && typeof row.design === 'object' ? row.design : {};
  const assetIds = [...new Set([...(row.assetIds || []), ...designAssetIds(design, row.instructions)])];
  const assets = assetIds.length ? await db.customizationAsset.findMany({
    where: { id: { in: assetIds }, userId: row.userId },
    select: { id: true, kind: true, originalName: true, mimeType: true, width: true, height: true, sourceStorageKey: true },
  }) : [];
  return {
    ...design,
    version: design.version ?? 2,
    customizationId: row.id,
    name: row.name,
    productId: row.productId,
    variantId: row.variantId,
    options: row.options || {},
    instructions: row.instructions || null,
    previewAssetId: row.previewAssetId,
    previewInfo: row.previewInfo || null,
    assetIds,
    assets: assets.map(({ sourceStorageKey, ...asset }) => ({ ...asset, hasVectorSource: Boolean(sourceStorageKey) })),
  };
}

/** Loads a design the customer may purchase; anything unsaved or belonging to someone else is refused. */
export async function loadPurchasableDesign(userId, productId, customizationId, db = prisma) {
  const row = await db.customizationDesign.findFirst({ where: { id: customizationId, userId } });
  if (!row) throw fail('Customization not found');
  if (row.productId !== productId) throw fail('This customization belongs to a different product');
  if (row.status === 'DRAFT' || !row.previewAssetId) throw fail(UNSAVED_MESSAGE);
  const snapshot = await buildSnapshot(db, row);
  return validateSnapshotAssets(userId, snapshot, db);
}

const designSummarySelect = {
  id: true, productId: true, name: true, variantId: true, options: true, quantity: true, previewAssetId: true, status: true, revision: true, createdAt: true, updatedAt: true,
  product: { select: { id: true, name: true, slug: true, price: true, images: true, stock: true, customizationConfig: true } },
};

export async function assetInUse(userId, assetId, db = prisma) {
  const [designs, cartLines, orderLines] = await Promise.all([
    db.customizationDesign.count({ where: { userId, OR: [{ assetIds: { has: assetId } }, { previewAssetId: assetId }] } }),
    db.cartItem.count({ where: { cart: { userId }, OR: referencesAsset(assetId) } }),
    db.orderItem.count({ where: { order: { userId }, OR: referencesAsset(assetId) } }),
  ]);
  return designs + cartLines + orderLines > 0;
}

async function deleteAssetRecord(userId, assetId) {
  const asset = await prisma.customizationAsset.findFirst({ where: { id: assetId, userId } });
  if (!asset) return;
  await prisma.customizationAsset.delete({ where: { id: asset.id } });
  await deleteArtwork(asset.storageKey);
  if (asset.sourceStorageKey) await deleteArtwork(asset.sourceStorageKey);
}

/** Deletes rendered previews nothing references any more. Cart and order snapshots keep theirs. */
async function removeUnusedPreview(userId, assetId) {
  if (assetId && !await assetInUse(userId, assetId)) await deleteAssetRecord(userId, assetId);
}

const assertBelowDesignLimit = async (userId, db) => {
  if (await db.customizationDesign.count({ where: { userId } }) >= MAX_DESIGNS_PER_USER) throw fail(LIMIT_MESSAGE, HTTP_STATUS.CONFLICT);
};

export const customizationService = {
  listAssets: (userId, kind) => prisma.customizationAsset.findMany({
    where: { userId, kind: kind || { not: 'PREVIEW' } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, kind: true, originalName: true, mimeType: true, width: true, height: true, size: true, createdAt: true },
  }),

  removeAsset: async (userId, assetId) => {
    const asset = await prisma.customizationAsset.findFirst({ where: { id: assetId, userId }, select: { id: true } });
    if (!asset) throw fail('Image not found', HTTP_STATUS.NOT_FOUND);
    if (await assetInUse(userId, assetId)) throw fail('This image is used by a saved design, cart item or order and cannot be deleted', HTTP_STATUS.CONFLICT);
    await deleteAssetRecord(userId, assetId);
  },

  listDesigns: async (userId, { productId, page, limit } = {}) => {
    const where = { userId, ...(productId ? { productId } : {}) };
    const total = await prisma.customizationDesign.count({ where });
    const meta = paginate(page, limit || 50, total);
    const rows = await prisma.customizationDesign.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: meta.skip, take: meta.take, select: designSummarySelect });
    return paginatedResponse(rows, meta);
  },

  getDesign: async (userId, id) => {
    const design = await prisma.customizationDesign.findFirst({ where: { id, userId } });
    if (!design) throw fail('Design not found', HTTP_STATUS.NOT_FOUND);
    return design;
  },

  createDesign: async (userId, body) => {
    const input = parseOrFail(createDesignSchema, body);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;
      const { product, config } = await loadProduct(tx, input.productId);
      assertSupportedByProduct(product, config, input);
      const data = designData(input);
      await assertAssetsOwned(userId, data.assetIds, tx);
      await assertBelowDesignLimit(userId, tx);
      return tx.customizationDesign.create({ data: { userId, productId: input.productId, ...data } });
    });
  },

  /** Autosave target. Edits leave cart lines untouched until the customer saves again. */
  updateDesign: async (userId, id, body) => {
    const input = parseOrFail(updateDesignSchema, body);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;
      const row = await tx.customizationDesign.findFirst({ where: { id, userId }, select: { id: true, productId: true, revision: true } });
      if (!row) throw fail('Design not found', HTTP_STATUS.NOT_FOUND);
      if (row.revision !== input.expectedRevision) throw fail(CONFLICT_MESSAGE, HTTP_STATUS.CONFLICT);
      const { product, config } = await loadProduct(tx, row.productId);
      assertSupportedByProduct(product, config, input);
      const data = designData(input);
      await assertAssetsOwned(userId, data.assetIds, tx);
      return tx.customizationDesign.update({ where: { id }, data: { ...data, status: 'DRAFT', revision: { increment: 1 } } });
    });
  },

  duplicateDesign: async (userId, id) => {
    const source = await customizationService.getDesign(userId, id);
    await assertBelowDesignLimit(userId, prisma);
    return prisma.customizationDesign.create({ data: {
      userId,
      productId: source.productId,
      name: `${source.name} (copy)`.slice(0, 80),
      quantity: source.quantity,
      options: source.options ?? Prisma.DbNull,
      variantId: source.variantId,
      design: source.design,
      instructions: source.instructions ?? Prisma.DbNull,
      assetIds: source.assetIds,
    } });
  },

  /** Uploaded artwork stays in the customer's library; only the rendered preview is cleaned up. */
  deleteDesign: async (userId, id) => {
    const row = await customizationService.getDesign(userId, id);
    await prisma.customizationDesign.delete({ where: { id: row.id } });
    await removeUnusedPreview(userId, row.previewAssetId);
  },

  /**
   * Marks a design as saved with its rendered preview and refreshes any cart line holding it,
   * so quantity changes, refreshes and checkout always see the latest saved version.
   */
  finalizeDesign: async (userId, id, expectedRevision, previewAssetId, previewInfo) => {
    const { saved, previousPreview } = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;
      const row = await tx.customizationDesign.findFirst({ where: { id, userId } });
      if (!row) throw fail('Design not found', HTTP_STATUS.NOT_FOUND);
      if (row.revision !== expectedRevision) throw fail(CONFLICT_MESSAGE, HTTP_STATUS.CONFLICT);
      const { product, config } = await loadProduct(tx, row.productId);
      if (!product || !config.enabled) throw fail('This product cannot be customized');
      for (const [key, list] of OPTION_LISTS) {
        if (config.variants[list].length && !row.options?.[key]) throw fail(`Select a ${key} before saving your design`);
      }
      const design = row.design || {};
      const background = design.background || {};
      const instructions = row.instructions || {};
      const hasContent = design.elements?.length > 0 || background.color || background.imageAssetId || background.pattern
        || design.imageAssetId || design.text?.value
        || ['requirements', 'preferredDesign', 'notes', 'delivery'].some((key) => instructions[key]);
      if (!hasContent) throw fail('Add a logo, text, sticker or instructions before saving');
      const updated = await tx.customizationDesign.update({
        where: { id },
        data: { previewAssetId, previewInfo, status: 'SAVED', revision: { increment: 1 } },
      });
      const snapshot = await buildSnapshot(tx, updated);
      await tx.cartItem.updateMany({ where: { customizationId: id, cart: { userId } }, data: { customization: snapshot } });
      return { saved: updated, previousPreview: row.previewAssetId };
    });
    if (previousPreview !== previewAssetId) await removeUnusedPreview(userId, previousPreview);
    return saved;
  },

  // ── Staff views: only designs that became part of an order are visible ──
  listOrderedItems: async ({ status, search, page, limit } = {}) => {
    const where = {
      customizationStatus: status || { not: null },
      ...(search ? { OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { orderId: { contains: search, mode: 'insensitive' } },
        { order: { user: { email: { contains: search, mode: 'insensitive' } } } },
        { order: { user: { name: { contains: search, mode: 'insensitive' } } } },
      ] } : {}),
    };
    const [total, counts] = await Promise.all([
      prisma.orderItem.count({ where }),
      prisma.orderItem.groupBy({ by: ['customizationStatus'], where: { customizationStatus: { not: null } }, _count: { _all: true } }),
    ]);
    const meta = paginate(page, limit || 20, total);
    const rows = await prisma.orderItem.findMany({
      where,
      orderBy: { order: { createdAt: 'desc' } },
      skip: meta.skip,
      take: meta.take,
      include: {
        order: { select: { id: true, status: true, createdAt: true, shippingAddress: true, user: { select: { id: true, name: true, email: true } } } },
        product: { select: { id: true, name: true, slug: true, images: true } },
      },
    });
    return { ...paginatedResponse(rows, meta), counts: Object.fromEntries(counts.map((entry) => [entry.customizationStatus, entry._count._all])) };
  },

  updateReviewStatus: async (itemId, body) => {
    const { status, note } = parseOrFail(reviewStatusSchema, body);
    const item = await prisma.orderItem.findFirst({ where: { id: itemId, customizationStatus: { not: null } }, select: { id: true } });
    if (!item) throw fail('Customized order item not found', HTTP_STATUS.NOT_FOUND);
    return prisma.orderItem.update({
      where: { id: itemId },
      data: { customizationStatus: status, customizationStatusAt: new Date(), ...(note !== undefined ? { customizationStatusNote: note || null } : {}) },
    });
  },
};
