const nodemailer = require('nodemailer');

// If SMTP_* env vars are set we send real emails, otherwise we just log (handy for tests/dev).
function createMailer(env = process.env) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return {
      enabled: false,
      async send(msg) { console.log('[mail:disabled] would send to', msg.to, '|', msg.subject); return false; }
    };
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: Number(env.SMTP_PORT) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
  });
  return {
    enabled: true,
    async send(msg) {
      await transport.sendMail({ from: env.MAIL_FROM || `Dateflyx <${env.SMTP_USER}>`, ...msg });
      return true;
    }
  };
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function bookingEmail(b) {
  const when = new Date(b.slot).toLocaleString('en-IN', { weekday:'long', day:'numeric', month:'long', hour:'numeric', minute:'2-digit', timeZone:'Asia/Kolkata' });
  return {
    to: b.email,
    subject: `Your table at ${b.place} is booked 🎉 (${b.id})`,
    text: `Hi ${b.name},\n\nCongratulations! Your booking at ${b.place}${b.area ? ' (' + b.area + ')' : ''} is confirmed for ${when}.\nBooking ID: ${b.id}\n\nWe can't wait for you to have a lovely time.\n\nWith love,\nTeam Dateflyx`,
    html: `<div style="font-family:Georgia,serif;max-width:480px;margin:auto;background:#14110d;color:#f3ece0;padding:32px;border-radius:16px">
      <div style="font-size:30px;color:#d9a860;margin-bottom:4px">Dateflyx</div>
      <div style="font-size:42px;margin:18px 0 6px">✓</div>
      <h2 style="margin:0 0 12px;font-weight:500">Congratulations, ${esc(b.name)}! 🎉</h2>
      <p style="line-height:1.6;color:#cfc4b2">Your table at <b style="color:#f3ece0">${esc(b.place)}</b>${b.area ? ' (' + esc(b.area) + ')' : ''} is all set for <b style="color:#f3ece0">${esc(when)}</b>.</p>
      <p style="background:#1f1a13;border:1px solid #3a2f20;border-radius:10px;padding:12px 16px;color:#d9a860;letter-spacing:.08em">BOOKING ID &nbsp; ${esc(b.id)}</p>
      <p style="line-height:1.6;color:#cfc4b2">Wear your best smile — we'll take care of the rest. 💛</p>
      <p style="color:#8c8272;font-size:13px">With love, Team Dateflyx</p></div>`
  };
}

function cancelEmail(b) {
  const when = new Date(b.slot).toLocaleString('en-IN', { weekday:'long', day:'numeric', month:'long', hour:'numeric', minute:'2-digit', timeZone:'Asia/Kolkata' });
  return {
    to: b.email,
    subject: `Your booking at ${b.place} has been cancelled (${b.id})`,
    text: `Hi ${b.name},\n\nYour booking at ${b.place} for ${when} (ID ${b.id}) has been cancelled.\nNo worries - we'd love to see you another time.\n\nTeam Dateflyx`,
    html: `<div style="font-family:Georgia,serif;max-width:480px;margin:auto;background:#14110d;color:#f3ece0;padding:32px;border-radius:16px">
      <div style="font-size:30px;color:#d9a860">Dateflyx</div>
      <h2 style="font-weight:500">Booking cancelled</h2>
      <p style="line-height:1.6;color:#cfc4b2">Hi ${esc(b.name)}, your booking at <b style="color:#f3ece0">${esc(b.place)}</b> for <b style="color:#f3ece0">${esc(when)}</b> (ID ${esc(b.id)}) has been cancelled.</p>
      <p style="color:#cfc4b2">No worries — we'd love to see you another time. 💛</p></div>`
  };
}

module.exports = { createMailer, bookingEmail, cancelEmail };
