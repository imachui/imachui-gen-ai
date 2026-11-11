// api/health.js — status ng lahat ng AI provider at serbisyo (admin lang)
//   GET  Authorization: Bearer <ADMIN_KEY>
// Gumagawa ng maliit na live test sa bawat provider (halos walang gastos).
// Hindi ipinapakita ang anumang API key.
import { checkAdmin, setCors } from '../lib/auth.js';
import { redis, storeConfigured } from '../lib/store.js';

// Panatilihing pareho ng default sa api/chat.js
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';

const SECRET_ENVS = [
  'DEEPSEEK_API_KEY', 'MISTRAL_API_KEY', 'OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'SERPER_API_KEY',
  'ADMIN_KEY', 'CF_API_TOKEN', 'POLLINATIONS_API_KEY', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN'
];

// Alisin ang anumang secret na nakasama sa teksto, at paikliin
function scrub(text) {
  let s = String(text == null ? '' : text);
  for (const k of SECRET_ENVS) {
    const v = process.env[k];
    if (v && v.length > 6) s = s.split(v).join('[hidden]');
  }
  return s.replace(/\s+/g, ' ').trim().slice(0, 220);
}

function hintFor(status, detail) {
  const d = String(detail || '').toLowerCase();
  if (status === 402) return 'No credit or balance. Top up this provider.';
  if (status === 401 || status === 403) return 'The API key is wrong, expired, or has no permission. Check the key in Vercel.';
  if (status === 404) return 'Model not found or retired. Change the model (environment variable) and redeploy.';
  if (status === 429) return 'Rate limit or free quota reached. Wait a while, or upgrade the plan.';
  if (/insufficient|balance|billing/.test(d)) return 'No credit or balance. Top up this provider.';
  if (status >= 500) return 'The provider is having an outage. Try again later.';
  if (status === 400) return 'The request was rejected. Check the model name.';
  return 'Check the Vercel logs for details.';
}

async function fetchT(url, options = {}, timeout = 9000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function errorText(r) {
  const raw = await r.text().catch(() => '');
  try {
    const j = JSON.parse(raw);
    return (j.error && (j.error.message || j.error)) || j.message || raw;
  } catch (e) {
    return raw;
  }
}

// Isang "check": { name, group, envs, model?, run }
async function runCheck(c) {
  const base = { name: c.name, group: c.group, model: c.model || '' };
  const missing = (c.envs || []).filter((k) => !process.env[k]);
  if (missing.length) return { ...base, configured: false, ok: false, detail: `Not set in Vercel: ${missing.join(', ')}`, hint: '' };
  const t = Date.now();
  try {
    const r = await c.run();
    return {
      ...base, configured: true, ok: r.ok, status: r.status || 0, ms: Date.now() - t,
      detail: scrub(r.detail), hint: r.ok ? (r.hint || '') : hintFor(r.status, r.detail)
    };
  } catch (e) {
    const timedOut = e && e.name === 'AbortError';
    return {
      ...base, configured: true, ok: false, status: 0, ms: Date.now() - t,
      detail: scrub(timedOut ? 'Timed out' : e.message),
      hint: timedOut ? 'The provider is very slow or down.' : 'Network problem. Try again.'
    };
  }
}

// OpenAI-compatible chat (DeepSeek, Mistral, OpenRouter)
const chatCheck = (url, keyEnv, model) => async () => {
  const r = await fetchT(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env[keyEnv]}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with OK' }], max_tokens: 5, stream: false })
  });
  if (r.ok) return { ok: true, status: r.status, detail: 'Working' };
  return { ok: false, status: r.status, detail: await errorText(r) };
};

const CHECKS = [
  {
    name: 'DeepSeek', group: 'AI', envs: ['DEEPSEEK_API_KEY'], model: 'deepseek-chat',
    run: async () => {
      const res = await chatCheck('https://api.deepseek.com/chat/completions', 'DEEPSEEK_API_KEY', 'deepseek-chat')();
      try {
        const b = await fetchT('https://api.deepseek.com/user/balance', { headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` } }, 6000);
        if (b.ok) {
          const j = await b.json();
          const info = j.balance_infos && j.balance_infos[0];
          if (info) res.detail = `${res.ok ? 'Working' : res.detail}. Balance: ${info.total_balance} ${info.currency}`;
        }
      } catch (e) { /* opsyonal */ }
      return res;
    }
  },
  { name: 'Mistral', group: 'AI', envs: ['MISTRAL_API_KEY'], model: 'mistral-small-latest', run: chatCheck('https://api.mistral.ai/v1/chat/completions', 'MISTRAL_API_KEY', 'mistral-small-latest') },
  { name: 'OpenRouter', group: 'AI', envs: ['OPENROUTER_API_KEY'], model: OPENROUTER_MODEL, run: chatCheck('https://openrouter.ai/api/v1/chat/completions', 'OPENROUTER_API_KEY', OPENROUTER_MODEL) },
  {
    name: 'Gemini', group: 'AI', envs: ['GEMINI_API_KEY'], model: GEMINI_MODEL,
    run: async () => {
      const r = await fetchT(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with OK' }] }], generationConfig: { maxOutputTokens: 32 } })
      }, 12000);
      if (r.ok) return { ok: true, status: r.status, detail: 'Working' };
      return { ok: false, status: r.status, detail: await errorText(r) };
    }
  },
  {
    name: 'Serper (web search + news)', group: 'Search', envs: ['SERPER_API_KEY'],
    run: async () => {
      const r = await fetchT('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: 'test', num: 1 })
      });
      if (r.ok) return { ok: true, status: r.status, detail: 'Working (this test used 1 credit)' };
      return { ok: false, status: r.status, detail: await errorText(r) };
    }
  },
  {
    name: 'Redis storage (admin database + feedback)', group: 'Storage',
    envs: storeConfigured() ? [] : ['UPSTASH_REDIS_REST_URL / KV_REST_API_URL'],
    run: async () => {
      const pong = await redis(['PING']);
      return { ok: String(pong).toUpperCase() === 'PONG', status: 200, detail: `Replied: ${pong}` };
    }
  }
];

function imageStatus() {
  const cf = Boolean(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN);
  const pol = Boolean(process.env.POLLINATIONS_API_KEY);
  const parts = [cf ? 'Cloudflare FLUX' : '', pol ? 'Pollinations' : ''].filter(Boolean);
  return {
    name: 'Image generation', group: 'Images', model: '', configured: parts.length > 0, ok: parts.length > 0, status: 0, ms: 0,
    detail: parts.length ? `Configured: ${parts.join(', ')} (not tested, to save credits)` : 'Not set in Vercel: CF_ACCOUNT_ID + CF_API_TOKEN, or POLLINATIONS_API_KEY',
    hint: ''
  };
}

export default async function handler(req, res) {
  setCors(res, 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = checkAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const results = await Promise.all(CHECKS.map(runCheck));
    results.push(imageStatus());
    const ai = results.filter((r) => r.group === 'AI');
    const aiOk = ai.filter((r) => r.ok).length;
    return res.status(200).json({
      checkedAt: new Date().toISOString(),
      summary: { aiOk, aiTotal: ai.length, chatWorks: aiOk > 0 },
      results
    });
  } catch (e) {
    console.error('Health error:', e.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
