import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/db.js';
import { validateSnapshotAssets, canReadArtwork, resolveCustomizationConfig, customizationCharge, variantIdFrom, designAssetIds } from '../src/services/customizationService.js';
import { assertSafeSvg } from '../src/services/artworkValidation.js';

const originalCount = prisma.customizationAsset.count;
const originalFind = prisma.orderItem.findFirst;
after(() => { prisma.customizationAsset.count = originalCount; prisma.orderItem.findFirst = originalFind; });

test('validates customization snapshot shape and asset references', async () => {
  await assert.rejects(validateSnapshotAssets('user', []), { statusCode: 400 });
  await assert.rejects(validateSnapshotAssets('user', { imageAssetId: 12, previewAssetId: 'p' }), { statusCode: 400 });
  await assert.rejects(validateSnapshotAssets('user', { version: 2 }), /Save the current customization/);
});

test('staff access requires an order owned by the asset owner and referencing the asset', async () => {
  const asset = { id: 'asset', userId: 'owner' };
  assert.equal(await canReadArtwork({ id: 'owner', role: 'USER' }, asset), true);
  assert.equal(await canReadArtwork({ id: 'other', role: 'USER' }, asset), false);
  prisma.orderItem.findFirst = async ({ where }) => {
    assert.equal(where.order.userId, 'owner');
    assert.deepEqual(where.OR[0].customization.array_contains, ['asset']);
    assert.deepEqual(where.OR.slice(1).map((filter) => filter.customization.equals), ['asset', 'asset']);
    return null;
  };
  assert.equal(await canReadArtwork({ id: 'admin', role: 'ADMIN' }, asset), false);
  prisma.orderItem.findFirst = async () => ({ id: 'item' });
  assert.equal(await canReadArtwork({ id: 'admin', role: 'SUPER_ADMIN' }, asset), true);
  assert.equal(await canReadArtwork({ id: 'admin', role: 'STORE_ADMIN' }, asset), true);
});

test('requires every referenced asset to belong to the user', async () => {
  prisma.customizationAsset.count = async ({ where }) => {
    assert.equal(where.userId, 'owner');
    assert.deepEqual(where.id.in, ['owned', 'other', 'logo']);
    return 2;
  };
  const snapshot = { imageAssetId: 'owned', previewAssetId: 'other', assetIds: ['logo', 'owned'] };
  await assert.rejects(validateSnapshotAssets('owner', snapshot), { statusCode: 400 });
  prisma.customizationAsset.count = async () => 3;
  assert.deepEqual(await validateSnapshotAssets('owner', snapshot), snapshot);
});

test('resolves product customization options and charges', () => {
  assert.equal(resolveCustomizationConfig({ customizationConfig: null }).enabled, true);
  assert.equal(resolveCustomizationConfig({ customizationConfig: { enabled: false } }).enabled, false);
  assert.equal(customizationCharge({ customizationConfig: { chargePerUnit: 25 } }, true), 25);
  assert.equal(customizationCharge({ customizationConfig: { chargePerUnit: 25 } }, false), 0);
  assert.equal(customizationCharge({ customizationConfig: { chargePerUnit: -5 } }, true), 0);
  assert.equal(variantIdFrom({ size: 'M', color: null, material: 'Wood' }), 'size=M;material=Wood');
  assert.equal(variantIdFrom({}), null);
});

test('collects every uploaded file a design references', () => {
  assert.deepEqual(designAssetIds({
    elements: [{ type: 'logo', assetId: 'a' }, { type: 'text' }, { type: 'graphic', assetId: 'b' }, { type: 'logo', assetId: 'a' }],
    background: { imageAssetId: 'c' },
  }, { referenceAssetIds: ['d'] }), ['a', 'b', 'c', 'd']);
});

test('rejects SVG markup that can run code or reach the network', () => {
  const svg = (inner, attributes = '') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"${attributes}>${inner}</svg>`);
  assert.doesNotThrow(() => assertSafeSvg(svg('<circle r="4" fill="#000"/><use href="#a"/>')));
  for (const unsafe of [
    svg('<script>alert(1)</script>'),
    svg('<circle/>', ' onload="alert(1)"'),
    svg('<foreignObject></foreignObject>'),
    svg('<image href="https://example.com/x.png"/>'),
    svg('<image xlink:href="file:///etc/passwd"/>'),
    svg('<a href="javascript:alert(1)"></a>'),
    svg('<style>@import url(https://example.com/x.css);</style>'),
    svg('<rect fill="url(https://example.com/x.svg#a)"/>'),
    Buffer.from('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>'),
  ]) assert.throws(() => assertSafeSvg(unsafe), { statusCode: 400 }, unsafe.toString());
});
