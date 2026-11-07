const crypto = require('crypto');
const { COMPETITIONS, sendConfirmation } = require('./_lib');

const readRaw = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const raw = await readRaw(req);
  const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '').update(raw).digest('hex');
  if (hash !== req.headers['x-paystack-signature']) return res.status(401).end();

  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).end(); }

  if (event.event === 'charge.success') {
    const d = event.data || {};
    const reg = d.metadata && d.metadata.registration;
    const comp = reg && COMPETITIONS[reg.competition];
    if (!comp || d.status !== 'success' || d.amount !== comp.fee * 100 || !/^HF-/.test(d.reference || '')) {
      console.error('Ignoring charge.success that does not match a registration', d.reference);
      return res.status(200).end();
    }
    try {
      await sendConfirmation({ reference: d.reference, amount: d.amount / 100, reg, paidAt: d.paid_at });
    } catch (e) {
      console.error('Confirmation email failed', e.message);
      return res.status(500).end(); // Paystack will retry
    }
  }
  return res.status(200).end();
}

// Paystack signs the RAW body, so Vercel must not parse it first.
handler.config = { api: { bodyParser: false } };
module.exports = handler;
