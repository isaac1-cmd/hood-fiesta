const { COMPETITIONS, paystack } = require('./_lib');

// Used by the confirmation page to show the result. (Emails are sent by the webhook.)
module.exports = async (req, res) => {
  const reference = String(req.query.reference || '');
  if (!/^HF-[A-Z]{2}-[A-F0-9]{8}$/.test(reference)) return res.status(400).json({ status: 'invalid' });
  try {
    const out = await paystack('/transaction/verify/' + encodeURIComponent(reference));
    if (!out.status) return res.status(404).json({ status: 'invalid' });
    const d = out.data;
    const reg = (d.metadata && d.metadata.registration) || {};
    const comp = COMPETITIONS[reg.competition];
    const ok = d.status === 'success' && comp && d.amount === comp.fee * 100;
    return res.status(200).json({
      status: ok ? 'success' : d.status === 'success' ? 'mismatch' : d.status,
      reference,
      competition: comp && comp.name,
      street: reg.street,
      name: reg.name || reg.contact,
      email: reg.email,
      amount: d.amount / 100,
    });
  } catch (e) {
    return res.status(500).json({ status: 'error' });
  }
};
