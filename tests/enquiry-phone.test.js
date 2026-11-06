import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeContactPhone } from '../src/utils/phone.js';

test('accepts international mobile numbers and stores them with their country code', () => {
  assert.equal(normalizeContactPhone('+971501234567'), '+971501234567');
  assert.equal(normalizeContactPhone('+971 50 123 4567'), '+971501234567');
  assert.equal(normalizeContactPhone('+919876543210'), '+919876543210');
  assert.equal(normalizeContactPhone('+12025550123'), '+12025550123');
  assert.equal(normalizeContactPhone('+447400123456'), '+447400123456');
});

test('reads numbers without a country code as Indian, as older pages sent', () => {
  assert.equal(normalizeContactPhone('9876543210'), '+919876543210');
  assert.equal(normalizeContactPhone(9876543210), '+919876543210');
});

test('a phone number is optional', () => {
  for (const empty of [undefined, null, '', '   ', 'N/A', 'n/a', 'Not provided', {}, []]) {
    assert.equal(normalizeContactPhone(empty), null);
  }
});

test('rejects numbers that are not valid for their country', () => {
  for (const bad of ['+9719876543210', '+91123', '1234567890', 'not a phone', '+', '+0000000000']) {
    assert.throws(() => normalizeContactPhone(bad), { statusCode: 400 }, bad);
  }
});
