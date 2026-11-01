const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../app');

async function start(mailer) {
  const server = createApp({ mailer }).listen(0);
  await new Promise(r => server.once('listening', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
const future = () => new Date(Date.now() + 86400000).toISOString();
const post = (base, body) => fetch(base + '/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('healthz returns ok', async () => {
  const { server, base } = await start({ send: async () => false });
  const r = await fetch(base + '/healthz');
  assert.strictEqual((await r.json()).status, 'ok');
  server.close();
});

test('valid booking is created and email is sent', async () => {
  const sent = [];
  const { server, base } = await start({ send: async m => { sent.push(m); return true; } });
  const r = await post(base, { name: 'Asha', email: 'asha@example.com', phone: '+91 98765 43210', place: 'Kasol Cafe', slot: future() });
  const body = await r.json();
  assert.strictEqual(r.status, 201);
  assert.match(body.id, /^DFX-[0-9A-F]{6}$/);
  assert.strictEqual(body.emailSent, true);
  assert.strictEqual(sent[0].to, 'asha@example.com');
  server.close();
});

test('invalid booking is rejected', async () => {
  const { server, base } = await start({ send: async () => true });
  const r = await post(base, { name: 'A', email: 'nope', phone: '1', slot: 'x' });
  assert.strictEqual(r.status, 400);
  server.close();
});

test('booking still succeeds if email provider fails', async () => {
  const { server, base } = await start({ send: async () => { throw new Error('smtp down'); } });
  const r = await post(base, { name: 'Ravi', email: 'r@example.com', phone: '9876543210', place: 'Mimi Cafe', slot: future() });
  assert.strictEqual(r.status, 201);
  assert.strictEqual((await r.json()).emailSent, false);
  server.close();
});

test('cancel sends a cancellation email', async () => {
  const sent = [];
  const { server, base } = await start({ send: async m => { sent.push(m); return true; } });
  const r = await fetch(base + '/api/bookings/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'DFX-AB12CD', name: 'Asha', email: 'asha@example.com', place: 'Kasol Cafe', slot: future() }) });
  assert.strictEqual(r.status, 200);
  assert.match(sent[0].subject, /cancelled/);
  server.close();
});

test('cancel rejects a bad booking id', async () => {
  const { server, base } = await start({ send: async () => true });
  const r = await fetch(base + '/api/bookings/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'bad', name: 'Asha', email: 'asha@example.com', place: 'Kasol Cafe', slot: future() }) });
  assert.strictEqual(r.status, 400);
  server.close();
});
