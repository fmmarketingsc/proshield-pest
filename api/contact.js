module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { name, phone, email, service, address, pestType, message } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: 'name and phone are required' });

  const systemPrompt = `You are writing a warm, personalized confirmation message for ProShield Pest Control, a top-rated exterminator. Based on the service request, write exactly 2 sentences: first acknowledge their specific pest issue warmly, then tell them a specialist will call within 15 minutes to confirm. Be specific, genuine, and professional. No generic lines.`;
  const userContent  = `Customer: ${name}, Phone: ${phone}, Email: ${email||'not provided'}, Service: ${service||'General pest control'}, Address: ${address||'not provided'}, Pest type: ${pestType||'not specified'}, Message: "${message||'no message'}". Write the personalized confirmation now.`;

  let confirmationMessage = `Thanks ${name}! We've received your service request and a specialist will call you at ${phone} within 15 minutes to confirm your appointment.`;
  let savedId = null;

  try {
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://proshield-pest.vercel.app',
        'X-Title': 'ProShield Pest Control',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{ role:'system', content:systemPrompt }, { role:'user', content:userContent }],
        max_tokens: 120, temperature: 0.7,
      }),
    });
    if (aiRes.ok) {
      const d = await aiRes.json();
      const t = d.choices?.[0]?.message?.content;
      if (t) confirmationMessage = t;
    }
  } catch(e) { console.error('AI error:', e); }

  try {
    const sbRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        name, phone,
        email:       email    || null,
        service:     service  || null,
        address:     address  || null,
        system_type: pestType || null,
        message:     message  || null,
        ai_response: confirmationMessage,
        status: 'new',
      }),
    });
    if (sbRes.ok) { const rows = await sbRes.json(); savedId = rows?.[0]?.id || null; }
  } catch(e) { console.error('Supabase error:', e); }

  if (process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'ProShield Pest <leads@resend.dev>',
          to: process.env.NOTIFY_EMAIL,
          subject: `🐛 New Lead: ${name} — ${service || 'General Inquiry'}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#0f2010;padding:24px;border-radius:12px 12px 0 0">
              <h2 style="color:#4ade80;margin:0;font-size:20px;text-transform:uppercase">New Service Request</h2>
              <p style="color:#4b5563;margin:4px 0 0;font-size:13px">ProShield Pest Control — ${new Date().toLocaleString('en-US',{timeZone:'America/New_York'})}</p>
            </div>
            <div style="background:#f9fff9;padding:24px;border-radius:0 0 12px 12px;border:1px solid #d1fae5">
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <tr><td style="padding:8px 0;color:#6b7280;width:120px">Name</td><td style="padding:8px 0;font-weight:700">${name}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280">Phone</td><td style="padding:8px 0;font-weight:700"><a href="tel:${phone}" style="color:#15803d">${phone}</a></td></tr>
                <tr><td style="padding:8px 0;color:#6b7280">Service</td><td style="padding:8px 0;font-weight:700">${service||'—'}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280">Pest Type</td><td style="padding:8px 0;font-weight:700">${pestType||'—'}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280">Address</td><td style="padding:8px 0;font-weight:700">${address||'—'}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;vertical-align:top">Message</td><td style="padding:8px 0">${message||'—'}</td></tr>
              </table>
              <a href="tel:${phone}" style="display:inline-block;margin-top:20px;background:#16a34a;color:#fff;padding:12px 28px;border-radius:10px;font-weight:900;font-size:13px;text-decoration:none;text-transform:uppercase">Call ${name} Now</a>
            </div>
          </div>`,
        }),
      });
    } catch(e) { console.error('Resend error:', e); }
  }

  if (process.env.RESEND_API_KEY && email && savedId) {
    const editUrl = `https://proshield-pest.vercel.app/edit?id=${savedId}`;
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'ProShield Pest <leads@resend.dev>',
          to: email,
          subject: `We got your request, ${name.split(' ')[0]}! ✅`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0b1a0e;border-radius:16px;overflow:hidden">
            <div style="padding:32px 24px;background:#16a34a;text-align:center">
              <h1 style="margin:0;color:#fff;font-size:22px;font-weight:900">You're on our list, ${name.split(' ')[0]}!</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,.8);font-size:14px">ProShield Pest Control</p>
            </div>
            <div style="padding:28px 24px">
              <p style="color:#c0cce0;font-size:15px;line-height:1.6;margin:0 0 24px">${confirmationMessage}</p>
              <div style="text-align:center;margin-bottom:24px">
                <p style="color:#4b5563;font-size:13px;margin:0 0 12px">Something wrong? Fix it before we call.</p>
                <a href="${editUrl}" style="display:inline-block;background:#0b1a0e;border:2px solid #4ade80;color:#4ade80;padding:12px 28px;border-radius:10px;font-weight:900;font-size:13px;text-decoration:none;text-transform:uppercase">Edit My Request</a>
              </div>
            </div>
          </div>`,
        }),
      });
    } catch(e) { console.error('Customer email error:', e); }
  }

  return res.status(200).json({ success:true, message:confirmationMessage, leadId:savedId, submittedAt:new Date().toISOString() });
};
