module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { call_id, metadata, summary, transcripts, recording_url, call_length, completed } = req.body || {};
  const { leadId, name, phone, service } = metadata || {};

  let bookedTime = null;
  if (Array.isArray(transcripts)) {
    const text = transcripts.map(t=>t.text||'').join(' ');
    const m = text.match(/(?:booked|scheduled|confirmed|locked in) (?:you )?(?:for|at) ([^.!?]{5,60})/i);
    if (m) bookedTime = m[1].trim();
  }

  if (leadId && process.env.SUPABASE_URL) {
    const patch = {
      status: completed ? (bookedTime ? 'booked' : 'call_completed') : 'call_missed',
      ai_response: summary || null,
    };
    if (bookedTime) patch.booking_time = bookedTime;
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
      method: 'PATCH',
      headers: { 'apikey': process.env.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(console.error);
  }

  if (process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL && summary) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'ProShield Pest <leads@resend.dev>',
        to: process.env.NOTIFY_EMAIL,
        subject: `📞 Call Summary: ${name||phone} — ${service||'Pest Control'}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#0f2010;padding:24px;border-radius:12px 12px 0 0">
            <h2 style="color:#4ade80;margin:0;font-size:20px;text-transform:uppercase">Call Summary — Sofia</h2>
            <p style="color:#4b5563;margin:4px 0 0;font-size:13px">ProShield Pest · ${new Date().toLocaleString('en-US',{timeZone:'America/New_York'})}</p>
          </div>
          <div style="background:#f9fff9;padding:24px;border-radius:0 0 12px 12px;border:1px solid #d1fae5">
            <p><strong>Customer:</strong> ${name||'—'}</p>
            <p><strong>Phone:</strong> <a href="tel:${phone}">${phone||'—'}</a></p>
            <p><strong>Status:</strong> ${completed?'✅ Completed':'❌ Missed'}</p>
            <p><strong>Duration:</strong> ${call_length?Math.round(call_length)+' sec':'—'}</p>
            ${bookedTime?`<p><strong>Booked:</strong> 📅 ${bookedTime}</p>`:''}
            <div style="background:#fff;border:1px solid #d1fae5;border-radius:8px;padding:16px;margin-top:16px">
              <p style="margin:0;font-size:14px">${summary}</p>
            </div>
            ${recording_url?`<a href="${recording_url}" style="display:inline-block;margin-top:16px;background:#0f2010;color:#fff;padding:10px 20px;border-radius:8px;font-weight:700;font-size:12px;text-decoration:none">▶ Listen</a>`:''}
            <a href="tel:${phone}" style="display:inline-block;margin-top:12px;background:#16a34a;color:#fff;padding:12px 28px;border-radius:10px;font-weight:900;font-size:13px;text-decoration:none;text-transform:uppercase">Call Back</a>
          </div>
        </div>`,
      }),
    }).catch(console.error);
  }

  return res.status(200).json({ received: true });
};
