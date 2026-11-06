import { z } from 'zod';

// Keep these lists in step with frontend/src/pages/Customize/designModel.js.
export const FONT_FAMILIES = ['Montserrat', 'Playfair Display', 'Arial', 'Georgia', 'Verdana', 'Times New Roman', 'Courier New', 'Impact', 'Dancing Script', 'Bebas Neue'];
export const PATTERNS = ['dots', 'stripes', 'checks', 'hearts', 'confetti', 'waves'];
export const ASSET_KINDS = ['LOGO', 'GRAPHIC', 'BACKGROUND', 'REFERENCE'];
export const REVIEW_STATUSES = ['PENDING_REVIEW', 'DESIGN_APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'];

const number = (min, max) => z.number().finite().min(min).max(max);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a 6-digit hex colour');
const assetId = z.string().min(1).max(100);
const slug = z.string().regex(/^[a-z0-9-]{1,40}$/);

const elementBase = {
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  x: number(-50, 150),
  y: number(-50, 150),
  width: number(1, 300),
  height: number(1, 300),
  rotation: number(-360, 360),
  opacity: number(0, 1),
  hidden: z.boolean().optional(),
};

const textElement = z.object({
  ...elementBase,
  type: z.literal('text'),
  role: z.enum(['heading', 'name', 'message', 'company', 'description', 'custom']),
  text: z.string().max(500),
  fontFamily: z.enum(FONT_FAMILIES),
  fontSize: number(0.5, 40),
  bold: z.boolean(),
  italic: z.boolean(),
  align: z.enum(['left', 'center', 'right']),
  color,
  backgroundColor: color.nullable(),
  outlineColor: color.nullable(),
  outlineWidth: number(0, 5),
}).strict();

const logoElement = z.object({ ...elementBase, type: z.literal('logo'), assetId, keepAspect: z.boolean() }).strict();
const graphicElement = z.object({ ...elementBase, type: z.literal('graphic'), assetId, keepAspect: z.boolean() }).strict();
const stickerElement = z.object({ ...elementBase, type: z.literal('sticker'), stickerId: slug }).strict();
const shapeElement = z.object({ ...elementBase, type: z.literal('shape'), shapeId: slug, color }).strict();

const backgroundSchema = z.object({
  x: number(0, 100),
  y: number(0, 100),
  width: number(5, 100),
  height: number(5, 100),
  shape: z.enum(['rect', 'rounded', 'circle']),
  color: color.nullable(),
  opacity: number(0, 1),
  imageAssetId: assetId.nullable(),
  pattern: z.enum(PATTERNS).nullable(),
  patternColor: color,
  borderStyle: z.enum(['none', 'solid', 'dashed', 'dotted', 'double']),
  borderWidth: number(0, 10),
  borderColor: color,
}).strict();

export const designSchema = z.object({
  version: z.literal(2),
  productImage: z.string().max(2000).nullable(),
  elements: z.array(z.discriminatedUnion('type', [textElement, logoElement, graphicElement, stickerElement, shapeElement])).max(60, 'can hold at most 60 elements'),
  background: backgroundSchema,
}).strict();

const note = z.string().trim().max(2000);
export const instructionsSchema = z.object({
  requirements: note.optional().default(''),
  delivery: note.optional().default(''),
  preferredDesign: note.optional().default(''),
  notes: note.optional().default(''),
  referenceAssetIds: z.array(assetId).max(5, 'can hold at most 5 images').optional().default([]),
}).strict();

export const optionsSchema = z.object({
  size: z.string().trim().min(1).max(60).nullable().optional(),
  color: z.string().trim().min(1).max(60).nullable().optional(),
  material: z.string().trim().min(1).max(60).nullable().optional(),
}).strict();

const designFields = {
  name: z.string().trim().min(1, 'must not be empty').max(80),
  quantity: z.number().int().min(1).max(10000),
  options: optionsSchema,
  design: designSchema,
  instructions: instructionsSchema,
};

export const createDesignSchema = z.object({ productId: z.string().min(1).max(100), ...designFields }).strict();
export const updateDesignSchema = z.object({ expectedRevision: z.number().int().min(1), ...designFields }).strict();

export const reviewStatusSchema = z.object({
  status: z.enum(REVIEW_STATUSES),
  note: z.string().trim().max(1000).nullable().optional(),
}).strict();

const optionList = z.array(z.string().trim().min(1).max(60)).max(30);
export const customizationConfigSchema = z.object({
  enabled: z.boolean(),
  tools: z.object({
    uploads: z.boolean(),
    text: z.boolean(),
    stickers: z.boolean(),
    graphics: z.boolean(),
    templates: z.boolean(),
    background: z.boolean(),
  }).strict(),
  variants: z.object({ sizes: optionList, colors: optionList, materials: optionList }).strict(),
  chargePerUnit: z.number().finite().min(0).max(1000000),
}).strict();
