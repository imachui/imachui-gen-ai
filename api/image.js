// api/image.js — Image generation (walang anonymous Pollinations)
// Gagamit lang ng provider na may naka-set na key sa Vercel:
//   1) Cloudflare Workers AI : CF_ACCOUNT_ID + CF_API_TOKEN
//   2) Pollinations (may key): POLLINATIONS_API_KEY  (opsyonal: POLLINATIONS_MODEL, default "flux")
// Opsyonal: ang prompt ay ina-translate at pinapaganda muna ng AI (DeepSeek o Mistral) para mas maganda ang larawan.

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 25000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(resource, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// Gawing detalyadong English prompt (mas magaling ang image models sa English)
async function enhancePrompt(userPrompt) {
  const providers = [
    { key: 'DEEPSEEK_API_KEY', url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
    { key: 'MISTRAL_API_KEY', url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest' }
  ];
  for (const p of providers) {
    if (!process.env[p.key]) continue;
    try {
      const r = await fetchWithTimeout(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env[p.key]}` },
        body: JSON.stringify({
          model: p.model,
          temperature: 0.7,
          max_tokens: 200,
          messages: [
            {
              role: 'system',
              content: 'You write prompts for an AI image generator. Translate the user idea into English if needed, then rewrite it as ONE vivid, detailed prompt (max 70 words): subject, setting, style, lighting, camera or composition, and mood. Keep the user\'s idea exactly; do not add text or logos to the image. Output only the prompt, nothing else.'
            },
            { role: 'user', content: userPrompt }
          ]
        }),
        timeout: 7000
      });
      if (!r.ok) continue;
      const data = await r.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text && text.length > 5) return text.replace(/^["']|["']$/g, '');
    } catch (e) {
      console.error('Enhance failed:', e.message);
    }
  }
  return userPrompt;
}

async function cloudflareImage(prompt) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
  const r = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, steps: 4 }),
    timeout: 40000
  });
  const data = await r.json().catch(() => ({}));
  const b64 = data?.result?.image;
  if (!r.ok || !b64) {
    throw new Error('Cloudflare: ' + (data?.errors?.[0]?.message || `status ${r.status}`));
  }
  return `data:image/jpeg;base64,${b64}`;
}

async function pollinationsImage(prompt) {
  const model = process.env.POLLINATIONS_MODEL || 'flux';
  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=${encodeURIComponent(model)}&width=1024&height=1024&nologo=true&key=${encodeURIComponent(process.env.POLLINATIONS_API_KEY)}`;
  const r = await fetchWithTimeout(url, { timeout: 45000 });
  const type = r.headers.get('content-type') || '';
  if (!r.ok || !type.startsWith('image/')) {
    throw new Error(`Pollinations: status ${r.status}`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  return `data:${type.split(';')[0]};base64,${buf.toString('base64')}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requests only.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const userPrompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, 1000) : '';
  if (!userPrompt) return res.status(400).json({ error: 'Enter an image description.' });

  const engines = [];
  if (process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) engines.push({ name: 'Cloudflare FLUX', run: cloudflareImage });
  if (process.env.POLLINATIONS_API_KEY) engines.push({ name: 'Pollinations', run: pollinationsImage });

  if (!engines.length) {
    return res.status(503).json({
      error: 'Image generation is not configured. Add CF_ACCOUNT_ID and CF_API_TOKEN, or POLLINATIONS_API_KEY, in Vercel.'
    });
  }

  const prompt = await enhancePrompt(userPrompt);
  const errors = [];

  for (const engine of engines) {
    try {
      const image = await engine.run(prompt);
      return res.status(200).json({ success: true, provider: engine.name, prompt, image });
    } catch (e) {
      console.error(`${engine.name} failed:`, e.message);
      errors.push(e.message);
    }
  }

  return res.status(502).json({ error: 'Image generation is unavailable right now.', details: errors.join(' | ').slice(0, 300) });
}
