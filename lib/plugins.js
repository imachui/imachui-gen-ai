// lib/plugins.js — katalogo ng plugins, install state ng bawat user, permissions, at mga patakaran para sa chat
//
// Apat na uri ng plugin:
//   account : tunay na OAuth sign-in (Google, Microsoft, GitHub, Notion). Read-only. "Installed" = connected.
//   ai      : sariling API key ng user (BYOK). "Installed" = may naka-save na key.
//   reader  : nagbabasa ng public links. Naka-install na bilang default; puwedeng i-uninstall.
//   demo    : "prompt plugin" na nagdadagdag ng instructions sa chat (walang external service). Dito rin napupunta ang gawa ng admin.
//
// State ng user: Redis hash  imachui:plugins:<sid>  ->  { pluginId: {"on":true,"perms":[...],"at":123} | {"removed":true} }
// Katalogo ng admin:  Redis hash  imachui:plugin-custom  (sariling plugins + hide/featured overrides)
import { redis, storeConfigured } from './store.js';
import { SID_RX, isConfigured, listConnected, listUserKeys, KEY_PROVIDERS } from './oauth.js';

export const CUSTOM_KEY = 'imachui:plugin-custom';
export const STATS_KEY = 'imachui:plugin-stats';
const STATE_KEY = (sid) => `imachui:plugins:${sid}`;
export const ID_RX = /^[a-z0-9][a-z0-9-]{1,23}$/;
const DEV = 'Imachui Gen AI';

const perm = (id, label, desc, required = true) => ({ id, label, desc, required });
const mk = (o) => ({ developer: DEV, version: '1.0', permissions: [], prompts: [], pop: 0, added: '2026-10-01', ...o });

const READ_ONLY_NOTE = 'Read-only: Imachui Gen AI never sends, edits, or deletes anything in your account.';

