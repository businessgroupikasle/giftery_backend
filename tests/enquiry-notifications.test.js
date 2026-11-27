import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminEnquiryEmail, buildCustomerEnquiryEmail, classifyEnquiry } from '../src/helpers/email.js';

test('quote and catalogue enquiries send mail; contact messages and appointments do not', () => {
  assert.equal(classifyEnquiry({ subject: 'Product Quote: Steel Water Bottle' }), 'QUOTE');
  assert.equal(classifyEnquiry({ subject: 'Catalogue Request' }), 'CATALOGUE');
  assert.equal(classifyEnquiry({ subject: 'Corporate Catalogue Request' }), 'CATALOGUE');
  assert.equal(classifyEnquiry({ subject: 'General Inquiry' }), null);
  assert.equal(classifyEnquiry({ subject: 'Studio Appointment: Coimbatore' }), null);
  assert.equal(classifyEnquiry({}), null);
});

const quote = {
  id: 'ENQ-2026-0007',
  name: 'Priya <b>',
  email: 'priya@example.com',
  phone: '+919876543210',
  subject: 'Product Quote: Steel Water Bottle',
  message: 'Product: Steel Water Bottle\nQuantity: 40\nCompany: Acme',
  createdAt: new Date('2026-11-27T06:30:00Z'),
};

test('admin quote email carries the customer and request details', () => {
  const { subject, html, text } = buildAdminEnquiryEmail(quote, 'QUOTE');
  assert.equal(subject, 'New quote request: Steel Water Bottle (ENQ-2026-0007)');
  for (const expected of ['Quote request', 'priya@example.com', '+919876543210', 'Quantity: 40', '27 Nov 2026']) {
    assert.ok(text.includes(expected), expected);
  }
  assert.ok(html.includes('Priya &lt;b&gt;'), 'customer input is escaped');
});

test('customer quote email confirms the request', () => {
  const { subject, text } = buildCustomerEnquiryEmail(quote, 'QUOTE');
  assert.equal(subject, 'We received your quote request (ENQ-2026-0007)');
  assert.match(text, /contact you shortly with pricing/);
  assert.match(text, /Product: Steel Water Bottle/);
});

test('customer catalogue email links the PDF when the site address is set', () => {
  const catalogue = { ...quote, subject: 'Catalogue Request', message: 'Company: Acme' };
  const withLink = buildCustomerEnquiryEmail(catalogue, 'CATALOGUE', 'https://gifterys.com/');
  assert.equal(withLink.subject, 'Your Giftery corporate gifting catalogue');
  assert.match(withLink.text, /https:\/\/gifterys\.com\/downloads\/Giftery_Corporate_Catalogue\.pdf/);
  assert.match(withLink.html, /Download the catalogue \(PDF\)/);
  const withoutLink = buildCustomerEnquiryEmail(catalogue, 'CATALOGUE', undefined);
  assert.doesNotMatch(withoutLink.text, /downloads\//);
  assert.match(buildAdminEnquiryEmail(catalogue, 'CATALOGUE').subject, /^New catalogue download: Priya <b> \(ENQ-2026-0007\)$/);
});
