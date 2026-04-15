module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'id is required' });

  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (req.method === 'GET') {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/leads?id=eq.${id}&select=id,name,phone,email,service,address,system_type,message,status`, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
    });
    const rows = await r.json();
    if (!rows?.length) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json({ lead: rows[0] });
  }

  if (req.method === 'PATCH') {
    const { name, phone, email, service, address, pestType, message } = req.body || {};
    const patch = {};
    if (name)     patch.name        = name;
    if (phone)    patch.phone       = phone;
    if (email)    patch.email       = email;
    if (service)  patch.service     = service;
    if (address)  patch.address     = address;
    if (pestType) patch.system_type = pestType;
    if (message)  patch.message     = message;
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