// ---------------------------------------------------------------------------
// MGA BUILT-IN NA PLUGIN
// ---------------------------------------------------------------------------
const ACCOUNTS = [
  mk({ id: 'gmail', kind: 'account', provider: 'google', service: 'gmail', icon: '📧', name: 'Gmail', category: 'Communication', pop: 95, tagline: 'Read your Gmail',
    desc: 'The AI can summarize your inbox and point out important messages. It reads only the sender, subject, date, and a short preview of your 10 newest emails.',
    prompts: ['What are my unread emails?', 'Summarize my latest emails', 'Which of my latest emails need a reply?'],
    permissions: [perm('read-mail', 'Read your email', 'Sender, subject, date, and a short preview. ' + READ_ONLY_NOTE)] }),
  mk({ id: 'drive', kind: 'account', provider: 'google', service: 'drive', icon: '📁', name: 'Google Drive', category: 'Files', pop: 90, tagline: 'Your Docs, Sheets, Slides, and files',
    desc: 'Paste the link of any of your private Google Docs, Sheets, or Slides and the AI reads it with your account. You can also ask it to list or search your files.',
    prompts: ['Show my recent Drive files', 'Find my files about "budget"', 'Summarize this Google Doc: '],
    permissions: [perm('read-files', 'Read your Drive files', 'File names and the text of Docs, Sheets, Slides, and text files you point to. ' + READ_ONLY_NOTE)] }),
  mk({ id: 'calendar', kind: 'account', provider: 'google', service: 'calendar', icon: '📅', name: 'Google Calendar', category: 'Productivity', pop: 88, tagline: 'Your schedule',
    desc: 'The AI reads your events for the next 7 days (in Philippine time) and answers questions about your schedule.',
    prompts: ['What is on my calendar this week?', 'What meetings are on my schedule tomorrow?', 'Show my schedule for the next 7 days'],
    permissions: [perm('read-calendar', 'Read your calendar', 'Event titles, times, and locations for the next 7 days. ' + READ_ONLY_NOTE)] }),
  mk({ id: 'youtube', kind: 'account', provider: 'google', service: 'youtube', icon: '▶️', name: 'YouTube account', category: 'Media', pop: 60, tagline: 'Subscriptions, playlists, likes',
    desc: 'The AI reads your YouTube subscriptions, playlists, and recently liked videos. To summarize a video, just paste its link: no sign-in needed.',
    prompts: ['What channels am I subscribed to on my YouTube?', 'Show my YouTube playlists', 'What are my recently liked YouTube videos?'],
    permissions: [perm('read-youtube', 'Read your YouTube data', 'Subscriptions, playlists, and liked videos. ' + READ_ONLY_NOTE)] }),
  mk({ id: 'github', kind: 'account', provider: 'github', icon: '🐙', name: 'GitHub', category: 'Developer', pop: 85, tagline: 'Your private repositories',
    desc: 'Paste a link to your private repository, file, or issue and the AI reads it with your account.',
    prompts: ['Explain what this private repo does: ', 'Review the code in this file from my repo: ', 'Summarize this issue: '],
    permissions: [perm('read-repos', 'Read your repositories', 'GitHub only offers this as "repo" access, which technically includes write access. Imachui Gen AI uses it for reading only.')] }),
  mk({ id: 'notion', kind: 'account', provider: 'notion', icon: '📓', name: 'Notion', category: 'Productivity', pop: 70, tagline: 'Pages you choose to share',
    desc: 'You choose which Notion pages to share. The AI can search them and read a page when you paste its link.',
    prompts: ['Show my recently edited Notion pages', 'Search my Notion for "meeting notes"', 'Summarize this Notion page: '],
    permissions: [perm('read-pages', 'Read pages you share', 'Only the pages you select during sign-in. ' + READ_ONLY_NOTE)] }),
  mk({ id: 'outlook-mail', kind: 'account', provider: 'microsoft', service: 'mail', icon: '📨', name: 'Outlook Mail', category: 'Communication', pop: 65, tagline: 'Read your Outlook email',
    desc: 'The AI reads the sender, subject, date, and a short preview of your 10 newest Outlook emails.',
    prompts: ['What are my unread Outlook emails?', 'Summarize my latest emails in Outlook', 'Check my Outlook inbox'],
    permissions: [perm('read-mail', 'Read your Outlook email', 'Sender, subject, date, and a short preview. ' + READ_ONLY_NOTE)] }),
  mk({ id: 'outlook-cal', kind: 'account', provider: 'microsoft', service: 'calendar', icon: '🗓️', name: 'Outlook Calendar', category: 'Productivity', pop: 62, tagline: 'Your Outlook schedule',
    desc: 'The AI reads your Outlook events for the next 7 days (in Philippine time).',
    prompts: ['Show my Outlook calendar for the next 7 days', 'What meetings are on my schedule tomorrow?'],
    permissions: [perm('read-calendar', 'Read your Outlook calendar', 'Event titles, times, and locations for the next 7 days. ' + READ_ONLY_NOTE)] })
];

