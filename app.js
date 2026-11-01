const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { createMailer, bookingEmail, cancelEmail } = require('./mailer');

// Accounts & bookings live in the user's browser (localStorage); this server only sends the emails.
// That keeps it stateless, so it works fine with multiple pods behind a Kubernetes Service.
function validate(body, { needId = false } = {}) {
  const { name, email, phone, place, slot, id } = body || {};
  const errors = [];
  if (!name || String(name).trim().length < 2) errors.push('name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) errors.push('email');
  if (!needId && !/^[+\d][\d\s-]{7,15}$/.test(phone || '')) errors.push('phone');
  if (!place) errors.push('place');
  const when = new Date(slot);
  if (!slot || isNaN(when)) errors.push('slot');
  else if (!needId && when.getTime() < Date.now() - 60000) errors.push('slot');
  if (needId && !/^DFX-[0-9A-Z]{4,12}$/.test(id || '')) errors.push('id');
  return { errors, when };
}

function createApp({ mailer = createMailer() } = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

  // confirmation email for a new booking
  app.post('/api/bookings', async (req, res) => {
    const { errors, when } = validate(req.body);
    if (errors.length) return res.status(400).json({ error: 'Invalid fields', fields: errors });
    const b = { ...req.body, id: 'DFX-' + crypto.randomBytes(3).toString('hex').toUpperCase(), slot: when.toISOString() };
    let emailSent = false;
    try { emailSent = await mailer.send(bookingEmail(b)); } catch (err) { console.error('Email failed:', err.message); }
    res.status(201).json({ id: b.id, emailSent });
  });

  // cancellation email
  app.post('/api/bookings/cancel', async (req, res) => {
    const { errors, when } = validate(req.body, { needId: true });
    if (errors.length) return res.status(400).json({ error: 'Invalid fields', fields: errors });
    let emailSent = false;
    try { emailSent = await mailer.send(cancelEmail({ ...req.body, slot: when.toISOString() })); } catch (err) { console.error('Email failed:', err.message); }
    res.json({ cancelled: true, emailSent });
  });

  return app;
}

module.exports = { createApp };
