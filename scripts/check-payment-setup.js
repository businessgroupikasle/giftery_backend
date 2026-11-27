/**
 * Checks the Razorpay setup on THIS server and prints what is wrong. Safe to run in production:
 * it reads .env the same way the app does, never prints secrets, and only makes read-only calls.
 *
 *   node scripts/check-payment-setup.js
 *   docker compose exec <backend-service> node scripts/check-payment-setup.js   (Docker)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const ok = (msg) => console.log(`  ✅ ${msg}`);
const bad = (msg) => { console.log(`  ❌ ${msg}`); problems += 1; };
const warn = (msg) => console.log(`  ⚠️  ${msg}`);
let problems = 0;

const mask = (value) => (value ? `${value.slice(0, 13)}…(${value.length} chars)` : '(empty)');
const raw = (name) => process.env[name];

console.log('\n1. Razorpay keys loaded from the environment');
const keyId = raw('RAZORPAY_KEY_ID') || '';
const secret = raw('RAZORPAY_KEY_SECRET') || '';
const webhookSecret = raw('RAZORPAY_WEBHOOK_SECRET') || '';
console.log(`     NODE_ENV=${raw('NODE_ENV') || '(not set)'}  KEY_ID=${mask(keyId)}  SECRET length=${secret.length}`);
if (!keyId || !secret) bad('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set for this process.');
for (const [name, value] of [['RAZORPAY_KEY_ID', keyId], ['RAZORPAY_KEY_SECRET', secret], ['RAZORPAY_WEBHOOK_SECRET', webhookSecret]]) {
  if (value !== value.trim()) bad(`${name} has a space or line break at the start/end. Remove it in .env.`);
  if (/^["']|["']$/.test(value)) bad(`${name} still has quote characters around it. Remove them in .env.`);
}
if (keyId.startsWith('rzp_live_')) ok('Live key ID (rzp_live_…).');
else if (keyId.startsWith('rzp_test_')) warn('This is a TEST key (rzp_test_…). Real customers cannot pay with test keys.');
else if (keyId) bad('Key ID should start with rzp_live_ or rzp_test_.');
if (secret && secret.length < 20) warn(`Secret is only ${secret.length} characters; Razorpay secrets are usually 24. Check it was copied completely.`);

console.log('\n2. Razorpay accepts these keys');
if (keyId && secret) {
  try {
    const res = await fetch('https://api.razorpay.com/v1/orders?count=1', {
      headers: { Authorization: `Basic ${Buffer.from(`${keyId.trim()}:${secret.trim()}`).toString('base64')}` },
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) ok(`Razorpay accepted the key pair (HTTP ${res.status}).`);
    else if (res.status === 401) bad('Razorpay says "Authentication failed": the Key ID and Secret do not match, or the key was regenerated. Copy BOTH again from Dashboard → Account & Settings → API Keys (Live mode).');
    else bad(`Razorpay answered HTTP ${res.status}: ${body?.error?.description || JSON.stringify(body).slice(0, 200)}`);
  } catch (err) {
    bad(`Could not reach api.razorpay.com from this server (${err.message}). Check outbound internet / firewall / DNS on the VPS.`);
  }
} else {
  warn('Skipped: keys missing.');
}

console.log('\n3. Webhook');
if (webhookSecret) ok('RAZORPAY_WEBHOOK_SECRET is set.');
else warn('RAZORPAY_WEBHOOK_SECRET is empty. Payments still work, but an order is lost if the customer closes the tab right after paying. Live-mode webhooks are set up separately from test-mode ones.');

console.log('\n4. Database has the tables the payment code needs');
const prisma = new PrismaClient();
try {
  const columns = await prisma.$queryRaw`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND ((table_name = 'checkout_sessions' AND column_name = 'razorpayOrderId')
        OR (table_name = 'orders' AND column_name = 'orderNumber')
        OR (table_name = 'enquiries' AND column_name = 'type'))`;
  const has = (table, column) => columns.some((c) => c.table_name === table && c.column_name === column);
  if (has('checkout_sessions', 'razorpayOrderId')) ok('checkout_sessions table exists.');
  else bad('checkout_sessions table is MISSING: every Razorpay payment will fail. Deploy the migrations (see below).');
  if (has('orders', 'orderNumber')) ok('orders.orderNumber exists.');
  else bad('orders.orderNumber is MISSING: orders cannot be created.');
  if (has('enquiries', 'type')) ok('enquiries.type exists.');
  else bad('enquiries.type is MISSING: bulk order inquiries will fail.');

  const applied = await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name`;
  console.log(`     Applied migrations: ${applied.map((m) => m.migration_name).join(', ') || '(none)'}`);
} catch (err) {
  bad(`Database check failed: ${err.message.split('\n').filter(Boolean).pop()}`);
} finally {
  await prisma.$disconnect();
}

console.log(problems
  ? `\n${problems} problem(s) found. Fix them, then restart the backend so it reloads .env.\n`
  : '\nEverything needed for Razorpay looks right on this server.\n');
process.exit(problems ? 1 : 0);