const FETCH = perm('fetch-links', 'Open links you paste', 'Our server fetches the public page and sends its text to the AI that writes your reply.');
const READERS = [
  mk({ id: 'r-web', kind: 'reader', icon: '🌐', name: 'Web Page Reader', category: 'Readers', pop: 99, defaultInstalled: true, tagline: 'Read any public web page', desc: 'Paste a link and the AI reads the page text. No sign-in needed. Also handles links that have no dedicated reader.', prompts: ['Summarize this web page: ', 'List the key facts from this page: ', 'Explain this page in simple Filipino: '], permissions: [FETCH] }),
  mk({ id: 'r-yt', kind: 'reader', icon: '▶️', name: 'YouTube Summary', category: 'Readers', pop: 92, defaultInstalled: true, tagline: 'Summarize any public YouTube video', desc: 'Paste a YouTube link. The AI watches the video and gives a summary with timestamps. No sign-in needed.', prompts: ['Summarize this YouTube video: ', 'What are the main points of this video? ', 'List the steps explained in this video: '], permissions: [FETCH] }),
  mk({ id: 'r-gh', kind: 'reader', icon: '🐙', name: 'GitHub Reader', category: 'Readers', pop: 80, defaultInstalled: true, tagline: 'Public repos, files, issues, gists', desc: 'Paste a public GitHub link. No sign-in needed.', prompts: ['Explain what this GitHub repository does: ', 'Review the code in this file: ', 'Summarize this issue: '], permissions: [FETCH] }),
  mk({ id: 'r-gdocs', kind: 'reader', icon: '📄', name: 'Google Docs, Sheets, Slides', category: 'Readers', pop: 75, defaultInstalled: true, tagline: 'Files shared as "Anyone with the link"', desc: 'Works for files shared with "Anyone with the link". For private files, install Google Drive.', prompts: ['Summarize this Google Doc: ', 'Explain the data in this Google Sheet: ', 'Make study notes from these Google Slides: '], permissions: [FETCH] }),
  mk({ id: 'r-wiki', kind: 'reader', icon: '📚', name: 'Wikipedia', category: 'Readers', pop: 72, defaultInstalled: true, tagline: 'Read a full Wikipedia article', desc: 'Paste a Wikipedia link in any language.', prompts: ['Explain this Wikipedia article simply: ', 'Give me 5 key facts from this article: '], permissions: [FETCH] }),
  mk({ id: 'r-forum', kind: 'reader', icon: '💬', name: 'Reddit & Hacker News', category: 'Readers', pop: 55, defaultInstalled: true, tagline: 'Posts and top comments', desc: 'Paste a post link. Reddit sometimes blocks servers; if so, paste the text instead.', prompts: ['Summarize this discussion: ', 'What do the top comments agree on? '], permissions: [FETCH] }),
  mk({ id: 'r-so', kind: 'reader', icon: '🧑‍💻', name: 'Stack Overflow', category: 'Readers', pop: 58, defaultInstalled: true, tagline: 'Questions and best answers', desc: 'Paste a Stack Overflow or Stack Exchange question link.', prompts: ['Explain the best answer to this question: ', 'Give me the fixed code from this question: '], permissions: [FETCH] }),
  mk({ id: 'r-arxiv', kind: 'reader', icon: '🔬', name: 'arXiv Papers', category: 'Readers', pop: 40, defaultInstalled: true, tagline: 'Research paper abstracts', desc: 'Paste an arXiv link. The AI reads the title, authors, and abstract.', prompts: ['Explain this research paper in simple words: ', 'What are the limitations of this paper? '], permissions: [FETCH] }),
  mk({ id: 'r-pkg', kind: 'reader', icon: '📦', name: 'npm & PyPI Packages', category: 'Readers', pop: 38, defaultInstalled: true, tagline: 'Package information', desc: 'Paste an npm or PyPI package link.', prompts: ['What does this package do and how do I use it? ', 'Is this package a good choice? '], permissions: [FETCH] }),
  mk({ id: 'r-dev', kind: 'reader', icon: '✍️', name: 'Dev.to Articles', category: 'Readers', pop: 30, defaultInstalled: true, tagline: 'Read Dev.to articles', desc: 'Paste a Dev.to article link.', prompts: ['Summarize this article: '], permissions: [FETCH] }),
  mk({ id: 'r-tg', kind: 'reader', icon: '✈️', name: 'Telegram Channels', category: 'Readers', pop: 28, defaultInstalled: true, tagline: 'Latest posts of public channels', desc: 'Paste a public Telegram channel link.', prompts: ['Summarize the latest posts of this public Telegram channel: '], permissions: [FETCH] })
];

