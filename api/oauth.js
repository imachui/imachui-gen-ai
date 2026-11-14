// api/oauth.js — sign-in ng mga user sa ibang platform
//   POST {action:'status'}                 -> aling platform ang available at connected
//   POST {action:'start', provider}        -> {url} para sa sign-in popup
//   POST {action:'disconnect', provider}   -> burahin ang token ng user
//   GET  ?code=...&state=...               -> callback ng provider (ito ang Redirect URI)
// Ang "sid" ay nasa body lang (hindi sa URL).
import { setCors, readBody } from '../lib/auth.js';
import {
  SID_RX, PROVIDERS, isProvider, isConfigured, configuredProviders, oauthReady,
  createState, consumeState, buildAuthUrl, completeSignIn, saveTokens, listConnected, disconnect, removeService, frontendUrl,
  cleanServices, servicesFromScope, KEY_PROVIDERS, isKeyProvider, cleanKey, cleanModel, saveUserKey, removeUserKey, listUserKeys, testUserKey
} from '../lib/oauth.js';

// Binabalik ang user sa website (parang ChatGPT): ?oauth=<status>&plugin=<id>
//   ok | partial | denied | error | expired | notready
function backToApp(res, status, plugin) {
  let url;
  try { url = new URL(frontendUrl()); } catch (e) { url = new URL('https://imachui.github.io/imachui-gen-ai/'); }
  url.searchParams.set('oauth', status);
  if (plugin) url.searchParams.set('plugin', plugin);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Location', url.toString());
  res.status(302).end();
}

export default async function handler(req, res) {
  setCors(res, 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ---------- Callback galing sa provider ----------
    if (req.method === 'GET') {
      const q = req.query || {};
      if (!oauthReady()) return backToApp(res, 'notready', '');
      const st = await consumeState(String(q.state || ''));
      if (!st) return backToApp(res, 'expired', '');
      if (q.error) return backToApp(res, 'denied', st.ret);
      if (!isConfigured(st.provider)) return backToApp(res, 'notready', st.ret);

      try {
        const { tokens, label } = await completeSignIn(st.provider, String(q.code || ''));
        const before = (await listConnected(st.sid)).find((c) => c.provider === st.provider);
        const granted = servicesFromScope(st.provider, tokens.scope, st.want.length ? st.want : st.services);
        const services = [...new Set([...(before ? before.services : []), ...granted])];
        await saveTokens(st.sid, st.provider, tokens, label, services);
        // Kung may hiniling na service pero hindi pinayagan ng user: "All permissions are required"
        const missing = st.want.filter((x) => !services.includes(x));
        return backToApp(res, missing.length ? 'partial' : 'ok', st.ret);
      } catch (e) {
        console.error('OAuth callback failed:', st.provider, e.message);
        return backToApp(res, 'error', st.ret);
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
      const want = cleanServices(provider, body.services);
      const services = [...new Set([...(existing ? existing.services : []), ...want])];
      const nonce = await createState(sid, provider, services, want, body.ret);
      return res.status(200).json({ url: buildAuthUrl(provider, nonce, services) });
    }
    if (action === 'disconnect') {
      const service = cleanServices(provider, [body.service])[0];
      if (service) await removeService(sid, provider, service); else await disconnect(sid, provider);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Unknown action.' });
  } catch (e) {
    console.error('OAuth error:', e.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
