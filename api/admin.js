const crypto = require('crypto');
const { COMPETITIONS, paystack } = require('./_lib');

const same = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

// Password-protected list of every PAID registration, read live from Paystack.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass || !process.env.PAYSTACK_SECRET_KEY) {
    return res.status(500).json({ error: 'Admin is not set up. Add ADMIN_PASSWORD in Vercel and redeploy.' });
  }
  if (!same(req.headers['x-admin-password'] || '', pass)) {
    await new Promise((r) => setTimeout(r, 800)); // slows down password guessing
    return res.status(401).json({ error: 'Wrong password.' });
  }

  try {
    const registrations = [];
    for (let page = 1; page <= 20; page++) { // up to 2,000 registrations
      const out = await paystack(`/transaction?status=success&perPage=100&page=${page}`);
      if (!out.status) throw new Error(out.message || 'Paystack error');
      for (const t of out.data) {
        let meta = t.metadata;
        if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = null; } }
        const reg = meta && meta.registration;
        const comp = reg && COMPETITIONS[reg.competition];
        if (!comp || !/^HF-/.test(t.reference || '')) continue; // ignore anything that isn't a Hood Fiesta registration
        registrations.push({
          date: t.paid_at || t.created_at,
          reference: t.reference,
          competition: comp.name,
          code: reg.competition,
          street: reg.street,
          team: reg.team || '',
          name: reg.name || '',
          contact: reg.contact || '',
          phone: reg.phone || '',
          email: reg.email || (t.customer && t.customer.email) || '',
          amount: t.amount / 100,
          age: reg.age || '',
          category: reg.category || '',
          partner: reg.partner || '',
          coach: reg.coach || '',
          players: reg.players || []
        });
      }
      if (out.data.length < 100) break;
    }
    return res.status(200).json({ registrations });
  } catch (e) {
    console.error('Admin load failed', e.message);
    return res.status(502).json({ error: 'Could not load registrations from Paystack.' });
  }
};
