import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/db.js';
import { validateCustomization, canReadArtwork } from '../src/services/customizationService.js';

const originalCount = prisma.customizationAsset.count;
const originalFind = prisma.orderItem.findFirst;
after(() => { prisma.customizationAsset.count = originalCount; prisma.orderItem.findFirst = originalFind; });

test('validates customization shape and size', async () => {
  await assert.rejects(validateCustomization('user', []), { statusCode: 400 });
  await assert.rejects(validateCustomization('user', { text: 'x'.repeat(20001) }), { statusCode: 400 });
  await assert.rejects(validateCustomization('user', { imageAssetId: 12 }), { statusCode: 400 });
  assert.deepEqual(await validateCustomization('user', { version: 1, imageAssetId: null }), { version: 1, imageAssetId: null });
});

test('staff access requires an order owned by the asset owner and referencing the asset', async () => {
  const asset = { id: 'asset', userId: 'owner' };
  assert.equal(await canReadArtwork({ id: 'owner', role: 'USER' }, asset), true);
  assert.equal(await canReadArtwork({ id: 'other', role: 'USER' }, asset), false);
  prisma.orderItem.findFirst = async ({ where }) => {
    assert.equal(where.order.userId, 'owner');
    assert.deepEqual(where.OR.map((filter) => filter.customization.equals), ['asset', 'asset']);
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
    assert.deepEqual(where.id.in, ['owned', 'other']);
    return 1;
  };
  await assert.rejects(validateCustomization('owner', { imageAssetId: 'owned', previewAssetId: 'other' }), { statusCode: 400 });
  prisma.customizationAsset.count = async () => 1;
  assert.deepEqual(await validateCustomization('owner', { imageAssetId: 'owned', previewAssetId: 'owned' }), { imageAssetId: 'owned', previewAssetId: 'owned' });
});
