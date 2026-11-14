// lib/oauth.js — sign-in ng mga user sa Google, GitHub, Notion, Microsoft (read-only na paggamit)
//
// DISENYO (para ligtas):
//  - Ang token ng user ay naka-encrypt (AES-256-GCM) sa Redis gamit ang OAUTH_SECRET. Kapag nakuha ng iba
//    ang Redis, hindi nila mababasa ang token kung wala ang OAUTH_SECRET.
//  - Ang user ay kinikilala ng random "sid" (32 hex) na nasa device niya. Hindi ito inilalagay sa URL.
//  - Ang "state" ng OAuth ay random na nonce na naka-save sa Redis ng 10 minuto at isang beses lang magagamit.
//  - Ang app ay READ-ONLY: walang code na nagpapadala, nag-e-edit, o nagbubura sa account ng user.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { redis, storeConfigured } from './store.js';

export const SID_RX = /^[a-f0-9]{32}$/;
const TOKENS_KEY = (sid) => `imachui:oauth:${sid}`;
const STATE_KEY = (nonce) => `imachui:oauthstate:${nonce}`;

export const baseUrl = () => String(process.env.OAUTH_BASE_URL || 'https://imachui-gen-ai.vercel.app').replace(/\/+$/, '');
export const redirectUri = () => `${baseUrl()}/api/oauth`;
export const frontendUrl = () => process.env.FRONTEND_URL || 'https://imachui.github.io/imachui-gen-ai/';

const secretOk = () => String(process.env.OAUTH_SECRET || '').length >= 24;
export const oauthReady = () => storeConfigured() && secretOk();

// ---------- Encryption ----------
const encKey = () => createHash('sha256').update('imachui-oauth-v1|' + process.env.OAUTH_SECRET).digest();

function encrypt(obj) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', encKey(), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return 'v1:' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

