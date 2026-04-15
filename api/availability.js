module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const CAL_API_KEY   = process.env.CAL_API_KEY;
  const EVENT_TYPE_ID = process.env.CAL_EVENT_TYPE_ID;
  if (!CAL_API_KEY || !EVENT_TYPE_ID) return res.status(503).json({ error: 'Scheduling not configured' });

  const now = new Date(), end = new Date(now);
  end.setDate(end.getDate() + 3);

  try {
    const url = `https://api.cal.com/v2/slots?eventTypeId=${EVENT_TYPE_ID}&start=${encodeURIComponent(now.toISOString())}&end=${encodeURIComponent(end.toISOString())}&timeZone=America/New_York`;
    const r   = await fetch(url, { headers: { 'Authorization': `Bearer ${CAL_API_KEY}`, 'cal-api-version': '2024-09-04' } });
    if (!r.ok) return res.status(502).json({ error: 'Could not fetch availability' });
    const data  = await r.json();
    const slots = data?.data || {};
    const readable = [];
    for (const [, times] of Object.entries(slots)) {
      for (const slot of times) {
        if (readable.length >= 6) break;
        const d = new Date(slot.start);
        readable.push({
          iso:     slot.start,
          display: d.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric',timeZone:'America/New_York'}) + ' at ' +
                   d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}),
        });
      }
      if (readable.length >= 6) break;
    }
    return res.status(200).json({ slots: readable });
  } catch(err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
