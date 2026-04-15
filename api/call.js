module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { name, phone, service, address, pestType, message, leadId } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  let slotsText = "I don't have the schedule pulled up right now, but someone will call you back to confirm a time.";
  try {
    const slotRes = await fetch('https://proshield-pest.vercel.app/api/availability');
    if (slotRes.ok) {
      const { slots } = await slotRes.json();
      if (slots?.length) {
        slotsText = `Our next available times are: ${slots.slice(0,4).map(s=>s.display).join(', ')}. Which works for you?`;
      }
    }
  } catch(_) {}

  const task = `You are Sofia from ProShield Pest Control. Keep this call under 2 minutes — the customer has a pest problem and wants it solved fast.

Be warm, calm, direct. Here's what to do:

1. Say hi, confirm you're speaking with ${name || 'the customer'}, mention their request for ${service || 'pest control service'}.
2. Ask just 2 quick questions:
   - "What exactly are you seeing — and where in the home?"
   - "How long has this been going on?"
3. Give a quick honest ballpark based on what they say.
4. Ask if they want to book a technician — if yes, say: "${slotsText}"
5. Once they pick a time, confirm: "Perfect, you're booked for [time]. Confirm your address is ${address || 'on file'}?"
6. Wrap up warmly.

Rules:
- Sound human, never scripted
- If it's an emergency (rodents with kids, severe infestation, bed bugs) offer same-day immediately
- No upselling, no pressure
- Voicemail: "Hey ${name?.split(' ')[0] || 'there'}, this is Sofia from ProShield Pest Control calling about your service request. Give us a call back whenever you're free."

Customer: ${name}, Phone: ${phone}, Pest: ${pestType || 'unknown'}, Issue: "${message || service || 'not specified'}"`;

  try {
    const response = await fetch('https://api.bland.ai/v1/calls', {
      method: 'POST',
      headers: { 'authorization': process.env.BLAND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone_number: phone,
        from: process.env.BLAND_PHONE_NUMBER,
        task,
        voice: 'maya',
        wait_for_greeting: true,
        record: true,
        amd: true,
        interruption_threshold: 150,
        temperature: 0.7,
        max_duration: 4,
        webhook: 'https://proshield-pest.vercel.app/api/call-complete',
        metadata: { leadId, name, phone, service },
        request_data: { leadId, name, service },
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: 'Failed to initiate call', details: data });

    if (leadId && process.env.SUPABASE_URL) {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
        method: 'PATCH',
        headers: { 'apikey': process.env.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'call_initiated' }),
      }).catch(console.error);
    }

    return res.status(200).json({ success: true, callId: data.call_id });
  } catch(err) {
    console.error('Call handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