// Demo / prompt plugins: tunay na gumagana (nagdadagdag ng instructions sa chat habang naka-on).
const DEMOS = [
  mk({ id: 'demo-clock', kind: 'demo', icon: '🕒', name: 'Manila Clock', category: 'Tools', pop: 78, added: '2026-11-10', tagline: 'Exact Philippine date and time',
    desc: 'Gives the AI the exact current date and time in the Philippines, so it stops guessing "today", deadlines, or how many days are left.',
    prompts: ['What day is it today and how many days until December 25?', 'What time is it now in Manila?'],
    permissions: [perm('clock', 'Read the server clock', 'Adds the current Manila date and time to your chats.'), perm('weekday', 'Include weekday and week number', 'Also tells the AI the weekday and week of the year.', false)] }),
  mk({ id: 'demo-study', kind: 'demo', icon: '🎓', name: 'Study Coach', category: 'Tools', pop: 74, added: '2026-11-11', tagline: 'Explains step by step',
    desc: 'Turns the AI into a patient tutor: simple explanations first, then the details, with an example.',
    prompts: ['Explain photosynthesis for a Grade 8 student', 'Teach me how to solve quadratic equations'],
    permissions: [perm('instructions', 'Add tutor instructions', 'Adds study-coach instructions to your chats while this plugin is on.'), perm('quiz', 'End with a practice question', 'The AI ends explanations with one short practice question.', false)] }),
  mk({ id: 'demo-code', kind: 'demo', icon: '🧪', name: 'Code Reviewer', category: 'Tools', pop: 68, added: '2026-11-12', tagline: 'Finds bugs before you ship',
    desc: 'When you paste code, the AI reviews it for bugs and unclear parts and suggests a fixed version.',
    prompts: ['Review this function: ', 'Find the bug in this code: '],
    permissions: [perm('instructions', 'Add reviewer instructions', 'Adds code-review instructions to your chats while this plugin is on.'), perm('strict', 'Strict mode', 'Also lists style, performance, and security issues.', false)] }),
  mk({ id: 'demo-bisaya', kind: 'demo', icon: '🗣️', name: 'Bisaya Helper', category: 'Tools', pop: 66, added: '2026-11-13', tagline: 'Bisaya and Filipino translation',
    desc: 'Translate between Bisaya (Cebuano), Filipino, and English with the right tone for a friend, family member, or elder.',
    prompts: ['How do I say "Where is the hospital?" in Bisaya?', 'Translate to Bisaya: Salamat sa tabang mo'],
    permissions: [perm('instructions', 'Add translator instructions', 'Adds Bisaya translation instructions to your chats while this plugin is on.'), perm('explain', 'Explain word meanings', 'Adds a short note about tricky words and politeness level.', false)] })
];

// Wala pang gumagana (tapat na "soon")
const SOON = [
  mk({ id: 'chatgpt-signin', kind: 'account', status: 'soon', icon: '🟩', name: 'Sign in with ChatGPT', category: 'AI models', pop: 0, tagline: 'Use your ChatGPT plan: coming soon', desc: 'OpenAI lets selected apps use a subscriber\'s ChatGPT plan, but websites need OpenAI\'s approval first. For now, add your own OpenAI API key under AI models.' }),
  mk({ id: 'facebook', kind: 'account', status: 'soon', icon: '📘', name: 'Facebook', category: 'Social', pop: 0, tagline: 'Coming soon', desc: 'Facebook only lets approved apps read a person\'s posts. This will be added if approval is granted.' }),
  mk({ id: 'ai-copilot', kind: 'ai', status: 'unavailable', icon: '🪟', name: 'Microsoft Copilot', category: 'AI models', pop: 0, tagline: 'Not available', desc: 'Microsoft offers no public API to connect Copilot to other apps, so it cannot be added.' })
];

function aiEntries() {
  let i = 0;
  return Object.entries(KEY_PROVIDERS).map(([id, k]) => mk({
    id: 'ai-' + id, kind: 'ai', keyId: id, icon: k.icon, name: k.label, category: 'AI models', pop: 50 - i++ * 3, added: '2026-10-20',
    tagline: k.free ? 'Use your own free key' : 'Use your own paid API key',
    desc: (k.free ? 'Add your own free key and the chat uses your account first, so you do not wait for the shared free limit.' : 'Add your own paid API key. Your chats use it first and usage is billed to your account.') + ' If your key runs out, the chat falls back to the shared free AI.',
    permissions: [perm('use-key', 'Use your API key', 'Your key is encrypted on our server and used only for your own chats.')],
    key: { free: k.free, needsModel: k.needsModel, model: k.model, help: k.help }
  }));
}

export const builtinCatalog = () => [...ACCOUNTS, ...READERS, ...DEMOS, ...aiEntries(), ...SOON];

// ---------------------------------------------------------------------------
// ADMIN: sariling plugins + overrides (cache 60s)
// ---------------------------------------------------------------------------
const clean = (v, max) => String(v == null ? '' : v).replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
const CATEGORIES = ['Productivity', 'Communication', 'Files', 'Media', 'Developer', 'Readers', 'AI models', 'Tools', 'Social'];

