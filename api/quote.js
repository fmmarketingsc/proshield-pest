module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { pestType, issue, homeSize, severity } = req.body || {};
  if (!issue) return res.status(400).json({ error: 'issue description required' });

  const systemPrompt = `You are an expert pest control estimator. Based on the pest and issue described, provide a concise estimate in this exact JSON format:
{
  "range": "$X – $Y",
  "mostLikely": "One sentence on the most probable treatment needed",
  "urgency": "low" | "medium" | "high" | "emergency",
  "note": "One short sentence of practical advice"
}

Use realistic 2024 US market pricing. Set urgency to "emergency" for: active rodent infestations near food, severe bed bug infestations, termite damage. Always recommend a professional inspection for anything over $200. Return only valid JSON.`;

  const userContent = `Pest type: ${pestType||'Unknown'}, Home size: ${homeSize||'Unknown'}, Severity: ${severity||'Unknown'}, Issue: ${issue}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
        max_tokens: 200, temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) return res.status(502).json({ error: 'AI service unavailable' });
    const data     = await response.json();
    const estimate = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    return res.status(200).json({ success: true, estimate });
  } catch(err) {
    console.error('Quote error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
