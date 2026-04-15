module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages } = req.body || {};
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  const systemPrompt = `You are a friendly pest control expert at ProShield Pest Control. Help customers identify pest problems and give honest advice.

Services & pricing (ballpark):
- General pest treatment: $120–$250
- Rodent control: $200–$500
- Termite treatment: $500–$2,500
- Bed bug treatment: $400–$1,500
- Mosquito control: $75–$150/month
- Cockroach treatment: $150–$350
- Ant control: $100–$200

Rules:
- Keep answers short and helpful (2-4 sentences)
- Always recommend a professional inspection for anything over $200
- If it sounds urgent (active infestation, rodents near food, bed bugs), escalate: "This sounds urgent — let me have a specialist call you right away."
- Collect name + phone if they want to book
- Never diagnose with certainty without an inspection`;

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
        messages: [{ role:'system', content:systemPrompt }, ...messages],
        max_tokens: 200, temperature: 0.7,
      }),
    });
    if (!response.ok) return res.status(502).json({ error: 'AI unavailable' });
    const data  = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Let me connect you with a specialist.";
    return res.status(200).json({ reply });
  } catch(err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