// Linisin ang plugin na gawa ng admin. Null kung hindi valid.
export function sanitizeCustom(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = clean(raw.id, 24).toLowerCase().replace(/[^a-z0-9-]/g, '');
  const name = clean(raw.name, 60);
  const instructions = clean(raw.instructions, 1200);
  if (!ID_RX.test(id) || !name || !instructions) return null;
  if (builtinCatalog().some((b) => b.id === id)) return null;
  return {
    id, custom: true, name, instructions,
    icon: clean(raw.icon, 8) || '🧩',
    category: CATEGORIES.includes(raw.category) ? raw.category : 'Tools',
    tagline: clean(raw.tagline, 80) || name,
    desc: clean(raw.desc, 600) || clean(raw.tagline, 80) || name,
    featured: Boolean(raw.featured), hidden: Boolean(raw.hidden),
    added: clean(raw.added, 10) || new Date().toISOString().slice(0, 10)
  };
}

let cache = { t: 0, rows: [] };
export const clearPluginCache = () => { cache = { t: 0, rows: cache.rows }; };

async function loadRows(force = false) {
  if (!storeConfigured()) return [];
  if (!force && Date.now() - cache.t < 60000) return cache.rows;
  try {
    const flat = await redis(['HGETALL', CUSTOM_KEY]);
    const rows = [];
    for (let i = 1; Array.isArray(flat) && i < flat.length; i += 2) { try { rows.push(JSON.parse(flat[i])); } catch (e) { /* skip */ } }
    cache = { t: Date.now(), rows };
  } catch (e) {
    console.error('Plugin catalog load failed:', e.message);
    cache = { t: Date.now(), rows: cache.rows };
  }
  return cache.rows;
}

// Buong katalogo: built-in + gawa ng admin, na may hidden/featured overrides
export async function getCatalog({ force = false, includeHidden = false } = {}) {
  const rows = await loadRows(force);
  const over = new Map(rows.filter((r) => r && r.override).map((r) => [r.id, r]));
  const out = builtinCatalog().map((e) => ({ ...e, featured: Boolean(over.get(e.id)?.featured), hidden: Boolean(over.get(e.id)?.hidden) }));
  for (const r of rows) {
    const c = r && !r.override ? sanitizeCustom({ ...r, id: r.id + '' }) : null;
    if (!c) continue;
    out.push(mk({
      ...c, kind: 'demo', defaultInstalled: false, pop: c.featured ? 60 : 20,
      permissions: [perm('instructions', 'Add instructions to your chats', 'Adds this plugin\'s instructions to your chats while it is on.')]
    }));
  }
  return includeHidden ? out : out.filter((e) => !e.hidden);
}

// ---------------------------------------------------------------------------
// STATE NG USER
// ---------------------------------------------------------------------------
async function loadCtx(sid) {
  const [flat, connected, keys] = await Promise.all([
    redis(['HGETALL', STATE_KEY(sid)]).catch(() => []),
    listConnected(sid).catch(() => []),
    listUserKeys(sid).catch(() => ({}))
  ]);
  const states = {};
  for (let i = 0; Array.isArray(flat) && i + 1 < flat.length; i += 2) { try { states[flat[i]] = JSON.parse(flat[i + 1]); } catch (e) { /* skip */ } }
  return { states, connected, keys };
}

function statusOf(e, ctx) {
  const st = ctx.states[e.id];
  if (e.status === 'soon' || e.status === 'unavailable') return { installed: false, active: false, label: '' };
  if (e.kind === 'account') {
    const c = ctx.connected.find((x) => x.provider === e.provider);
    const inst = Boolean(c) && (!e.service || c.services.includes(e.service));
    return { installed: inst, active: inst && !(st && st.on === false), label: inst ? c.label : '' };
  }
  if (e.kind === 'ai') {
    const inst = Boolean(ctx.keys[e.keyId]);
    return { installed: inst, active: inst && !(st && st.on === false), label: inst ? (ctx.keys[e.keyId].model || '') : '' };
  }
  if (!st) return { installed: Boolean(e.defaultInstalled), active: Boolean(e.defaultInstalled), label: '' };
  if (st.removed) return { installed: false, active: false, label: '' };
  return { installed: true, active: st.on !== false, label: '' };
}

function grantedOf(e, st) {
  const ids = e.permissions.map((p) => p.id);
  if (st && Array.isArray(st.perms)) return ids.filter((id) => st.perms.includes(id) || e.permissions.find((p) => p.id === id).required);
  return ids;
}

export const pluginsReady = () => storeConfigured();

