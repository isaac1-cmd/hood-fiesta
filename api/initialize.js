const { COMPETITIONS, cleanRegistration, makeReference, siteUrl, paystack } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.PAYSTACK_SECRET_KEY) return res.status(500).json({ error: 'Payments are not configured yet' });
  try {
    const reg = cleanRegistration(req.body);
    const comp = COMPETITIONS[reg.competition];
    const reference = makeReference(comp.code);
    const out = await paystack('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: reg.email,
        amount: comp.fee * 100, // kobo – always set on the server
        currency: 'NGN',
        reference,
        callback_url: `${siteUrl(req)}/confirmation`,
        metadata: {
          registration: reg,
          custom_fields: [
            { display_name: 'Competition', variable_name: 'competition', value: comp.name },
            { display_name: 'Street', variable_name: 'street', value: reg.street },
          ],
        },
      }),
    });
    if (!out.status) return res.status(502).json({ error: out.message || 'Could not start payment' });
    return res.status(200).json({ url: out.data.authorization_url, reference });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
};
