import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bulkOrderInquirySchema } from '../src/validations/enquiryValidation.js';
import { buildAdminBulkInquiryEmail, buildCustomerBulkInquiryEmail } from '../src/helpers/email.js';
import { buildBulkInquirySummary } from '../src/services/bulkInquiryService.js';

const valid = {
  productId: 'prod_123',
  quantity: 250,
  name: '  Priya Raman ',
  email: 'Priya@Example.COM',
  phone: '+919876543210',
};

test('accepts a complete inquiry and normalises text', () => {
  const result = bulkOrderInquirySchema.parse({ ...valid, company: '  Acme Ltd ', requirements: '' });
  assert.equal(result.name, 'Priya Raman');
  assert.equal(result.email, 'priya@example.com');
  assert.equal(result.company, 'Acme Ltd');
  assert.equal(result.requirements, null);
});

test('accepts a quantity sent as a numeric string', () => {
  assert.equal(bulkOrderInquirySchema.parse({ ...valid, quantity: '500' }).quantity, 500);
});

test('bulk orders start at 100 units', () => {
  assert.equal(bulkOrderInquirySchema.parse({ ...valid, quantity: 100 }).quantity, 100);
  const result = bulkOrderInquirySchema.safeParse({ ...valid, quantity: 99 });
  assert.equal(result.success, false);
  assert.equal(result.error.issues[0].message, 'Minimum bulk order quantity is 100 units');
});

test('rejects quantities that are not positive whole numbers', () => {
  for (const quantity of [0, -5, 1, 99, '99', 2.5, '2.5', '10abc', '', null, undefined, 'abc', 1_000_001]) {
    const result = bulkOrderInquirySchema.safeParse({ ...valid, quantity });
    assert.equal(result.success, false, `quantity ${JSON.stringify(quantity)} should be rejected`);
    assert.equal(result.error.issues[0].path[0], 'quantity');
  }
});

test('requires name, email, phone and product', () => {
  for (const field of ['productId', 'name', 'email', 'phone']) {
    const result = bulkOrderInquirySchema.safeParse({ ...valid, [field]: '   ' });
    assert.equal(result.success, false, `${field} should be required`);
    assert.equal(result.error.issues[0].path[0], field);
  }
  assert.equal(bulkOrderInquirySchema.safeParse({ ...valid, email: 'not-an-email' }).success, false);
});

test('ignores client-supplied product name, SKU and price', () => {
  const result = bulkOrderInquirySchema.parse({ ...valid, productName: 'Fake', productSku: 'X', price: 1, type: 'GENERAL' });
  assert.equal('productName' in result, false);
  assert.equal('productSku' in result, false);
  assert.equal('price' in result, false);
  assert.equal('type' in result, false);
});

const inquiry = {
  id: 'ENQ-2026-0042',
  productId: 'prod_123',
  productName: 'Executive <Gift> Box',
  productSku: 'EGB-01',
  quantity: 1500,
  name: 'Priya <script>',
  phone: '+919876543210',
  email: 'priya@example.com',
  company: null,
  requirements: 'Logo on lid\nDeliver by March',
  createdAt: new Date('2026-11-27T06:30:00Z'),
};

test('admin email lists every inquiry detail with the 10% offer label', () => {
  const { subject, html, text } = buildAdminBulkInquiryEmail(inquiry);
  assert.match(subject, /Bulk order inquiry: Executive <Gift> Box x 1500 \(ENQ-2026-0042\)/);
  for (const expected of ['prod_123', 'EGB-01', '1,500', '+919876543210', 'priya@example.com', 'Not provided', 'Logo on lid', '27 Nov 2026', '10% OFF BULK ORDER OFFER']) {
    assert.ok(text.includes(expected), `admin text should include ${expected}`);
  }
  assert.ok(html.includes('Executive &lt;Gift&gt; Box'), 'product name is escaped');
  assert.ok(!html.includes('<script>'), 'customer input is escaped');
});

test('customer email confirms receipt without claiming the discount is applied', () => {
  const { html, text } = buildCustomerBulkInquiryEmail(inquiry);
  assert.match(text, /eligibility for our 10% bulk order offer/);
  assert.match(text, /No discount has been applied yet/);
  assert.doesNotMatch(text, /discount (has been|is) (applied|confirmed)\b(?! yet)/i);
  assert.ok(!html.includes('<script>'));
});

test('summary for the admin enquiries list carries the product and quantity', () => {
  const summary = buildBulkInquirySummary({ productName: 'Mug', productId: 'p1', productSku: null, quantity: 80, company: 'Acme', requirements: null });
  assert.equal(summary.subject, 'Bulk Order Inquiry: Mug');
  assert.match(summary.message, /10% OFF BULK ORDER OFFER/);
  assert.match(summary.message, /SKU: Not available/);
  assert.match(summary.message, /Requested quantity: 80/);
});
