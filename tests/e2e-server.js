// Starts the API against an isolated kilo_it_ schema with known accounts and products,
// for frontend/e2e/customization-live.spec.js. Never point TEST_DATABASE_URL at public.
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const database = new URL(process.env.TEST_DATABASE_URL || 'invalid:');
if (!/^kilo_it_[a-z0-9_]+$/.test(database.searchParams.get('schema') || '')) {
  throw new Error('TEST_DATABASE_URL must use an isolated kilo_it_ schema');
}
process.env.DATABASE_URL = database.toString();
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_MAX = '100000';
process.env.AUTH_RATE_LIMIT_MAX = '100000';
const directory = await mkdtemp(path.join(os.tmpdir(), 'giftery-e2e-'));
process.env.PRIVATE_ARTWORK_DIR = path.join(directory, 'artwork');
process.env.UPLOAD_DIR = path.join(directory, 'uploads');
process.env.LOG_DIR = path.join(directory, 'logs');
process.env.LOG_LEVEL = 'error';

const { default: sharp } = await import('sharp');
const { mkdirSync } = await import('node:fs');
const { createServer } = await import('node:http');
mkdirSync(process.env.UPLOAD_DIR, { recursive: true });
const photo = sharp({ create: { width: 600, height: 400, channels: 3, background: '#cbd5e1' } }).png();
await photo.clone().toFile(path.join(process.env.UPLOAD_DIR, 'e2e-product.png'));
// A separate host that sends no CORS headers, like a third-party image CDN.
const photoBytes = await photo.clone().toBuffer();
createServer((req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.end(photoBytes);
}).listen(5101);

const { default: bcrypt } = await import('bcryptjs');
const { default: prisma } = await import('../src/config/db.js');
const { default: app } = await import('../src/app.js');

// Clear previous runs in this throwaway schema only.
await prisma.orderItem.deleteMany();
await prisma.payment.deleteMany();
await prisma.order.deleteMany();
await prisma.cartItem.deleteMany();
await prisma.customizationDesign.deleteMany();
await prisma.customizationAsset.deleteMany();
await prisma.product.deleteMany();
await prisma.category.deleteMany();
await prisma.cart.deleteMany();
await prisma.user.deleteMany();

const password = await bcrypt.hash('Studio-Test-123', 4);
const account = (name, email, role = 'USER') => prisma.user.create({ data: { name, email, password, role, isEmailVerified: true } });
await account('Casey Customer', 'casey@example.invalid');
await account('Sam Stranger', 'sam@example.invalid');
await account('Store Staff', 'staff@example.invalid', 'ADMIN');

const category = await prisma.category.create({ data: { name: 'Corporate Gifts', slug: 'corporate-gifts' } });
const images = ['/images/about_hero_gift_set.png', '/images/product-placeholder.svg'];
const product = (data) => prisma.product.create({ data: { description: 'A test product.', categoryId: category.id, stock: 25, images, ...data } });
await product({
  name: 'Studio Mug', slug: 'studio-mug', price: 500,
  customizationConfig: {
    enabled: true,
    tools: { uploads: true, text: true, stickers: true, graphics: true, templates: true, background: true },
    variants: { sizes: ['Small', 'Large'], colors: [], materials: [] },
    chargePerUnit: 50,
  },
});
// These photos come from the API origin, as uploaded catalogue images do, so the preview export crosses origins.
await product({ name: 'Default Gift', slug: 'default-gift', price: 200, images: ['/uploads/e2e-product.png'] });
await product({ name: 'No CORS Photo', slug: 'no-cors-photo', price: 150, images: ['http://localhost:5101/photo.png'] });
await product({
  name: 'Text Only Pen', slug: 'text-only-pen', price: 100,
  customizationConfig: {
    enabled: true,
    tools: { uploads: false, text: true, stickers: false, graphics: false, templates: false, background: false },
    variants: { sizes: [], colors: [], materials: [] },
    chargePerUnit: 0,
  },
});
await product({
  name: 'Fixed Trophy', slug: 'fixed-trophy', price: 900,
  customizationConfig: { enabled: false, tools: {}, variants: {}, chargePerUnit: 0 },
});

app.listen(Number(process.env.PORT || 5100), () => console.log('e2e api ready'));
