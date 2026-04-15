module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });

  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/leads?order=created_at.desc&limit=200&select=*`, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
    });
    if (!r.ok) return res.status(502).json({ error: 'Failed to fetch leads' });
    return res.status(200).json({ leads: await r.json() });
  } catch(err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