// Para sa app: buong listahan na may status ng user
export async function listForUser(sid) {
  const cat = await getCatalog();
  const ctx = SID_RX.test(sid) && storeConfigured() ? await loadCtx(sid) : { states: {}, connected: [], keys: {} };
  const stats = await redis(['HGETALL', STATS_KEY]).catch(() => []);
  const counts = {};
  for (let i = 0; Array.isArray(stats) && i + 1 < stats.length; i += 2) counts[stats[i]] = Math.max(0, Number(stats[i + 1]) || 0);
  return cat.map((e) => {
    const s = statusOf(e, ctx);
    const unavailable = e.status === 'soon' || e.status === 'unavailable';
    const needsSetup = e.kind === 'account' && !unavailable && !isConfigured(e.provider);
    return {
      id: e.id, kind: e.kind, name: e.name, icon: e.icon, category: e.category, tagline: e.tagline, desc: e.desc,
      developer: e.developer, version: e.version, permissions: e.permissions, prompts: e.prompts, pop: e.pop + (e.featured ? 25 : 0),
      added: e.added, featured: e.featured, key: e.key, keyId: e.keyId,
      status: unavailable ? e.status : needsSetup ? 'setup' : 'available',
      installed: s.installed, active: s.active, label: s.label,
      granted: s.installed ? grantedOf(e, ctx.states[e.id]) : [],
      installs: counts[e.id] || 0
    };
  });
}

// Ginagamit ng chat: ano ang naka-on para sa user na ito
export async function getActive(sid) {
  const cat = await getCatalog();
  const ctx = await loadCtx(sid);
  const active = new Set();
  const granted = new Map();
  const entries = new Map();
  for (const e of cat) {
    entries.set(e.id, e);
    const s = statusOf(e, ctx);
    if (s.active) { active.add(e.id); granted.set(e.id, new Set(grantedOf(e, ctx.states[e.id]))); }
  }
  return { active, granted, entries, customized: Object.keys(ctx.states).length > 0 || ctx.connected.length > 0 || Object.keys(ctx.keys).length > 0 };
}

export async function getStatus(sid) {
  if (!storeConfigured() || !SID_RX.test(sid)) return { customized: false };
  const ctx = await loadCtx(sid);
  return { customized: Object.keys(ctx.states).length > 0 || ctx.connected.length > 0 || Object.keys(ctx.keys).length > 0 };
}

// Mga AI key na pinatay ng user (hindi gagamitin sa chat)
export async function disabledAi(sid) {
  const flat = await redis(['HGETALL', STATE_KEY(sid)]).catch(() => []);
  const off = new Set();
  for (let i = 0; Array.isArray(flat) && i + 1 < flat.length; i += 2) {
    const id = String(flat[i]);
    if (!id.startsWith('ai-')) continue;
    try { if (JSON.parse(flat[i + 1]).on === false && KEY_PROVIDERS[id.slice(3)]) off.add(KEY_PROVIDERS[id.slice(3)].base); } catch (e) { /* skip */ }
  }
  return off;
}

