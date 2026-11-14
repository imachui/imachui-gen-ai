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
const GOOGLE_DEFAULT_SCOPES = [
  'openid', 'email',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly'
].join(' ');

export const PROVIDERS = {
  google: {
    label: 'Google', icon: '🟢', what: 'Private Docs, Sheets, Slides, Drive, Calendar, Gmail',
    idEnv: 'GOOGLE_CLIENT_ID', secretEnv: 'GOOGLE_CLIENT_SECRET',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    scopes: () => String(process.env.GOOGLE_SCOPES || GOOGLE_DEFAULT_SCOPES).split(/[\s,]+/).filter(Boolean),
    extra: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' }
  },
  github: {
    label: 'GitHub', icon: '🐙', what: 'Your private repositories',
    idEnv: 'GITHUB_CLIENT_ID', secretEnv: 'GITHUB_CLIENT_SECRET',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: () => ['repo', 'read:user'],
    extra: {}
  },
  notion: {
    label: 'Notion', icon: '📓', what: 'Notion pages you choose to share',
    idEnv: 'NOTION_CLIENT_ID', secretEnv: 'NOTION_CLIENT_SECRET',
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    tokenJson: true,
    scopes: () => [],
    extra: { owner: 'user' }
  },
  microsoft: {
    label: 'Microsoft', icon: '🪟', what: 'Outlook mail, Calendar',
    idEnv: 'MICROSOFT_CLIENT_ID', secretEnv: 'MICROSOFT_CLIENT_SECRET',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: () => ['offline_access', 'User.Read', 'Mail.Read', 'Calendars.Read'],
    extra: { prompt: 'select_account' }
  }
};

export const isProvider = (id) => Object.prototype.hasOwnProperty.call(PROVIDERS, id);
const creds = (id) => ({ id: process.env[PROVIDERS[id].idEnv] || '', secret: process.env[PROVIDERS[id].secretEnv] || '' });
export const isConfigured = (id) => isProvider(id) && Boolean(creds(id).id && creds(id).secret);
export const configuredProviders = () => Object.keys(PROVIDERS).filter(isConfigured);

export function buildAuthUrl(provider, nonce) {
  const p = PROVIDERS[provider];
  const q = new URLSearchParams({
    client_id: creds(provider).id,
    redirect_uri: redirectUri(),
    response_type: 'code',
    state: nonce,
    ...p.extra
  });
  const scopes = p.scopes();
  if (scopes.length) q.set('scope', scopes.join(' '));
  return `${p.authUrl}?${q.toString()}`;
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
export async function createState(sid, provider) {
  const nonce = randomBytes(24).toString('hex');
  await redis(['SET', STATE_KEY(nonce), JSON.stringify({ sid, provider }), 'EX', 600]);
  return nonce;
}

export async function consumeState(nonce) {
  if (!/^[a-f0-9]{48}$/.test(String(nonce || ''))) return null;
  const raw = await redis(['GET', STATE_KEY(nonce)]);
  if (!raw) return null;
  await redis(['DEL', STATE_KEY(nonce)]).catch(() => {});
  try {
    const st = JSON.parse(raw);
    return SID_RX.test(st.sid) && isProvider(st.provider) ? st : null;
  } catch (e) { return null; }
}

export async function saveTokens(sid, provider, tokens, label) {
  await redis(['HSET', TOKENS_KEY(sid), provider, encrypt({ ...tokens, label: label || '', connectedAt: Date.now() })]);
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
    if (t && isProvider(flat[i])) out.push({ provider: flat[i], label: t.label || '' });
  }
  return out;
}

// Access token na may auto-refresh. null kung hindi connected o expired na ang pahintulot.
export async function getAccessToken(sid, provider) {
  const t = await loadTokens(sid, provider);
  if (!t || !t.access_token) return null;
  if (!t.expires_at || t.expires_at - 60000 > Date.now()) return t.access_token;
  if (!t.refresh_token) return null;
  try {
    const j = await tokenRequest(provider, { grant_type: 'refresh_token', refresh_token: t.refresh_token });
    const fresh = { ...t, ...norm(j, t) };
    await redis(['HSET', TOKENS_KEY(sid), provider, encrypt(fresh)]);
    return fresh.access_token;
  } catch (e) {
    console.error(`${provider} refresh failed:`, e.message);
    await redis(['HDEL', TOKENS_KEY(sid), provider]).catch(() => {});
    return null;
  }
}

export async function disconnect(sid, provider) {
  const t = await loadTokens(sid, provider);
  const p = PROVIDERS[provider];
  if (t && p && p.revokeUrl) {
    try { await fetch(p.revokeUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: t.refresh_token || t.access_token }).toString() }); } catch (e) { /* best effort */ }
  }
  await redis(['HDEL', TOKENS_KEY(sid), provider]);
}

export const __test = { encrypt, decrypt };
