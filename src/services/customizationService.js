import prisma from '../config/db.js';
import { isDeepStrictEqual } from 'node:util';

export async function canReadArtwork(user, asset) {
  if (asset.userId === user.id) return true;
  if (!['ADMIN', 'SUPER_ADMIN', 'STORE_ADMIN'].includes(user.role)) return false;
  return Boolean(await prisma.orderItem.findFirst({ where: { order: { userId: asset.userId }, OR: [
    { customization: { path: ['imageAssetId'], equals: asset.id } },
    { customization: { path: ['previewAssetId'], equals: asset.id } },
  ] }, select: { id: true } }));
}

export async function validateCustomization(userId, design, db = prisma) {
  if (!design || typeof design !== 'object' || Array.isArray(design) || JSON.stringify(design).length > 20000) {
    const error = new Error('Invalid customization');
    error.statusCode = 400;
    throw error;
  }
  const ids = [design.imageAssetId, design.previewAssetId].filter((id) => id != null);
  if (ids.some((id) => typeof id !== 'string' || !id || id.length > 100)) {
    const error = new Error('Invalid customization asset');
    error.statusCode = 400;
    throw error;
  }
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length && await db.customizationAsset.count({ where: { userId, id: { in: uniqueIds } } }) !== uniqueIds.length) {
    const error = new Error('Customization asset not found');
    error.statusCode = 400;
    throw error;
  }
  return design;
}

export async function validateSavedCustomization(userId, productId, design, db = prisma) {
  await validateCustomization(userId, design, db);
  const draft = await db.customizationDraft.findUnique({ where: { userId_productId: { userId, productId } }, select: { design: true } });
  if (design.version !== 1 || !design.previewAssetId || !draft || !isDeepStrictEqual(draft.design, design)) {
    const error = new Error('Save the current customization and preview before adding it to your cart');
    error.statusCode = 400;
    throw error;
  }
  return design;
}