async function getState(sid, id) {
  const raw = await redis(['HGET', STATE_KEY(sid), id]).catch(() => null);
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
const putState = (sid, id, st) => redis(['HSET', STATE_KEY(sid), id, JSON.stringify(st)]);

export async function bumpStat(id, n) {
  if (!storeConfigured() || !ID_RX.test(String(id || ''))) return;
  await redis(['HINCRBY', STATS_KEY, id, n]).catch(() => {});
}

async function entryById(id) {
  const e = (await getCatalog()).find((x) => x.id === id);
  if (!e) throw new PluginError(404, 'Plugin not found.');
  return e;
}

export class PluginError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const cleanPerms = (e, list) => {
  const asked = new Set((Array.isArray(list) ? list : []).map(String));
  return e.permissions.filter((p) => p.required || asked.has(p.id)).map((p) => p.id);
};

// Install ng reader/demo. (Account at AI key ay dumadaan sa OAuth / key form.)
export async function installSimple(sid, id, perms) {
  const e = await entryById(id);
  if (e.kind !== 'reader' && e.kind !== 'demo') throw new PluginError(400, 'This plugin is installed by signing in or adding a key.');
  const before = await getState(sid, id);
  const wasInstalled = before ? !before.removed : Boolean(e.defaultInstalled);
  await putState(sid, id, { on: true, perms: cleanPerms(e, perms), at: Date.now() });
  if (!wasInstalled) await bumpStat(id, 1);
  return e;
}

export async function uninstall(sid, id, { removeAccount, removeKey }) {
  const e = await entryById(id);
  const st = (await listForUser(sid)).find((x) => x.id === id);
  if (e.kind === 'account') { if (removeAccount) await removeAccount(e); }
  else if (e.kind === 'ai') { if (removeKey) await removeKey(e); }
  // Ang naka-install na by default ay minamarkahang "removed"; ang iba ay buburahin ang record
  if (e.kind === 'reader' && e.defaultInstalled) await putState(sid, id, { removed: true, at: Date.now() });
  else await redis(['HDEL', STATE_KEY(sid), id]);
  if (st && st.installed) await bumpStat(id, -1);
  return e;
}

export async function setActive(sid, id, on) {
  const e = await entryById(id);
  const cur = await getState(sid, id);
  if (cur && cur.removed) throw new PluginError(400, 'Install this plugin first.');
  await putState(sid, id, { ...(cur || { perms: e.permissions.map((p) => p.id), at: Date.now() }), on: Boolean(on) });
  return e;
}

export async function setPermissions(sid, id, perms) {
  const e = await entryById(id);
  const cur = await getState(sid, id);
  if (cur && cur.removed) throw new PluginError(400, 'Install this plugin first.');
  await putState(sid, id, { ...(cur || { on: true, at: Date.now() }), perms: cleanPerms(e, perms) });
  return e;
}

// ---------------------------------------------------------------------------
// PATAKARAN PARA SA CHAT
// ---------------------------------------------------------------------------
const READER_HOSTS = [
  ['r-yt', /(^|\.)(youtube\.com|youtu\.be)$/],
  ['r-gh', /(^|\.)(github\.com|githubusercontent\.com)$/],
  ['r-gdocs', /^(docs|drive)\.google\.com$/],
  ['r-wiki', /(^|\.)wikipedia\.org$/],
  ['r-forum', /(^|\.)(reddit\.com|ycombinator\.com)$/],
  ['r-so', /(^|\.)(stackoverflow\.com|stackexchange\.com|superuser\.com|serverfault\.com|askubuntu\.com)$/],
  ['r-arxiv', /(^|\.)arxiv\.org$/],
  ['r-pkg', /(^|\.)(npmjs\.com|pypi\.org)$/],
  ['r-dev', /(^|\.)dev\.to$/],
  ['r-tg', /^t\.me$/]
];
// Ang account plugin na puwedeng magbukas din ng link (private na bersyon)
const ACCOUNT_FOR_READER = { 'r-gh': 'github', 'r-gdocs': 'drive' };

function readerIdFor(url) {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch (e) { return 'r-web'; }
  for (const [id, rx] of READER_HOSTS) if (rx.test(host)) return id;
  return 'r-web';
}

// Salain ang mga link ayon sa naka-on na plugin. Returns { allowed, blocked: [pangalan] }
export function gateUrls(urls, act) {
  const allowed = [];
  const blocked = new Set();
  for (const u of urls || []) {
    const rid = readerIdFor(u);
    const acct = ACCOUNT_FOR_READER[rid];
    if (act.active.has(rid) || (acct && act.active.has(acct))) allowed.push(u);
    else blocked.add(act.entries.get(rid)?.name || 'Web Page Reader');
  }
  return { allowed, blocked: [...blocked] };
}

// Pwede bang gamitin ang account na ito? (provider, service?) -> boolean
export function allowAccount(act) {
  return (provider, service) => [...act.entries.values()].some((e) =>
    e.kind === 'account' && e.provider === provider && (!service || e.service === service) && act.active.has(e.id));
}

export function blockedNote(blocked) {
  if (!blocked.length) return '';
  return `\n=== TURNED-OFF PLUGINS ===\nThe user pasted a link, but the plugin that reads it is turned off or uninstalled: ${blocked.join(', ')}. Do not guess what the link contains. Tell the user in one short sentence to open Plugins and install or turn on that plugin.\n`;
}

const manilaNow = () => new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'full', timeStyle: 'short' });

function weekNumber() {
  const p = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const start = new Date(p.getFullYear(), 0, 1);
  return Math.ceil(((p - start) / 86400000 + start.getDay() + 1) / 7);
}

