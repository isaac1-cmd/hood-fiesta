const crypto = require('crypto');
const nodemailer = require('nodemailer');

// ---- Competitions & fees (server is the source of truth for amounts) ----
const COMPETITIONS = {
  football: { name: 'Football Street Competition', code: 'FB', fee: 20000, venue: 'Rival Zone', when: 'Monday – Tuesday (semi-finals & final on Friday)' },
  swimming: { name: 'Swimming Competition', code: 'SW', fee: 5000, venue: 'Bris Vile Swimming Pool', when: 'Wednesday' },
  snooker: { name: 'Snooker Competition', code: 'SN', fee: 5000, venue: 'First Class', when: 'Thursday' },
  tt: { name: 'Table Tennis Competition', code: 'TT', fee: 5000, venue: 'First Class', when: 'Thursday' },
  boardgames: { name: 'Board Games Competition', code: 'BG', fee: 5000, venue: 'Zuvillah', when: 'Friday' },
};
const BOARD_GAMES = ['Monopoly', 'Chess', 'Scrabble'];
const STREETS = ['Camp David', 'Bris Vile', 'Maryland', 'Nellyview', 'House of Assembly', 'Cheko', 'Mofa', 'Pritazzo Extension'];

const str = (v, max = 120) => String(v == null ? '' : v).trim().slice(0, max);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function cleanRegistration(b) {
  const comp = COMPETITIONS[b && b.competition];
  if (!comp) throw new Error('Unknown competition');
  const r = { competition: b.competition, street: str(b.street), email: str(b.email, 160).toLowerCase(), phone: str(b.phone, 30) };
  if (!STREETS.includes(r.street)) throw new Error('Please choose a valid street');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) throw new Error('Please enter a valid email address');
  if (r.phone.replace(/\D/g, '').length < 7) throw new Error('Please enter a valid phone number');
  if (b.competition === 'football') {
    r.team = str(b.team);
    r.players = (Array.isArray(b.players) ? b.players : []).map((p) => str(p));
    if (r.players.length !== 10 || r.players.some((p) => !p)) throw new Error('Please enter the names of all 10 players');
    r.coach = str(b.coach);
    r.contact = str(b.contact);
    if (!r.contact) throw new Error('Please enter a contact person');
  } else {
    r.name = str(b.name);
    if (!r.name) throw new Error('Please enter your full name');
    if (b.competition === 'swimming') r.age = str(b.age, 3);
    if (b.competition === 'boardgames') {
      r.game = str(b.game, 20);
      if (!BOARD_GAMES.includes(r.game)) throw new Error('Please choose which game you want to play (Monopoly, Chess or Scrabble)');
      r.gender = str(b.gender, 10);
      if (!['Male', 'Female'].includes(r.gender)) throw new Error('Please select Male or Female');
    }
    if (b.competition === 'tt') {
      r.category = b.category === 'Doubles' ? 'Doubles' : 'Singles';
      if (r.category === 'Doubles') {
        r.partner = str(b.partner);
        if (!r.partner) throw new Error("Please enter your doubles partner's full name");
      }
    }
  }
  return r;
}

const registrantName = (r) => r.name || r.contact || 'Participant';

function detailRows(r) {
  const rows = [['Street', r.street]];
  if (r.team) rows.push(['Team name', r.team]);
  if (r.name) rows.push(['Name', r.name]);
  if (r.game) rows.push(['Game', r.game]);
  if (r.gender) rows.push(['Gender', r.gender]);
  if (r.contact) rows.push(['Contact person', r.contact]);
  if (r.age) rows.push(['Age', r.age]);
  if (r.category) rows.push(['Category', r.category]);
  if (r.partner) rows.push(['Doubles partner', r.partner]);
  if (r.players) rows.push(['Players', r.players.map((p, i) => `${i + 1}. ${p}`).join('\n')]);
  if (r.coach) rows.push(['Coach', r.coach]);
  rows.push(['Phone', r.phone], ['Email', r.email]);
  return rows;
}

