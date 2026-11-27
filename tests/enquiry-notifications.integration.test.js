import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** Minimal local SMTP server that accepts every message and keeps it in memory. */
const startFakeSmtp = () => new Promise((resolve) => {
  const messages = [];
  const server = net.createServer((socket) => {
    let buffer = '';
    let inData = false;
    let message = { to: [], data: '' };
    const reply = (line) => socket.write(`${line}\r\n`);
    reply('220 fake-smtp ready');
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let index;
      while ((index = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            messages.push(message);
            message = { to: [], data: '' };
            reply('250 queued');
          } else {
            message.data += `${line.startsWith('..') ? line.slice(1) : line}\n`;
          }
          continue;
        }
        const command = line.toUpperCase();
        if (command.startsWith('EHLO')) { socket.write('250-fake-smtp\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n'); }
        else if (command.startsWith('HELO')) reply('250 fake-smtp');
        else if (command.startsWith('AUTH PLAIN')) reply('235 ok');
        else if (command.startsWith('AUTH LOGIN')) reply('334 VXNlcm5hbWU6');
        else if (command.startsWith('MAIL FROM')) reply('250 ok');
        else if (command.startsWith('RCPT TO')) { message.to.push(line.replace(/^RCPT TO:\s*<?([^>]*)>?.*$/i, '$1')); reply('250 ok'); }
        else if (command === 'DATA') { inData = true; reply('354 go ahead'); }
        else if (command === 'QUIT') { reply('221 bye'); socket.end(); }
        else if (/^[A-Za-z0-9+/=]+$/.test(line)) reply(line === 'VXNlcm5hbWU6' ? '334 UGFzc3dvcmQ6' : '235 ok'); // AUTH LOGIN steps
        else reply('250 ok');
      }
    });
  });
  server.listen(0, '127.0.0.1', () => resolve({ server, messages, port: server.address().port }));
});

const waitFor = async (check, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
};

// Provision the schema separately with `prisma migrate deploy`; never point this at public.
test('quote and catalogue enquiries email the admin and the customer', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const database = new URL(process.env.TEST_DATABASE_URL);
  assert.match(database.searchParams.get('schema') || '', /^kilo_it_[a-z0-9_]+$/, 'TEST_DATABASE_URL must use an isolated kilo_it_ schema');
  const smtp = await startFakeSmtp();
  Object.assign(process.env, {
    DATABASE_URL: database.toString(),
    NODE_ENV: 'test',
    RATE_LIMIT_MAX: '100000',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(smtp.port),
    SMTP_SECURE: 'false',
    SMTP_USER: 'store@example.invalid',
    SMTP_PASS: 'test',
    ADMIN_NOTIFICATION_EMAIL: 'admin@example.invalid',
    SITE_URL: 'https://shop.example.invalid',
  });
  const directory = await mkdtemp(path.join(os.tmpdir(), 'giftery-enquiry-mail-'));
  process.env.UPLOAD_DIR = path.join(directory, 'uploads');
  process.env.LOG_DIR = path.join(directory, 'logs');
  process.env.PRIVATE_ARTWORK_DIR = path.join(directory, 'artwork');

  const { default: prisma } = await import('../src/config/db.js');
  const { default: app } = await import('../src/app.js');
  const server = app.listen(0);
  const post = (body) => fetch(`http://127.0.0.1:${server.address().port}/api/v1/enquiries`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(async (res) => ({ status: res.status, body: await res.json() }));
  const suffix = randomUUID().slice(0, 8);
  const mailTo = (address) => smtp.messages.filter((m) => m.to.includes(address));

  try {
    const quoteEmail = `quote-${suffix}@example.com`;
    const quote = await post({
      name: 'Priya', email: quoteEmail, phone: '+919876543210',
      subject: 'Product Quote: Steel Water Bottle', message: 'Product: Steel Water Bottle\nQuantity: 40',
    });
    assert.equal(quote.status, 201);
    assert.ok(await waitFor(() => mailTo(quoteEmail).length === 1 && mailTo('admin@example.invalid').length === 1), 'quote mails sent');
    assert.match(mailTo('admin@example.invalid')[0].data, /Subject: New quote request: Steel Water Bottle/);
    assert.match(mailTo(quoteEmail)[0].data, /Subject: We received your quote request/);

    const catalogueEmail = `catalogue-${suffix}@example.com`;
    const catalogue = await post({ name: 'Ravi', email: catalogueEmail, phone: '+919876543211', subject: 'Catalogue Request', message: 'Company: Acme' });
    assert.equal(catalogue.status, 201);
    assert.ok(await waitFor(() => mailTo(catalogueEmail).length === 1 && mailTo('admin@example.invalid').length === 2), 'catalogue mails sent');
    const customerMail = mailTo(catalogueEmail)[0].data.replace(/=\r?\n/g, '');
    assert.match(customerMail, /https:\/\/shop\.example\.invalid\/downloads\/Giftery_Corporate_Catalogue\.pdf/);

    const sentSoFar = smtp.messages.length;
    const contact = await post({ name: 'Anu', email: `contact-${suffix}@example.com`, subject: 'General Inquiry', message: 'Hello' });
    assert.equal(contact.status, 201);
    const appointment = await post({ name: 'Anu', email: `appt-${suffix}@example.com`, subject: 'Studio Appointment: Coimbatore', message: 'Appointment requested for Monday' });
    assert.equal(appointment.status, 201);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    assert.equal(smtp.messages.length, sentSoFar, 'contact messages and appointments send no mail');

    const badAddress = await post({ name: 'X', email: 'not-an-email', subject: 'Catalogue Request', message: 'Company: -' });
    assert.equal(badAddress.status, 201);
    assert.ok(await waitFor(() => mailTo('admin@example.invalid').length === 3), 'admin still hears about it');
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(smtp.messages.filter((m) => m.to.includes('not-an-email')).length, 0, 'no mail to an invalid address');

    await prisma.enquiry.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.enquiry.deleteMany({ where: { email: 'not-an-email' } });
  } finally {
    server.close();
    smtp.server.close();
    await prisma.$disconnect();
  }
});