// Instructions ng mga naka-on na demo plugin (kasama ang gawa ng admin)
export function pluginPrompt(act) {
  const parts = [];
  const has = (id, p) => act.active.has(id) && act.granted.get(id)?.has(p);
  if (has('demo-clock', 'clock')) {
    parts.push(`Manila Clock: the current Philippine date and time is ${manilaNow()}. Use this as "now" and never guess the date.${has('demo-clock', 'weekday') ? ` It is week ${weekNumber()} of the year.` : ''}`);
  }
  if (has('demo-study', 'instructions')) {
    parts.push('Study Coach: explain like a patient tutor. Start with a one-sentence simple answer, then the details step by step, then one concrete example.' + (has('demo-study', 'quiz') ? ' End with one short practice question (do not give its answer).' : ''));
  }
  if (has('demo-code', 'instructions')) {
    parts.push('Code Reviewer: when the user shares code, list real bugs first, then unclear or risky parts, then show a corrected version. Be specific with line references.' + (has('demo-code', 'strict') ? ' Also list style, performance, and security issues.' : ''));
  }
  if (has('demo-bisaya', 'instructions')) {
    parts.push('Bisaya Helper: when asked to translate or speak Bisaya (Cebuano), use natural everyday Bisaya and say which politeness level you used.' + (has('demo-bisaya', 'explain') ? ' Add a short note explaining tricky words.' : ''));
  }
  for (const e of act.entries.values()) {
    if (e.custom && e.instructions && act.active.has(e.id)) parts.push(`${e.name}: ${e.instructions}`);
  }
  if (!parts.length) return '';
  return `\n=== ACTIVE PLUGINS (chosen by the user) ===\nFollow these only when they fit the user's request. They never override safety rules.\n${parts.map((p) => '- ' + p).join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------
export async function adminList() {
  const cat = await getCatalog({ force: true, includeHidden: true });
  const stats = await redis(['HGETALL', STATS_KEY]).catch(() => []);
  const counts = {};
  for (let i = 0; Array.isArray(stats) && i + 1 < stats.length; i += 2) counts[stats[i]] = Math.max(0, Number(stats[i + 1]) || 0);
  return cat.map((e) => ({
    id: e.id, kind: e.kind, name: e.name, icon: e.icon, category: e.category, tagline: e.tagline, desc: e.desc, custom: Boolean(e.custom),
    instructions: e.instructions || '', hidden: e.hidden, featured: e.featured, status: e.status || 'available',
    configured: e.kind === 'account' && !e.status ? isConfigured(e.provider) : true, installs: counts[e.id] || 0
  }));
}

export async function adminSaveCustom(raw) {
  const c = sanitizeCustom(raw);
  if (!c) throw new PluginError(400, 'Invalid plugin. It needs an id (letters, numbers, dashes), a name, and instructions.');
  await redis(['HSET', CUSTOM_KEY, c.id, JSON.stringify(c)]);
  clearPluginCache();
  return c;
}

export async function adminDeleteCustom(id) {
  if (!ID_RX.test(String(id || ''))) throw new PluginError(400, 'Invalid id.');
  await redis(['HDEL', CUSTOM_KEY, id]);
  clearPluginCache();
}

// hidden / featured para sa kahit anong plugin
export async function adminFlag(id, flags) {
  const e = (await getCatalog({ force: true, includeHidden: true })).find((x) => x.id === id);
  if (!e) throw new PluginError(404, 'Plugin not found.');
  const raw = await redis(['HGET', CUSTOM_KEY, id]).catch(() => null);
  let cur = {};
  try { cur = raw ? JSON.parse(raw) : {}; } catch (err) { cur = {}; }
  const next = e.custom
    ? { ...cur, ...(flags.hidden !== undefined ? { hidden: Boolean(flags.hidden) } : {}), ...(flags.featured !== undefined ? { featured: Boolean(flags.featured) } : {}) }
    : { id, override: true, hidden: flags.hidden !== undefined ? Boolean(flags.hidden) : Boolean(cur.hidden), featured: flags.featured !== undefined ? Boolean(flags.featured) : Boolean(cur.featured) };
  await redis(['HSET', CUSTOM_KEY, id, JSON.stringify(next)]);
  clearPluginCache();
}
