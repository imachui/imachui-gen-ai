// api/oauth.js — sign-in ng mga user sa ibang platform
//   POST {action:'status'}                 -> aling platform ang available at connected
//   POST {action:'start', provider}        -> {url} para sa sign-in popup
//   POST {action:'disconnect', provider}   -> burahin ang token ng user
//   GET  ?code=...&state=...               -> callback ng provider (ito ang Redirect URI)
// Ang "sid" ay nasa body lang (hindi sa URL).
import { setCors, readBody } from '../lib/auth.js';
import {
  SID_RX, PROVIDERS, isProvider, isConfigured, configuredProviders, oauthReady,
  createState, consumeState, buildAuthUrl, completeSignIn, saveTokens, listConnected, disconnect, frontendUrl, baseUrl,
  cleanServices, servicesFromScope, KEY_PROVIDERS, isKeyProvider, cleanKey, cleanModel, saveUserKey, removeUserKey, listUserKeys, testUserKey
} from '../lib/oauth.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(res, status, title, message, ok, provider) {
  const origins = JSON.stringify([...new Set(['https://imachui.github.io', baseUrl()])]);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.status(status).send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1020;color:#e5e7eb;font-family:system-ui,sans-serif;text-align:center;padding:24px}
.card{max-width:420px;background:#141b2e;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:28px}
h1{font-size:20px;margin:0 0 10px}p{line-height:1.6;color:#cbd5e1;margin:0 0 16px}a{color:#38bdf8}</style></head>
<body><div class="card"><h1>${ok ? '✅' : '⚠️'} ${esc(title)}</h1><p>${esc(message)}</p>
<p><a href="${esc(frontendUrl())}">Back to Imachui Gen AI</a></p></div>
<script>try{var o=${origins};if(window.opener){o.forEach(function(x){window.opener.postMessage({type:'imachui-oauth',provider:${JSON.stringify(provider || '')},ok:${ok ? 'true' : 'false'}},x);});}}catch(e){}
${ok ? 'setTimeout(function(){try{window.close()}catch(e){}},1800);' : ''}</script></body></html>`);
}

export default async function handler(req, res) {
  setCors(res, 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ---------- Callback galing sa provider ----------
    if (req.method === 'GET') {
      const q = req.query || {};
      if (!oauthReady()) return page(res, 503, 'Not set up', 'Sign-in is not set up on the server yet.', false);
      if (q.error) return page(res, 200, 'Sign-in cancelled', 'No account was connected. You can close this window.', false);

      const st = await consumeState(String(q.state || ''));
      if (!st) return page(res, 400, 'Link expired', 'This sign-in link expired or was already used. Close this window and try again.', false);
      if (!isConfigured(st.provider)) return page(res, 503, 'Not set up', 'This platform is not set up on the server.', false);

      try {
        const { tokens, label } = await completeSignIn(st.provider, String(q.code || ''));
        const before = (await listConnected(st.sid)).find((c) => c.provider === st.provider);
        const granted = servicesFromScope(st.provider, tokens.scope, st.services);
        const services = [...new Set([...(before ? before.services : []), ...granted])];
        await saveTokens(st.sid, st.provider, tokens, label, services);
        return page(res, 200, `${PROVIDERS[st.provider].label} connected`, 'You can close this window and go back to Imachui Gen AI.', true, st.provider);
      } catch (e) {
        console.error('OAuth callback failed:', st.provider, e.message);
        return page(res, 502, 'Could not connect', 'The platform did not accept the sign-in. Close this window and try again.', false, st.provider);
      }
    }

    // ---------- Mga aksyon mula sa app ----------
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const body = readBody(req);
    const action = String(body.action || '');
    const sid = String(body.sid || '');
    const ready = oauthReady();

    if (action === 'status') {
      if (!ready) return res.status(200).json({ ready: false, configured: [], connected: {}, keyProviders: [], keys: {} });
      const configured = configuredProviders().map((id) => ({ id, label: PROVIDERS[id].label, icon: PROVIDERS[id].icon }));
      const keyProviders = Object.entries(KEY_PROVIDERS).map(([id, k]) => ({ id, label: k.label, icon: k.icon, free: k.free, needsModel: k.needsModel, model: k.model, help: k.help }));
      const connected = {};
      let keys = {};
      if (SID_RX.test(sid)) {
        for (const c of await listConnected(sid)) if (isConfigured(c.provider)) connected[c.provider] = { label: c.label, services: c.services };
        keys = await listUserKeys(sid);
      }
      return res.status(200).json({ ready: true, configured, connected, keyProviders, keys });
    }

    if (!ready) return res.status(503).json({ error: 'Sign-in is not set up yet.' });
    if (!SID_RX.test(sid)) return res.status(400).json({ error: 'Invalid session.' });
    const provider = String(body.provider || '');

    // ----- Sariling AI key ng user -----
    if (action === 'savekey') {
      if (!isKeyProvider(provider)) return res.status(400).json({ error: 'This AI is not available.' });
      const key = cleanKey(body.key);
      if (!key) return res.status(400).json({ error: 'That does not look like an API key. Paste it again without spaces.' });
      const kp = KEY_PROVIDERS[provider];
      const model = cleanModel(body.model) || kp.model;
      if (!model) return res.status(400).json({ error: 'Please enter the model name you want to use.' });
      const t = await testUserKey(provider, key, model);
      if (!t.ok) {
        const why = t.status === 401 || t.status === 403 ? `${kp.label} rejected this key. Check that you copied it correctly.`
          : t.status === 404 ? 'The model name was not found. Check the model name.'
          : t.status === 429 ? `The key is valid, but its quota is used up right now. Try again later.`
          : t.status === 402 ? 'This account has no credit or balance.'
          : `Could not verify the key with ${kp.label} right now. Try again.`;
        return res.status(400).json({ error: why });
      }
      await saveUserKey(sid, provider, key, model);
      return res.status(200).json({ ok: true });
    }
    if (action === 'removekey') {
      if (!isKeyProvider(provider)) return res.status(400).json({ error: 'This AI is not available.' });
      await removeUserKey(sid, provider);
      return res.status(200).json({ ok: true });
    }

    // ----- Sign-in sa ibang platform -----
    if (!isProvider(provider) || !isConfigured(provider)) return res.status(400).json({ error: 'This platform is not available.' });

    if (action === 'start') {
      const existing = (await listConnected(sid)).find((c) => c.provider === provider);
      const services = [...new Set([...(existing ? existing.services : []), ...cleanServices(provider, body.services)])];
      const nonce = await createState(sid, provider, services);
      return res.status(200).json({ url: buildAuthUrl(provider, nonce, services) });
    }
    if (action === 'disconnect') {
      await disconnect(sid, provider);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Unknown action.' });
  } catch (e) {
    console.error('OAuth error:', e.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