function decrypt(text) {
  try {
    if (!String(text).startsWith('v1:')) return null;
    const b = Buffer.from(String(text).slice(3), 'base64');
    const d = createDecipheriv('aes-256-gcm', encKey(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'));
  } catch (e) {
    return null;
  }
}

// ---------- Mga provider ----------
// "services" = hiwa-hiwalay na pahintulot (hal. Gmail lang, o Gmail + Calendar). Pipili ang user ng bawat isa.
const GOOGLE_SERVICES = {
  gmail: 'https://www.googleapis.com/auth/gmail.readonly',
  drive: 'https://www.googleapis.com/auth/drive.readonly',
  calendar: 'https://www.googleapis.com/auth/calendar.readonly',
  youtube: 'https://www.googleapis.com/auth/youtube.readonly'
};
const MS_SERVICES = { mail: 'Mail.Read', calendar: 'Calendars.Read' };

export const PROVIDERS = {
  google: {
    label: 'Google', icon: '🟢',
    idEnv: 'GOOGLE_CLIENT_ID', secretEnv: 'GOOGLE_CLIENT_SECRET',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    baseScopes: ['openid', 'email'],
    services: GOOGLE_SERVICES,
    extra: { access_type: 'offline', prompt: 'select_account consent', include_granted_scopes: 'true' }
  },
  github: {
    label: 'GitHub', icon: '🐙',
    idEnv: 'GITHUB_CLIENT_ID', secretEnv: 'GITHUB_CLIENT_SECRET',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    baseScopes: ['repo', 'read:user'],
    extra: {}
  },
  notion: {
    label: 'Notion', icon: '📓',
    idEnv: 'NOTION_CLIENT_ID', secretEnv: 'NOTION_CLIENT_SECRET',
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    tokenJson: true,
    baseScopes: [],
    extra: { owner: 'user' }
  },
  microsoft: {
    label: 'Microsoft', icon: '🪟',
    idEnv: 'MICROSOFT_CLIENT_ID', secretEnv: 'MICROSOFT_CLIENT_SECRET',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    baseScopes: ['offline_access', 'User.Read'],
    services: MS_SERVICES,
    extra: { prompt: 'select_account' }
  }
};

export const isProvider = (id) => Object.prototype.hasOwnProperty.call(PROVIDERS, id);
const creds = (id) => ({ id: process.env[PROVIDERS[id].idEnv] || '', secret: process.env[PROVIDERS[id].secretEnv] || '' });
export const isConfigured = (id) => isProvider(id) && Boolean(creds(id).id && creds(id).secret);
export const configuredProviders = () => Object.keys(PROVIDERS).filter(isConfigured);

export const cleanServices = (provider, list) => {
  const map = (PROVIDERS[provider] && PROVIDERS[provider].services) || {};
  return [...new Set((Array.isArray(list) ? list : []).map(String).filter((x) => Object.prototype.hasOwnProperty.call(map, x)))];
};

export function buildAuthUrl(provider, nonce, services = []) {
  const p = PROVIDERS[provider];
  const q = new URLSearchParams({
    client_id: creds(provider).id,
    redirect_uri: redirectUri(),
    response_type: 'code',
    state: nonce,
    ...p.extra
  });
  const scopes = [...p.baseScopes];
  if (p.services) {
    const chosen = cleanServices(provider, services);
    for (const sv of (chosen.length ? chosen : Object.keys(p.services))) scopes.push(p.services[sv]);
  }
  if (scopes.length) q.set('scope', scopes.join(' '));
  return `${p.authUrl}?${q.toString()}`;
}

// Alin sa mga service ang pinayagan, base sa "scope" na ibinalik ng provider
export function servicesFromScope(provider, scope, fallback = []) {
  const map = (PROVIDERS[provider] && PROVIDERS[provider].services) || {};
  const have = String(scope || '').toLowerCase();
  if (!have) return cleanServices(provider, fallback);
  return Object.keys(map).filter((k) => have.includes(String(map[k]).toLowerCase()));
}

// ---------- Token requests ----------
async function tokenRequest(provider, params) {
  const p = PROVIDERS[provider];
  const { id, secret } = creds(provider);
  const headers = { Accept: 'application/json' };
  let body;
  if (p.tokenJson) {
    headers['Content-Type'] = 'application/json';
    headers.Authorization = 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
    body = JSON.stringify(params);
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams({ client_id: id, client_secret: secret, ...params }).toString();
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const r = await fetch(p.tokenUrl, { method: 'POST', headers, body, signal: controller.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error || !j.access_token) throw new Error(`Token request failed: ${String(j.error || r.status).slice(0, 60)}`);
    return j;
  } finally {
    clearTimeout(timer);
  }
}

const norm = (j, prev = {}) => ({
  access_token: j.access_token,
  refresh_token: j.refresh_token || prev.refresh_token || '',
  expires_at: j.expires_in ? Date.now() + Number(j.expires_in) * 1000 : 0,
  scope: j.scope || prev.scope || ''
});

async function getJson(url, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': 'ImachuiGenAI' }, signal: controller.signal });
    return r.ok ? await r.json() : null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Pangalan ng account na ipapakita sa user (hal. email). Opsyonal lang.
async function describeAccount(provider, j) {
  try {
    if (provider === 'google' && j.id_token) {
      const payload = JSON.parse(Buffer.from(j.id_token.split('.')[1], 'base64url').toString('utf8'));
      return String(payload.email || '').slice(0, 80);
    }
    if (provider === 'github') return String((await getJson('https://api.github.com/user', j.access_token))?.login || '').slice(0, 80);
    if (provider === 'notion') return String(j.workspace_name || j.owner?.user?.name || '').slice(0, 80);
    if (provider === 'microsoft') {
      const me = await getJson('https://graph.microsoft.com/v1.0/me', j.access_token);
      return String(me?.mail || me?.userPrincipalName || '').slice(0, 80);
    }
  } catch (e) { /* opsyonal */ }
  return '';
}

export async function completeSignIn(provider, code) {
  const j = await tokenRequest(provider, { grant_type: 'authorization_code', code, redirect_uri: redirectUri() });
  return { tokens: norm(j), label: await describeAccount(provider, j) };
}

// ---------- Redis: state at tokens ----------
export async function createState(sid, provider, services = [], want = [], ret = '') {
  const nonce = randomBytes(24).toString('hex');
  await redis(['SET', STATE_KEY(nonce), JSON.stringify({ sid, provider, services: cleanServices(provider, services), want: cleanServices(provider, want), ret: String(ret || '').replace(/[^a-z0-9-]/g, '').slice(0, 24) }), 'EX', 600]);
  return nonce;
}

export async function consumeState(nonce) {
  if (!/^[a-f0-9]{48}$/.test(String(nonce || ''))) return null;
  const raw = await redis(['GET', STATE_KEY(nonce)]);
  if (!raw) return null;
  await redis(['DEL', STATE_KEY(nonce)]).catch(() => {});
  try {
    const st = JSON.parse(raw);
    return SID_RX.test(st.sid) && isProvider(st.provider) ? { ...st, services: cleanServices(st.provider, st.services), want: cleanServices(st.provider, st.want), ret: String(st.ret || '').replace(/[^a-z0-9-]/g, '').slice(0, 24) } : null;
  } catch (e) { return null; }
}

export async function saveTokens(sid, provider, tokens, label, services = []) {
  await redis(['HSET', TOKENS_KEY(sid), provider, encrypt({ ...tokens, label: label || '', services: cleanServices(provider, services), connectedAt: Date.now() })]);
}

async function loadTokens(sid, provider) {
  if (!oauthReady() || !SID_RX.test(sid) || !isProvider(provider)) return null;
  const raw = await redis(['HGET', TOKENS_KEY(sid), provider]).catch(() => null);
  return raw ? decrypt(raw) : null;
}

export async function listConnected(sid) {
  if (!oauthReady() || !SID_RX.test(sid)) return [];
  const flat = await redis(['HGETALL', TOKENS_KEY(sid)]).catch(() => []);
  const out = [];
  for (let i = 0; Array.isArray(flat) && i + 1 < flat.length; i += 2) {
    const t = decrypt(flat[i + 1]);
    if (t && isProvider(flat[i])) out.push({ provider: flat[i], label: t.label || '', services: Array.isArray(t.services) ? t.services : [] });
  }
  return out;
}

// Connection na may auto-refresh ng token: { access_token, services, label } o null
export async function getConnection(sid, provider) {
  const t = await loadTokens(sid, provider);
  if (!t || !t.access_token) return null;
  const services = Array.isArray(t.services) ? t.services : [];
  if (!t.expires_at || t.expires_at - 60000 > Date.now()) return { access_token: t.access_token, services, label: t.label || '' };
  if (!t.refresh_token) return null;
  try {
    const j = await tokenRequest(provider, { grant_type: 'refresh_token', refresh_token: t.refresh_token });
    const fresh = { ...t, ...norm(j, t) };
    await redis(['HSET', TOKENS_KEY(sid), provider, encrypt(fresh)]);
    return { access_token: fresh.access_token, services, label: t.label || '' };
  } catch (e) {
    console.error(`${provider} refresh failed:`, e.message);
    await redis(['HDEL', TOKENS_KEY(sid), provider]).catch(() => {});
    return null;
  }
}

export async function getAccessToken(sid, provider) {
  const c = await getConnection(sid, provider);
  return c ? c.access_token : null;
}

// I-uninstall ang isang service lang (hal. Gmail). Kapag wala nang natira, buong disconnect.
export async function removeService(sid, provider, service) {
  const t = await loadTokens(sid, provider);
  if (!t) return;
  const left = (Array.isArray(t.services) ? t.services : []).filter((x) => x !== service);
  if (!PROVIDERS[provider].services || !left.length) return disconnect(sid, provider);
  await redis(['HSET', TOKENS_KEY(sid), provider, encrypt({ ...t, services: left })]);
}

export async function disconnect(sid, provider) {
  const t = await loadTokens(sid, provider);
  const p = PROVIDERS[provider];
  if (t && p && p.revokeUrl) {
    try { await fetch(p.revokeUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: t.refresh_token || t.access_token }).toString() }); } catch (e) { /* best effort */ }
  }
  await redis(['HDEL', TOKENS_KEY(sid), provider]);
}


// ======================================================
// SARILING API KEY NG USER (BYOK) — para sa sarili nilang AI account
// ======================================================
const GEMINI_DEFAULT = () => process.env.GEMINI_MODEL || 'gemini-3.5-flash';
export const KEY_PROVIDERS = {
  openai: { label: 'ChatGPT (OpenAI)', icon: '🟩', base: 'OpenAI', free: false, needsModel: true, model: '', url: 'https://api.openai.com/v1/chat/completions', help: 'https://platform.openai.com/api-keys' },
  anthropic: { label: 'Claude (Anthropic)', icon: '🟧', base: 'Anthropic', free: false, needsModel: false, model: 'claude-haiku-5-5', url: 'https://api.anthropic.com/v1/chat/completions', help: 'https://platform.claude.com/settings/keys' },
  gemini: { label: 'Google Gemini', icon: '🔷', base: 'Gemini', free: true, needsModel: false, get model() { return GEMINI_DEFAULT(); }, url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', help: 'https://aistudio.google.com/apikey' },
  groq: { label: 'Groq', icon: '⚡', base: 'Groq', free: true, needsModel: false, model: 'openai/gpt-oss-120b', url: 'https://api.groq.com/openai/v1/chat/completions', help: 'https://console.groq.com/keys' },
  mistral: { label: 'Mistral', icon: '🌬️', base: 'Mistral', free: true, needsModel: false, model: 'mistral-small-latest', url: 'https://api.mistral.ai/v1/chat/completions', help: 'https://console.mistral.ai/api-keys' },
  openrouter: { label: 'OpenRouter', icon: '🧭', base: 'OpenRouter', free: true, needsModel: false, model: 'openrouter/free', url: 'https://openrouter.ai/api/v1/chat/completions', help: 'https://openrouter.ai/keys' }
};
const KEY_FIELD = (provider) => `key:${provider}`;
export const isKeyProvider = (id) => Object.prototype.hasOwnProperty.call(KEY_PROVIDERS, id);
export const cleanKey = (k) => { const v = String(k || '').trim(); return /^[\w.\-:~+/=]{8,400}$/.test(v) ? v : ''; };
export const cleanModel = (m) => { const v = String(m || '').trim(); return /^[\w.\-:/@]{1,80}$/.test(v) ? v : ''; };

export async function saveUserKey(sid, provider, key, model) {
  await redis(['HSET', TOKENS_KEY(sid), KEY_FIELD(provider), encrypt({ key, model: model || '', addedAt: Date.now() })]);
}
export async function removeUserKey(sid, provider) {
  await redis(['HDEL', TOKENS_KEY(sid), KEY_FIELD(provider)]);
}

async function loadUserKeys(sid) {
  if (!oauthReady() || !SID_RX.test(sid)) return {};
  const flat = await redis(['HGETALL', TOKENS_KEY(sid)]).catch(() => []);
  const out = {};
  for (let i = 0; Array.isArray(flat) && i + 1 < flat.length; i += 2) {
    const f = String(flat[i]);
    if (!f.startsWith('key:') || !isKeyProvider(f.slice(4))) continue;
    const v = decrypt(flat[i + 1]);
    if (v && v.key) out[f.slice(4)] = v;
  }
  return out;
}

// Para sa status (walang ibinabalik na key)
export async function listUserKeys(sid) {
  const keys = await loadUserKeys(sid);
  return Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, { model: v.model || KEY_PROVIDERS[k].model }]));
}

// Para sa chat: mga provider gamit ang sariling key ng user. Bayad na key muna (pinili nila ito).
export async function getUserProviders(sid) {
  const keys = await loadUserKeys(sid);
  const order = ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'openrouter'];
  return order.filter((id) => keys[id]).map((id) => ({
    name: `Your ${KEY_PROVIDERS[id].base}`, base: KEY_PROVIDERS[id].base, own: true,
    apiKey: keys[id].key, url: KEY_PROVIDERS[id].url, model: keys[id].model || KEY_PROVIDERS[id].model, extra: {}
  })).filter((p) => p.model);
}

// Maliit na test bago i-save ang key
export async function testUserKey(provider, key, model) {
  const kp = KEY_PROVIDERS[provider];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(kp.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: model || kp.model, messages: [{ role: 'user', content: 'Reply with OK' }], max_tokens: 16, stream: false }),
      signal: controller.signal
    });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export const __test = { encrypt, decrypt };