function makeReference(code) {
  return `HF-${code}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const local = /^(localhost|127\.0\.0\.1)/.test(host);
  return `${local ? 'http' : 'https'}://${host}`;
}

async function paystack(path, opts = {}) {
  const res = await fetch('https://api.paystack.co' + path, {
    ...opts,
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
  });
  return res.json();
}

function transport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '') },
  });
}

const naira = (n) => '₦' + Number(n).toLocaleString('en-NG');

function table(rows) {
  return rows.map(([k, v]) => `<tr><td style="padding:8px 12px;color:#667;font-size:13px;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:8px 12px;font-weight:600;white-space:pre-line">${esc(v)}</td></tr>`).join('');
}

function shell(inner) {
  return `<div style="background:#f3efe2;padding:20px;font-family:Arial,Helvetica,sans-serif"><div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;overflow:hidden">
  <div style="background:#008751;color:#fff;text-align:center;padding:26px 16px"><div style="font-size:11px;letter-spacing:4px;text-transform:uppercase;margin-bottom:6px">Vuzanchi House presents</div><div style="font-size:30px;font-weight:bold;letter-spacing:1px;color:#ffc21a">HOOD FIESTA</div><div style="font-size:13px;letter-spacing:1px">One Neighbourhood. One Community. One Experience.</div></div>
  <div style="height:8px;background:linear-gradient(90deg,#ffc21a,#ff6a1a,#ff2e7e,#18b7e6)"></div>${inner}
  <div style="background:#04321f;color:#b9c9bf;text-align:center;font-size:12px;padding:14px">Questions? WhatsApp 09020757238 · blakmixedentertainment@gmail.com</div></div></div>`;
}

async function sendConfirmation({ reference, amount, reg, paidAt }) {
  const comp = COMPETITIONS[reg.competition];
  const t = transport();
  const from = `"Hood Fiesta" <${process.env.GMAIL_USER}>`;
  const rows = [['Reference no.', reference], ['Competition', comp.name], ['Venue', comp.venue], ['When', comp.when], ['Amount paid', naira(amount)], ...detailRows(reg)];
  const html = shell(`<div style="padding:24px"><h2 style="margin:0 0 8px;color:#008751">Registration confirmed</h2>
   <p style="line-height:1.5">Hi ${esc(registrantName(reg))}, your payment has been received and <b>${esc(reg.street)}</b> is officially registered for the <b>${esc(comp.name)}</b>.</p>
   <div style="background:#fff7dc;border:2px dashed #ffc21a;border-radius:12px;text-align:center;padding:14px;margin:16px 0"><div style="font-size:12px;color:#667">YOUR REFERENCE NUMBER</div><div style="font-size:26px;font-weight:bold;letter-spacing:2px">${esc(reference)}</div></div>
   <p style="line-height:1.5">Please <b>keep this reference number</b> and show it (screenshot or printout) at screening.</p>
   <table style="width:100%;border-collapse:collapse;background:#f7f7f4;border-radius:10px">${table(rows)}</table>
   <p style="line-height:1.5;margin-top:16px">The final timetable depends on the number of registered contestants, so we will contact you on the phone number above with fixtures. See you at the Grand Carnival on Saturday.</p></div>`);
  await t.sendMail({ from, to: reg.email, subject: `Hood Fiesta – Registration confirmed (${reference})`, html });

  const admin = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
  const ahtml = shell(`<div style="padding:24px"><h2 style="margin:0 0 8px;color:#008751">New paid registration</h2><table style="width:100%;border-collapse:collapse;background:#f7f7f4">${table([['Reference', reference], ['Competition', comp.name], ['Amount', naira(amount)], ['Paid at', paidAt || ''], ...detailRows(reg)])}</table></div>`);
  try {
    await t.sendMail({ from, to: admin, subject: `[Hood Fiesta] ${comp.name} – ${reg.street} (${reference})`, html: ahtml });
  } catch (e) {
    console.error('Admin email failed', e.message);
  }
}

module.exports = { COMPETITIONS, cleanRegistration, makeReference, siteUrl, paystack, sendConfirmation };
