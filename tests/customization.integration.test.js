import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Provision the schema separately with `prisma migrate deploy`; never point this at public.
test('real PostgreSQL customization lifecycle from upload to admin review', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const database = new URL(process.env.TEST_DATABASE_URL);
  assert.match(database.searchParams.get('schema') || '', /^kilo_it_[a-z0-9_]+$/, 'TEST_DATABASE_URL must use an isolated kilo_it_ schema');
  process.env.DATABASE_URL = database.toString();
  process.env.NODE_ENV = 'test';
  const directory = await mkdtemp(path.join(os.tmpdir(), 'giftery-integration-'));
  process.env.PRIVATE_ARTWORK_DIR = path.join(directory, 'artwork');
  process.env.UPLOAD_DIR = path.join(directory, 'uploads');
  process.env.LOG_DIR = path.join(directory, 'logs');
  const { default: prisma } = await import('../src/config/db.js');
  let server;
  try {
    const { default: app } = await import('../src/app.js');
    const { signToken } = await import('../src/utils/jwt.js');
    const { calculateOrderPricing } = await import('../src/services/orderPricing.js');
    const sharp = (await import('sharp')).default;
    const suffix = randomUUID();
    const users = await Promise.all(['USER', 'USER', 'ADMIN'].map((role, i) => prisma.user.create({ data: {
      name: `Integration ${i}`, email: `integration-${suffix}-${i}@example.invalid`, password: 'not-a-login-password', role,
    } })));
    const [customer, stranger, admin] = [0, 1, 2];
    const category = await prisma.category.create({ data: { name: 'Integration', slug: `integration-${suffix}` } });
    const productImage = '/uploads/integration.webp';
    const product = await prisma.product.create({ data: {
      name: 'Integration product', slug: `integration-${suffix}`, description: 'Test', price: 10, stock: 20, images: [productImage], categoryId: category.id,
      customizationConfig: {
        enabled: true,
        tools: { uploads: true, text: true, stickers: true, graphics: true, templates: true, background: true },
        variants: { sizes: ['S', 'M'], colors: [], materials: [] },
        chargePerUnit: 5,
      },
    } });
    const locked = await prisma.product.create({ data: {
      name: 'Not customizable', slug: `locked-${suffix}`, description: 'Test', price: 10, stock: 20, images: [], categoryId: category.id,
      customizationConfig: { enabled: false, tools: {}, variants: {}, chargePerUnit: 0 },
    } });
    const textOnly = await prisma.product.create({ data: {
      name: 'Text only', slug: `text-only-${suffix}`, description: 'Test', price: 10, stock: 20, images: [], categoryId: category.id,
      customizationConfig: {
        enabled: true,
        tools: { uploads: false, text: true, stickers: false, graphics: false, templates: false, background: false },
        variants: { sizes: [], colors: [], materials: [] },
        chargePerUnit: 0,
      },
    } });

    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const tokens = users.map((user) => signToken({ id: user.id }));
    const request = (url, user, options = {}) => fetch(base + url, { ...options, headers: { ...(user == null ? {} : { Authorization: `Bearer ${tokens[user]}` }), ...options.headers } });
    const send = async (url, user, method, body, status) => {
      const response = await request(url, user, { method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
      const result = await response.json();
      assert.equal(response.status, status, `${method} ${url}: ${JSON.stringify(result)}`);
      return result.data;
    };
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const uploadFile = (user, bytes, name, kind = 'LOGO', type = 'image/png') => {
      const form = new FormData();
      form.append('kind', kind);
      form.append('image', new Blob([bytes], { type }), name);
      return request('/customizations/assets', user, { method: 'POST', body: form });
    };
    const finalize = async (user, design, status = 200) => {
      const form = new FormData();
      form.append('expectedRevision', String(design.revision));
      form.append('includesProductImage', 'true');
      form.append('preview', new Blob([png], { type: 'image/png' }), 'preview.png');
      const response = await request(`/customizations/designs/${design.id}/finalize`, user, { method: 'POST', body: form });
      const result = await response.json();
      assert.equal(response.status, status, JSON.stringify(result));
      return result.data;
    };
    const background = { x: 50, y: 50, width: 60, height: 60, shape: 'rect', color: null, opacity: 1, imageAssetId: null, pattern: null, patternColor: '#000000', borderStyle: 'none', borderWidth: 0, borderColor: '#000000' };
    const element = { x: 50, y: 50, width: 30, height: 30, rotation: 15, opacity: 1 };
    const text = (id, value) => ({ ...element, id, type: 'text', role: 'name', text: value, fontFamily: 'Montserrat', fontSize: 5, bold: true, italic: false, align: 'center', color: '#111111', backgroundColor: null, outlineColor: null, outlineWidth: 0 });
    const body = (overrides = {}) => ({
      name: 'First', quantity: 2, options: { size: 'M' }, instructions: { requirements: 'Handle gently' },
      design: { version: 2, productImage, elements: [text('t1', 'Hello')], background },
      ...overrides,
    });

    // ── Authentication and upload validation ──
    assert.equal((await request('/customizations/designs', null)).status, 401);
    assert.equal((await request('/customizations/assets', null, { method: 'POST' })).status, 401);
    assert.equal((await uploadFile(customer, Buffer.from('not an image'), 'fake.png')).status, 400);
    assert.equal((await uploadFile(customer, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.svg', 'LOGO', 'image/svg+xml')).status, 400);
    assert.equal((await uploadFile(customer, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="http://169.254.169.254/" /></svg>'), 'x.svg', 'LOGO', 'image/svg+xml')).status, 400);
    assert.equal((await uploadFile(customer, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'x.svg', 'LOGO', 'image/svg+xml')).status, 400);
    assert.equal((await uploadFile(customer, png, 'bad-kind.png', 'PREVIEW')).status, 400);

    const logoResponse = await uploadFile(customer, png, 'logo.png');
    assert.equal(logoResponse.status, 201);
    const logo = (await logoResponse.json()).data;
    assert.equal(logo.originalName, 'logo.png');
    assert.equal(logo.width, 2);
    const svgBytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#d99b26"/></svg>');
    const svgResponse = await uploadFile(customer, svgBytes, 'mark.svg', 'LOGO', 'image/svg+xml');
    assert.equal(svgResponse.status, 201);
    const svg = (await svgResponse.json()).data;
    assert.equal(svg.mimeType, 'image/png', 'SVG uploads are rendered to PNG for the browser');
    assert.equal((await request(`/customizations/assets/${svg.id}`, customer)).headers.get('content-type'), 'image/png');
    const svgSource = await request(`/customizations/assets/${svg.id}?source=1`, customer);
    assert.match(svgSource.headers.get('content-disposition'), /^attachment/);
    assert.deepEqual(Buffer.from(await svgSource.arrayBuffer()), svgBytes);
    assert.equal((await request(`/customizations/assets/${logo.id}?source=1`, customer)).status, 404);
    assert.equal((await request(`/customizations/assets/${logo.id}`, stranger)).status, 404);
    assert.equal((await request(`/customizations/assets/${logo.id}`, admin)).status, 404, 'staff cannot read drafts that were never ordered');

    // ── Designs belong to one customer and multiple are allowed per product ──
    const withLogo = { ...element, id: 'l1', type: 'logo', assetId: logo.id, keepAspect: true };
    await send('/customizations/designs', stranger, 'POST', { productId: product.id, ...body({ design: { ...body().design, elements: [withLogo] } }) }, 400);
    await send('/customizations/designs', customer, 'POST', { productId: locked.id, name: 'x', quantity: 1, options: {}, instructions: {}, design: { ...body().design, productImage: null } }, 400);
    await send('/customizations/designs', customer, 'POST', { productId: textOnly.id, name: 'x', quantity: 1, options: {}, instructions: {}, design: { ...body().design, productImage: null, elements: [withLogo] } }, 400);
    await send('/customizations/designs', customer, 'POST', { productId: product.id, ...body({ options: { size: 'XXL' } }) }, 400);
    await send('/customizations/designs', customer, 'POST', { productId: product.id, ...body({ design: { ...body().design, productImage: 'https://evil.example/x.png' } }) }, 400);
    await send('/customizations/designs', customer, 'POST', { productId: product.id, ...body({ design: { ...body().design, elements: [{ ...text('t', 'x'), fontFamily: 'Comic Sans' }] } }) }, 400);

    let first = await send('/customizations/designs', customer, 'POST', { productId: product.id, ...body({ design: { ...body().design, elements: [withLogo, text('t1', 'Hello')] } }) }, 201);
    let second = await send('/customizations/designs', customer, 'POST', { productId: product.id, ...body({ name: 'Second', design: { ...body().design, elements: [text('t2', 'Second design')] } }) }, 201);
    assert.notEqual(first.id, second.id);
    assert.equal(first.variantId, 'size=M');
    assert.deepEqual(first.assetIds, [logo.id]);
    assert.equal((await send(`/customizations/designs?productId=${product.id}`, customer, 'GET', undefined, 200)).data.length, 2);
    assert.equal((await send(`/customizations/designs?productId=${product.id}`, stranger, 'GET', undefined, 200)).data.length, 0);
    await send(`/customizations/designs/${first.id}`, stranger, 'GET', undefined, 404);
    await send(`/customizations/designs/${first.id}`, stranger, 'PUT', { expectedRevision: 1, ...body() }, 404);
    await send(`/customizations/designs/${first.id}`, stranger, 'DELETE', undefined, 404);

    // ── Autosave uses optimistic revisions ──
    const edited = await send(`/customizations/designs/${first.id}`, customer, 'PUT', { expectedRevision: first.revision, ...body({ design: { ...body().design, elements: [withLogo, text('t1', 'Hello edited')] } }) }, 200);
    await send(`/customizations/designs/${first.id}`, customer, 'PUT', { expectedRevision: first.revision, ...body() }, 409);
    first = edited;

    // ── Unsaved work cannot be bought ──
    await send('/cart', customer, 'POST', { productId: product.id, quantity: 1, customizationId: first.id }, 400);
    await send('/cart', customer, 'POST', { productId: product.id, quantity: 1, customization: { version: 2 } }, 422);
    await send('/cart', stranger, 'POST', { productId: product.id, quantity: 1, customizationId: first.id }, 400);

    // ── A required option must be chosen before saving ──
    const noSize = await send('/customizations/designs', customer, 'POST', { productId: product.id, ...body({ name: 'No size', options: {} }) }, 201);
    await finalize(customer, noSize, 400);
    await send(`/customizations/designs/${noSize.id}`, customer, 'DELETE', undefined, 200);

    first = await finalize(customer, first);
    assert.equal(first.status, 'SAVED');
    assert.ok(first.previewAssetId);
    second = await finalize(customer, second);
    await finalize(stranger, first, 404);
    assert.equal((await request(`/customizations/assets/${first.previewAssetId}`, customer)).status, 200);

    // ── Cart keeps separate lines, a charge, and the snapshot through quantity changes ──
    let cart = (await send('/cart', customer, 'POST', { productId: product.id, quantity: 1, customizationId: first.id }, 200)).cart;
    cart = (await send('/cart', customer, 'POST', { productId: product.id, quantity: 1, customizationId: second.id }, 200)).cart;
    cart = (await send('/cart', customer, 'POST', { productId: product.id, quantity: 1 }, 200)).cart;
    assert.equal(cart.items.length, 3);
    const firstLine = () => cart.items.find((item) => item.customizationId === first.id);
    assert.equal(firstLine().customizationCharge, 5);
    assert.equal(firstLine().unitPrice, 15);
    assert.equal(cart.items.find((item) => !item.customization).unitPrice, 10);
    assert.equal(cart.total, 15 + 15 + 10);
    assert.equal(firstLine().product.customizationConfig, undefined);
    assert.equal(firstLine().customization.customizationId, first.id);
    assert.deepEqual(firstLine().customization.options, { size: 'M' });
    assert.equal(firstLine().customization.instructions.requirements, 'Handle gently');
    assert.equal(firstLine().customization.assets[0].originalName, 'logo.png');
    cart = (await send(`/cart/${firstLine().id}`, customer, 'PUT', { quantity: 3 }, 200)).cart;
    assert.equal(firstLine().quantity, 3);
    assert.equal(firstLine().customization.elements[1].text, 'Hello edited');
    cart = (await send('/cart', customer, 'POST', { productId: product.id, quantity: 1, customizationId: first.id }, 200)).cart;
    assert.equal(firstLine().quantity, 4, 'adding the same design increases its line');
    assert.equal(cart.items.length, 3);
    cart = (await send(`/cart/${firstLine().id}`, customer, 'PUT', { quantity: 3 }, 200)).cart;
    await send(`/cart/${firstLine().id}`, stranger, 'PUT', { quantity: 1 }, 404);

    // ── Autosaved edits leave the cart alone; saving again refreshes it and replaces the old preview ──
    const previousPreview = first.previewAssetId;
    first = await send(`/customizations/designs/${first.id}`, customer, 'PUT', { expectedRevision: first.revision, ...body({ design: { ...body().design, elements: [withLogo, text('t1', 'Final wording')] } }) }, 200);
    assert.equal(first.status, 'DRAFT');
    cart = (await send('/cart', customer, 'GET', undefined, 200)).cart;
    assert.equal(firstLine().customization.elements[1].text, 'Hello edited');
    await send('/orders', customer, 'POST', { shippingAddress: {}, items: [{ productId: product.id, quantity: 1, customizationId: first.id }], expectedTotal: 0 }, 400);
    first = await finalize(customer, first);
    cart = (await send('/cart', customer, 'GET', undefined, 200)).cart;
    assert.equal(firstLine().customization.elements[1].text, 'Final wording');
    assert.equal(firstLine().customization.previewAssetId, first.previewAssetId);
    assert.equal((await request(`/customizations/assets/${previousPreview}`, customer)).status, 404, 'unreferenced previews are removed');

    // ── Buy Now rebuilds from the saved design and ignores client JSON ──
    await send('/orders', customer, 'POST', { shippingAddress: {}, items: [{ productId: product.id, quantity: 1, customization: { version: 2, previewAssetId: first.previewAssetId } }], expectedTotal: 0 }, 400);
    await send('/orders', stranger, 'POST', { shippingAddress: {}, items: [{ productId: product.id, quantity: 1, customizationId: second.id }], expectedTotal: 0 }, 400);
    const direct = (await send('/orders', customer, 'POST', {
      shippingAddress: {}, expectedTotal: calculateOrderPricing(1500).totalAmount,
      items: [{ productId: product.id, quantity: 1, customizationId: second.id, customization: { name: 'tampered', elements: [] }, price: 0 }],
    }, 201)).order;
    assert.equal(direct.items[0].customization.name, 'Second');
    assert.equal(direct.items[0].price, 15);
    assert.equal(direct.items[0].customizationCharge, 5);
    assert.equal(direct.items[0].customizationStatus, 'PENDING_REVIEW');
    assert.equal((await send('/cart', customer, 'GET', undefined, 200)).cart.items.length, 3, 'Buy Now leaves the cart alone');
    assert.equal((await send(`/customizations/designs/${second.id}`, customer, 'GET', undefined, 200)).status, 'ORDERED');

    // ── Cart checkout carries every line into the order ──
    const subtotal = 3 * 15 + 15 + 10;
    await send('/orders', customer, 'POST', { shippingAddress: {}, expectedTotal: 1 }, 409);
    const ordered = (await send('/orders', customer, 'POST', { shippingAddress: {}, expectedTotal: calculateOrderPricing(subtotal * 100).totalAmount }, 201)).order;
    assert.equal(ordered.items.length, 3);
    const orderedFirst = ordered.items.find((item) => item.customizationId === first.id);
    assert.equal(orderedFirst.quantity, 3);
    assert.equal(orderedFirst.price, 15);
    assert.equal(orderedFirst.customization.elements[1].text, 'Final wording');
    const plainLine = ordered.items.find((item) => !item.customizationId);
    assert.equal(plainLine.customization, null);
    assert.equal(plainLine.customizationStatus, null);
    assert.equal(plainLine.customizationCharge, 0);
    assert.equal((await send('/cart', customer, 'GET', undefined, 200)).cart.items.length, 0);

    // ── The order snapshot is immutable ──
    first = await send(`/customizations/designs/${first.id}`, customer, 'PUT', { expectedRevision: first.revision, ...body({ design: { ...body().design, elements: [text('t1', 'Changed after ordering')] } }) }, 200);
    assert.equal((await prisma.orderItem.findUniqueOrThrow({ where: { id: orderedFirst.id } })).customization.elements[1].text, 'Final wording');
    await send(`/customizations/designs/${first.id}`, customer, 'DELETE', undefined, 200);
    const afterDelete = await prisma.orderItem.findUniqueOrThrow({ where: { id: orderedFirst.id } });
    assert.equal(afterDelete.customizationId, null);
    assert.equal(afterDelete.customization.elements[1].text, 'Final wording');

    // ── Files used by orders stay available and cannot be deleted ──
    await send(`/customizations/assets/${logo.id}`, customer, 'DELETE', undefined, 409);
    assert.equal((await request(`/customizations/assets/${orderedFirst.customization.previewAssetId}`, customer)).status, 200);
    await send(`/customizations/assets/${svg.id}`, stranger, 'DELETE', undefined, 404);
    await send(`/customizations/assets/${svg.id}`, customer, 'DELETE', undefined, 200);
    assert.equal((await request(`/customizations/assets/${svg.id}`, customer)).status, 404);

    // ── Customer order history and access control ──
    const history = (await send('/orders/my', customer, 'GET', undefined, 200)).data;
    assert.ok(history.some((order) => order.items.some((item) => item.customization?.name === 'Second' && item.customizationStatus === 'PENDING_REVIEW')));
    await send(`/orders/${ordered.id}`, stranger, 'GET', undefined, 403);

    // ── Admin review ──
    await send('/customizations/admin/items', customer, 'GET', undefined, 403);
    await send(`/customizations/admin/items/${orderedFirst.id}/status`, customer, 'PATCH', { status: 'COMPLETED' }, 403);
    const listed = await send(`/customizations/admin/items?search=${encodeURIComponent(ordered.id)}`, admin, 'GET', undefined, 200);
    assert.equal(listed.data.length, 2);
    assert.equal(listed.data[0].order.user.email, users[customer].email);
    assert.ok(listed.counts.PENDING_REVIEW >= 3, 'counts include every customized item awaiting review');
    await send(`/customizations/admin/items/${orderedFirst.id}/status`, admin, 'PATCH', { status: 'NOPE' }, 400);
    await send(`/customizations/admin/items/${plainLine.id}/status`, admin, 'PATCH', { status: 'COMPLETED' }, 404);
    const reviewed = await send(`/customizations/admin/items/${orderedFirst.id}/status`, admin, 'PATCH', { status: 'DESIGN_APPROVED', note: 'Looks good' }, 200);
    assert.equal(reviewed.customizationStatus, 'DESIGN_APPROVED');
    assert.equal(reviewed.customizationStatusNote, 'Looks good');
    assert.equal((await send(`/customizations/admin/items?status=DESIGN_APPROVED&search=${encodeURIComponent(ordered.id)}`, admin, 'GET', undefined, 200)).data.length, 1);
    assert.deepEqual(Buffer.from(await (await request(`/customizations/assets/${logo.id}`, admin)).arrayBuffer()), png);
    assert.equal((await request(`/customizations/assets/${orderedFirst.customization.previewAssetId}`, admin)).status, 200);
    assert.equal((await request(`/customizations/assets/${logo.id}`, stranger)).status, 404);

    // ── The catalog exposes per-product options to the storefront ──
    const publicProduct = await send(`/products/${product.id}`, null, 'GET', undefined, 200);
    assert.deepEqual((publicProduct.product ?? publicProduct).customizationConfig.variants.sizes, ['S', 'M']);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
