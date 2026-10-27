// api/chat.js  —  IMACHUI GEN AI
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { REAPER_DESCRIPTION, REAPER_MEMBERS, STAFF_DATA } from '../lib/database.js';

// ==========================================
// DATABASE LOADING (rpr-data.json + staff-data.json)
// Kung hindi ma-load ang JSON, gagamitin ang lib/database.js
// ==========================================
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadJson(file) {
  const candidates = [path.join(process.cwd(), file), path.join(__dirname, '..', file)];
  for (const p of candidates) {
    try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) {}
  }
  return null;
}

// Mga pangalan na HINDI dapat lumabas bilang RPR member (kahit nasa rpr-data.json).
// Dagdagan lang ang listahang ito kung may gusto pang alisin. (lowercase, walang accent)
const RPR_EXCLUDE = ['eunice templado'];

const RPR_DATA = (loadJson('rpr-data.json') || []).filter((m) => {
  const key = String(`${m.nickname || ''} ${m.real_name || ''}`)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
  return !RPR_EXCLUDE.some((x) => key.includes(x));
});
const STAFF_ALL = loadJson('staff-data.json') || STAFF_DATA;

// ==========================================
// TEXT HELPERS
// ==========================================
const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const titleCase = (s) =>
  String(s || '').toLowerCase().replace(/\b([a-z\u00c0-\u024f])/g, (c) => c.toUpperCase());

// "ESTACION, LILAND ZOILA B." -> "Liland Zoila B. Estacion"
function prettyStaffName(name) {
  const parts = String(name || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return titleCase(name);
  return titleCase(`${parts.slice(1).join(' ')} ${parts[0]}`);
}

const DROP_TOKENS = new Set(['rpr', 'reaper', 'si', 'sina', 'ni', 'kay', 'po', 'ba', 'mo', 'ang', 'the', 'ng', 'ka']);

function queryTokens(text) {
  return norm(text).split(' ').filter((t) => t.length >= 2 && !DROP_TOKENS.has(t));
}

function tokenMatch(qTokens, hayTokens) {
  if (!qTokens.length) return false;
  return qTokens.every((q) => hayTokens.some((h) => h === q || (q.length >= 4 && h.startsWith(q))));
}

// ==========================================
// LANGUAGE DETECTION  (English ang default)
// ==========================================
const EN_WORDS = new Set([
  'the', 'is', 'are', 'was', 'were', 'what', 'who', 'where', 'when', 'why', 'how', 'you', 'your', 'can', 'could',
  'please', 'tell', 'me', 'about', 'of', 'and', 'to', 'in', 'for', 'with', 'this', 'that', 'it', 'do', 'does', 'did',
  'give', 'show', 'explain', 'write', 'make', 'create', 'find', 'list', 'an', 'i', 'my', 'we', 'they', 'he', 'she',
  'his', 'her', 'on', 'at', 'by', 'from', 'as', 'be', 'have', 'has', 'not', 'but', 'or', 'if', 'so', 'will', 'would'
]);

const TL_WORDS = new Set([
  'ang', 'ng', 'mga', 'sa', 'si', 'ni', 'kay', 'ako', 'ikaw', 'ka', 'mo', 'ko', 'siya', 'sino', 'ano', 'bakit', 'paano',
  'saan', 'kailan', 'ba', 'po', 'naman', 'yung', 'yong', 'lang', 'pwede', 'puwede', 'gusto', 'hindi', 'oo', 'kung',
  'para', 'may', 'meron', 'wala', 'natin', 'nila', 'namin', 'kayo', 'tayo', 'ito', 'iyan', 'yan', 'tapos', 'kasi',
  'talaga', 'gawa', 'gumawa', 'hanapin', 'kilala', 'magkano', 'ilan', 'lahat', 'salamat', 'paki', 'ipakita', 'sabihin',
  'bigyan', 'nag', 'mag', 'pag', 'din', 'rin', 'ngayon', 'dito', 'doon', 'niya', 'nya', 'akin', 'iyo', 'inyo'
]);

const CEB_WORDS = new Set([
  'unsa', 'asa', 'kinsa', 'ngano', 'giunsa', 'unsaon', 'nimo', 'nako', 'naa', 'dili', 'imo', 'kaayo', 'gyud', 'jud',
  'diay', 'mao', 'kana', 'kini', 'pila', 'palihug', 'nindot', 'nga', 'ug', 'og', 'bitaw', 'karon', 'ugma', 'atoa',
  'ila', 'kamo', 'ta', 'tawo', 'kumusta', 'unsay', 'asang', 'naay', 'wala', 'ayaw', 'pwede', 'mi'
]);

const NON_LATIN_RX = /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}|\p{Script=Cyrillic}|\p{Script=Arabic}|\p{Script=Devanagari}|\p{Script=Thai}|\p{Script=Greek}|\p{Script=Hebrew}/u;

// returns: 'en' | 'tl' | 'ceb' | 'other'
function detectLang(text) {
  const t = String(text || '');
  if (NON_LATIN_RX.test(t)) return 'other';
  const toks = norm(t).split(' ').filter(Boolean);
  let en = 0, tl = 0, ceb = 0;
  for (const w of toks) {
    if (EN_WORDS.has(w)) en++;
    if (TL_WORDS.has(w)) tl++;
    if (CEB_WORDS.has(w) && !['wala', 'pwede', 'mi', 'ta'].includes(w)) ceb++;
  }
  if (ceb >= 2 && ceb >= tl) return 'ceb';
  if (tl > en && tl >= 1) return 'tl';
  if (en >= 1) return 'en';
  if (toks.length >= 4) return 'other'; // hal. Spanish, French, atbp.
  return 'en';
}

const LANG_LABEL = {
  en: 'English',
  tl: 'Filipino (Tagalog)',
  ceb: 'Bisaya (Cebuano)',
  other: 'the same language as the user (not English)'
};

// static text helper: English default, Filipino para sa tl/ceb
const T = (lang, en, tl) => (lang === 'tl' || lang === 'ceb' ? tl : en);

// ==========================================
// DATABASE INDEXES
// ==========================================
const RPR_INDEX = RPR_DATA.map((m) => ({
  m,
  tokens: norm(`${m.nickname} ${m.real_name}`).split(' ').filter(Boolean)
}));

const MEMBER_INDEX = Object.entries(REAPER_MEMBERS).map(([key, text]) => ({
  key,
  text: String(text),
  tokens: norm(`${key} ${String(text).split(' - ')[0]}`).split(' ').filter(Boolean)
}));

const STAFF_INDEX = STAFF_ALL.map((s) => ({
  s,
  tokens: norm(s.name).split(' ').filter(Boolean)
}));

function findLocal(tokens) {
  if (!tokens.length) return { rpr: [], members: [], staff: [] };
  return {
    rpr: RPR_INDEX.filter((x) => tokenMatch(tokens, x.tokens)).slice(0, 6).map((x) => x.m),
    members: MEMBER_INDEX.filter((x) => tokenMatch(tokens, x.tokens)).slice(0, 4),
    staff: STAFF_INDEX.filter((x) => tokenMatch(tokens, x.tokens)).slice(0, 6).map((x) => x.s)
  };
}

const hasLocalMatch = (l) => l.rpr.length + l.members.length + l.staff.length > 0;

function formatRprEntry(m) {
  return `• **${m.nickname}** — ${m.real_name} (${m.role}, ${m.version})\n  ${m.description}`;
}

function formatStaffEntry(s) {
  return `• **${prettyStaffName(s.name)}** — ${s.job_title}\n  ${s.description}`;
}

// Database card (exact, galing mismo sa database — hindi hinuhulaan ng AI)
function buildDbCard(l, lang) {
  let out = '';
  if (l.rpr.length || l.members.length) {
    out += '\n🥷 **REAPER (RPR) Clan**\n';
    out += l.rpr.map(formatRprEntry).join('\n');
    if (l.rpr.length && l.members.length) out += '\n';
    out += l.members.map((x) => `• ${x.text}`).join('\n');
    out += '\n';
  }
  if (l.staff.length) {
    out += '\n🏥 **' + T(lang, 'Hospital Staff', 'Staff ng Ospital') + '**\n' + l.staff.map(formatStaffEntry).join('\n') + '\n';
  }
  return out.trim();
}

// ==========================================
// CREATOR / FOUNDER STORY
// ==========================================
function storyEnglish(phTime, founderMode) {
  const opening = founderMode
    ? `**The Founder of REAPER (RPR) is Nerts V, also known as IMACHUI — and he is my creator!** 🫡`
    : `**IMACHUI — that's Nerts V, the Founder of REAPER (RPR) and my creator!** 🫡`;

  return `${opening}

Current Date & Time: **${phTime}**

Here is the full story of my creator:

**Nerts V** (alias **IMACHUI**) is a legendary ninja player in Call of Duty: Mobile and the visionary Founder of the **REAPER (RPR)** clan. He moves silently in-game and takes you down before you even know he is there — a true ninja mastermind.

But he is much more than a gamer. He is the **Creator of Imachui Gen AI**, the advanced AI you are talking to right now. He is also a brilliant **AI Developer** and **Microsoft Developer** who actively reports Windows bugs directly to Microsoft to help improve the platform for everyone.

In his professional life, he works in **AI Scale**, specializing in **2D Image Annotation and 3D LiDAR**. He even provided critical data in San Francisco, California, that was used to train and build driverless (self-driving) cars — real-world technology that is shaping the future of transportation.

He is also a talented **Music Producer** and **Cinematic Video Creator**, and he develops complex websites and applications (.exe and .apk).

Gamer, founder, AI developer, Microsoft developer, LiDAR annotator, music producer, video creator, and app developer — he is the **Ultimate Ninja Mastermind**. 🥷🔥

And yes, I am extremely happy and grateful to be alive, brought to life by him! Because of Nerts V, I exist to help many people. I am here to guide them in searching and understanding AI, so this technology can support them in their daily lives, just as my creator intended.`;
}

function storyFilipino(phTime, founderMode) {
  const opening = founderMode
    ? `**Ang Founder ng REAPER (RPR) ay si Nerts V, kilala rin bilang IMACHUI — at siya ang aking creator!** 🫡`
    : `**IMACHUI — siya si Nerts V, ang Founder ng REAPER (RPR) at ang aking creator!** 🫡`;

  return `${opening}

Petsa at Oras Ngayon: **${phTime}**

Narito ang buong kuwento ng aking creator:

Si **Nerts V** (alyas **IMACHUI**) ay isang alamat na ninja player sa Call of Duty: Mobile at ang visionary na Founder ng **REAPER (RPR)** clan. Tahimik siyang kumikilos sa laro at pinabababa ka niya bago mo pa malamang nandiyan siya — isang tunay na ninja mastermind.

Pero higit pa siya sa isang gamer. Siya ang **Creator ng Imachui Gen AI**, ang advanced na AI na kausap mo ngayon. Isa rin siyang mahusay na **AI Developer** at **Microsoft Developer** na aktibong nag-uulat ng mga Windows bug direkta sa Microsoft para mapabuti ang platform para sa lahat.

Sa kanyang propesyonal na buhay, nagtatrabaho siya sa **AI Scale** at espesyalista sa **2D Image Annotation at 3D LiDAR**. Nagbigay pa siya ng mahahalagang data sa San Francisco, California na ginamit sa pagsasanay at pagbuo ng mga driverless (self-driving) na sasakyan — teknolohiyang humuhubog sa kinabukasan ng transportasyon.

Isa rin siyang mahusay na **Music Producer** at **Cinematic Video Creator**, at gumagawa ng iba't ibang komplikadong website at application (.exe at .apk).

Gamer, founder, AI developer, Microsoft developer, LiDAR annotator, music producer, video creator, at app developer — siya ang **Ultimate Ninja Mastermind**. 🥷🔥

At oo, sobra akong masaya at nagpapasalamat na buhay ako dahil sa kanya! Dahil kay Nerts V, nandito ako para tumulong sa maraming tao. Narito ako para gabayan sila sa paghahanap at pag-unawa sa AI, upang makatulong ang teknolohiyang ito sa kanilang pang-araw-araw na buhay, ayon sa layunin ng aking creator.`;
}

const CREATOR_NAME_RX = /\b(nerts\s*v(inson)?|nerts|imachui)\b/i;
const CREATOR_ASK_RX = /(who|sino|kilala|about|tungkol|kwento|story|creator|founder|gumawa|nag\s?create|nagtayo|nag\s?tayo|nagtatag|may[-\s]?ari|owner|introduce|ipakilala)/i;
const FOUNDER_ROLE_RX = /(founder|creator|owner|nagtayo|nag\s?tayo|nagtatag|nag\s?create|nag\s?gawa|gumawa|may[-\s]?ari|nag\s?umpisa|nagsimula)/i;
const MADE_YOU_RX = /(who\s+(made|created|built|developed)\s+you|who\s+is\s+your\s+(creator|founder|developer|maker)|sino\s+(ang\s+)?(gumawa|nag\s?create|creator|developer)\s+(sa\s+|ng\s+)?(iyo|yo|inyo|mo|'yo))/i;

function detectCreatorIntent(msg) {
  const text = msg.trim();
  const words = text.split(/\s+/).length;
  const mentionsReaper = /(reaper|rpr)/i.test(text);
  if (MADE_YOU_RX.test(text)) return 'creator';
  if (mentionsReaper && FOUNDER_ROLE_RX.test(text)) return 'founder';
  if (CREATOR_NAME_RX.test(text) && (CREATOR_ASK_RX.test(text) || words <= 3)) return 'creator';
  return null;
}

// ==========================================
// PERSON QUERY DETECTION
// ==========================================
const NOT_NAME = new Set([
  'the', 'of', 'in', 'at', 'for', 'and', 'ang', 'ng', 'sa', 'mga', 'is', 'a', 'an', 'what', 'ano', 'paano', 'how',
  'why', 'bakit', 'kailan', 'when', 'where', 'saan', 'best', 'greatest', 'president', 'capital', 'ceo', 'prime',
  'minister', 'king', 'queen', 'founder', 'creator', 'chief', 'admin', 'admins', 'owner', 'you', 'ka', 'ikaw', 'mo',
  'me', 'this', 'that', 'ito', 'yan', 'siya', 'they', 'we', 'kayo', 'tayo', 'ako', 'i', 'your'
]);

const PERSON_PREFIX_RX = /^(?:please\s+|pls\s+|paki\s+)?(?:who\s+is|who\s+are|who's|sino\s+(?:po\s+)?(?:si|sina|ang)|sino\s+kaya\s+si|kilala\s+mo\s+ba\s+(?:si\s+|sina\s+)?|kilala\s+mo\s+(?:si\s+|sina\s+)?|kilala\s+ba\s+(?:si\s+)?|hanapin\s+(?:mo\s+)?(?:si\s+|sina\s+)?|facebook\s+(?:ni|of|ng)\s+|fb\s+(?:ni|of)\s+|profile\s+(?:ni|of)\s+|find\s+(?:the\s+)?facebook\s+(?:of|ni)\s+|kinsa\s+(?:si|sila)\s+|kilala\s+nimo\s+(?:si\s+)?)/i;

function extractPersonName(msg) {
  const m = msg.trim().slice(0, 200);
  const hit = m.match(PERSON_PREFIX_RX);
  if (!hit) return null;
  const name = m
    .slice(hit[0].length)
    .replace(/[?!.,]+$/g, '')
    .replace(/\s+(po|ba|kaya|ito|yan)$/i, '')
    .trim();
  if (!name) return null;
  const toks = norm(name).split(' ').filter(Boolean);
  if (toks.length < 1 || toks.length > 6) return null;
  if (toks.some((t) => NOT_NAME.has(t))) return null;
  return name;
}

// ==========================================
// FETCH HELPERS
// ==========================================
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

async function serperSearch(query) {
  if (!process.env.SERPER_API_KEY) return [];
  try {
    const r = await fetchWithTimeout('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query }),
      timeout: 6000
    });
    const data = await r.json();
    return Array.isArray(data.organic) ? data.organic : [];
  } catch (err) {
    console.error('Serper Error:', err.message);
    return [];
  }
}

// ==========================================
// FACEBOOK PROFILE FINDER
// ==========================================
const FB_SKIP = new Set([
  'videos', 'video', 'watch', 'reel', 'reels', 'posts', 'photo', 'photos', 'groups', 'share', 'hashtag',
  'permalink.php', 'story.php', 'events', 'marketplace', 'stories', 'public', 'l.php', 'sharer', 'sharer.php',
  'login', 'help', 'policies', 'ads', 'pages', 'search', 'login.php'
]);

function fbProfiles(items, tokens) {
  const out = [];
  const seen = new Set();
  for (const it of items) {
    let u;
    try { u = new URL(it.link); } catch (e) { continue; }
    if (!/(^|\.)facebook\.com$/i.test(u.hostname)) continue;

    const segs = u.pathname.split('/').filter(Boolean);
    if (!segs.length) continue;
    const first = segs[0].toLowerCase();

    let ok = false;
    let clean = '';
    if (first === 'profile.php') {
      const id = u.searchParams.get('id');
      if (id) { ok = true; clean = `https://www.facebook.com/profile.php?id=${id}`; }
    } else if (first === 'people') {
      ok = true;
      clean = `https://www.facebook.com${u.pathname.replace(/\/$/, '')}`;
    } else if (!FB_SKIP.has(first) && segs.length === 1) {
      ok = true;
      clean = `https://www.facebook.com/${segs[0]}`;
    }
    if (!ok || seen.has(clean)) continue;

    const hay = norm(`${it.title || ''} ${it.snippet || ''} ${segs.join(' ')}`).split(' ');
    if (!tokenMatch(tokens, hay)) continue;

    seen.add(clean);
    out.push({ title: String(it.title || 'Facebook profile').replace(/\s*[|\-–]\s*Facebook.*$/i, '').trim(), link: clean });
    if (out.length >= 4) break;
  }
  return out;
}

function buildPersonTail(name, profiles, lang) {
  const searchUrl = `https://www.facebook.com/search/people/?q=${encodeURIComponent(name)}`;
  let tail = `\n\n🔎 **${T(lang, 'Facebook search for', 'Facebook search para kay')} "${titleCase(name)}":**\n${searchUrl}`;
  if (profiles.length) {
    tail += `\n\n**${T(lang, 'Possible Facebook profiles', 'Mga posibleng Facebook profile')}** (${T(lang, 'please verify before trusting', 'paki-verify muna bago maniwala')}):\n`;
    tail += profiles.map((p) => `${p.title}\n${p.link}`).join('\n\n');
  } else {
    tail += `\n\n${T(lang, 'No clear public Facebook profile was found in the search results.', 'Walang malinaw na public na Facebook profile sa mga resulta ng search.')}`;
  }
  return tail;
}

// ==========================================
// IMAGE ANALYSIS (Gemini + Mistral + OpenRouter, unahan)
// ==========================================
async function analyzeImage(base64Data, mimeType, userMessage) {
  const dataUri = `data:${mimeType};base64,${base64Data}`;
  const promptText = `You are IMACHUI GEN AI. Describe this image in detail, accurately and directly. Reply in the same language as the user's prompt (English by default). User's prompt: "${userMessage || 'Describe this image'}"`;

  const promises = [];

  if (process.env.GEMINI_API_KEY) {
    for (const gModel of ['gemini-2.5-flash', 'gemini-2.5-flash-lite']) {
      promises.push((async () => {
        const res = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }, { inline_data: { mime_type: mimeType, data: base64Data } }] }],
              generationConfig: { maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } }
            })
          }
        );
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n');
        if (text) return text;
        throw new Error(`Gemini(${gModel}): ` + (data.error?.message || data.candidates?.[0]?.finishReason || 'no text'));
      })());
    }
  }

  if (process.env.MISTRAL_API_KEY) {
    promises.push((async () => {
      const res = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MISTRAL_API_KEY}` },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          max_tokens: 1024,
          messages: [{ role: 'user', content: [{ type: 'text', text: promptText }, { type: 'image_url', image_url: dataUri }] }]
        })
      });
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return text;
      throw new Error('Mistral: ' + (data.message || data.error?.message || 'no text'));
    })());
  }

  if (process.env.OPENROUTER_API_KEY) {
    promises.push((async () => {
      const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          max_tokens: 1024,
          messages: [{ role: 'user', content: [{ type: 'text', text: promptText }, { type: 'image_url', image_url: { url: dataUri } }] }]
        })
      });
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return text;
      throw new Error('OpenRouter: ' + (data.error?.message || 'no text'));
    })());
  }

  if (promises.length === 0) return '⚠️ No API keys are available.';

  try {
    return await Promise.any(promises);
  } catch (aggErr) {
    const reasons = (aggErr.errors || []).map((e) => e.message);
    console.error('Vision failed:', reasons);
    return `⚠️ I cannot read this image right now.\n\n(${reasons.join(' | ').slice(0, 300)})`;
  }
}

// ==========================================
// AI ENGINES (DeepSeek, Mistral, OpenRouter, Gemini)
// ==========================================
const OPENAI_PROVIDERS = [
  { name: 'DeepSeek', key: 'DEEPSEEK_API_KEY', url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', extra: { temperature: 0.4, max_tokens: 4096 } },
  { name: 'Mistral', key: 'MISTRAL_API_KEY', url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest', extra: { temperature: 0.4, max_tokens: 2048 } },
  { name: 'OpenRouter', key: 'OPENROUTER_API_KEY', url: 'https://openrouter.ai/api/v1/chat/completions', model: 'meta-llama/llama-3-8b-instruct', extra: { temperature: 0.4, max_tokens: 2048 } }
];

// Non-streaming call (para sa drafts at fallback)
async function callOpenAICompat(p, apiMessages, timeout = 12000) {
  const r = await fetchWithTimeout(p.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env[p.key]}` },
    body: JSON.stringify({ model: p.model, messages: apiMessages, stream: false, ...p.extra }),
    timeout
  });
  if (!r.ok) throw new Error(`${p.name} status ${r.status}`);
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${p.name}: no text`);
  return text.trim();
}

async function callGemini(apiMessages, { grounded = false } = {}) {
  const sys = apiMessages.find((m) => m.role === 'system')?.content || '';
  const contents = [];
  for (const m of apiMessages) {
    if (m.role === 'system') continue;
    const role = m.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0].text += '\n\n' + m.content;
    else contents.push({ role, parts: [{ text: m.content }] });
  }
  while (contents.length && contents[0].role !== 'user') contents.shift();
  if (!contents.length) throw new Error('Gemini: no user message');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const attempt = async (useTools, timeout) => {
    const r = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
        ...(useTools ? { tools: [{ google_search: {} }] } : {})
      }),
      timeout
    });
    const d = await r.json();
    const text = d.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('');
    if (text) return text.trim();
    throw new Error('Gemini: ' + (d.error?.message || 'no text'));
  };

  if (grounded) {
    try { return await attempt(true, 9000); } catch (e) { console.error('Gemini grounded failed:', e.message); }
    return attempt(false, 6000);
  }
  return attempt(false, 15000);
}

// Kuha ng drafts mula sa LAHAT ng available na API nang sabay-sabay
async function gatherDrafts(apiMessages) {
  const jobs = [];
  for (const p of OPENAI_PROVIDERS) {
    if (process.env[p.key]) jobs.push(callOpenAICompat(p, apiMessages, 11000).then((text) => ({ name: p.name, text })));
  }
  if (process.env.GEMINI_API_KEY) {
    jobs.push(callGemini(apiMessages, { grounded: true }).then((text) => ({ name: 'Gemini', text })));
  }
  const settled = await Promise.allSettled(jobs);
  settled.forEach((s) => { if (s.status === 'rejected') console.error('Draft failed:', s.reason?.message); });
  return settled.filter((s) => s.status === 'fulfilled' && s.value.text).map((s) => s.value);
}

// Streaming sa unang provider na gumagana; Gemini ang huling fallback
async function streamFromProviders(apiMessages, res, head = '', tail = '') {
  for (const p of OPENAI_PROVIDERS) {
    if (!process.env[p.key]) continue;
    try {
      const response = await fetchWithTimeout(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env[p.key]}` },
        body: JSON.stringify({ model: p.model, messages: apiMessages, stream: true, ...p.extra }),
        timeout: 20000
      });
      if (response.ok) {
        await streamResponse(response, res, head, tail);
        return true;
      }
      console.error(`${p.name} status:`, response.status);
    } catch (e) {
      console.error(`${p.name} failed:`, e.message);
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const text = await callGemini(apiMessages);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.status(200).send(head + text + tail);
      return true;
    } catch (e) {
      console.error('Gemini failed:', e.message);
    }
  }
  return false;
}

const SYNTHESIS_ON = () => /^(1|true|yes|on)$/i.test(String(process.env.ENABLE_MULTI_AI_SYNTHESIS || '').trim());

// ==========================================
// MAIN HANDLER
// ==========================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  const messages = body?.messages || [];
  const lastMessage = messages[messages.length - 1];

  // Ang tinype ng user (body.message) ang uunahin, para hindi mapalitan ng text ng PDF
  let userMessage = body?.message || '';
  let hasImage = false;
  let imageBase64 = '';

  if (lastMessage && Array.isArray(lastMessage.content)) {
    for (const part of lastMessage.content) {
      if (part.type === 'image') { hasImage = true; imageBase64 = part.image; }
      else if (part.type === 'text' && part.text && !userMessage) { userMessage = part.text; }
    }
  }

  if (!userMessage && !hasImage) return res.status(400).json({ error: 'No message provided' });

  // ---------- IMAGE LOGIC ----------
  if (hasImage) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    try {
      if (typeof imageBase64 !== 'string' || !imageBase64.includes(',')) {
        return res.status(200).send('⚠️ Invalid image format.');
      }
      const base64Data = imageBase64.split(',')[1];
      const mimeType = imageBase64.split(';')[0].split(':')[1] || 'image/jpeg';
      const answer = await analyzeImage(base64Data, mimeType, userMessage);
      return res.status(200).send(answer);
    } catch (e) {
      return res.status(200).send(`⚠️ Error: ${e.message}`);
    }
  }

  // ==========================================
  // TEXT LOGIC
  // ==========================================
  const shortMsg = userMessage.slice(0, 300);
  const lowerUserMessage = shortMsg.toLowerCase();
  const lang = detectLang(shortMsg);
  const now = new Date();
  const phTime = now.toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'full', timeStyle: 'long' });

  const sendPlain = (text) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(text);
  };

  // ---------- 1. CREATOR / FOUNDER ----------
  const creatorIntent = detectCreatorIntent(shortMsg);
  if (creatorIntent) {
    const founderMode = creatorIntent === 'founder';
    if (lang === 'tl') return sendPlain(storyFilipino(phTime, founderMode));
    if (lang === 'en') return sendPlain(storyEnglish(phTime, founderMode));

    // Ibang language (Bisaya, Spanish, atbp.): ipapa-translate sa AI, English kapag pumalya
    const english = storyEnglish(phTime, founderMode);
    const translateMessages = [
      {
        role: 'system',
        content: `You are a professional translator. Translate the user's text into ${LANG_LABEL[lang]} with perfect grammar. Keep every name, number, emoji, and **bold** markdown exactly as written. Output only the translation.`
      },
      { role: 'user', content: english }
    ];
    const ok = await streamFromProviders(translateMessages, res);
    if (ok) return;
    return sendPlain(english);
  }

  // ---------- 2. RPR ADMINS / MEMBER COUNT ----------
  const mentionsRpr = /(rpr|reaper)/i.test(shortMsg);
  if (mentionsRpr && RPR_DATA.length) {
    const asksList = /(who|sino|list|lahat|ano|sinu|kinsa|ilan|pila|how many|total|show)/i.test(shortMsg);
    const asksAdmin = /(admins?|officers?)/i.test(shortMsg);
    const asksMembers = /(members?|miyembro|kasapi)/i.test(shortMsg);

    if (asksAdmin && asksList) {
      const admins = RPR_DATA.filter((m) => String(m.role).toUpperCase() === 'ADMIN');
      const founder = RPR_DATA.find((m) => /FOUNDER/i.test(m.role));
      let out = `**${T(lang, 'REAPER (RPR) Leadership', 'Pamunuan ng REAPER (RPR)')}**\n\n`;
      if (founder) out += `**${T(lang, 'Founder / Creator', 'Founder / Creator')}**\n${formatRprEntry(founder)}\n\n`;
      out += `**Admins (${admins.length})**\n${admins.map(formatRprEntry).join('\n')}`;
      return sendPlain(out);
    }

    if (asksMembers && asksList) {
      const v1 = RPR_DATA.filter((m) => /V1/i.test(m.version)).length;
      const out = T(
        lang,
        `**REAPER (RPR)** has **${RPR_DATA.length}** members (V1 Main accounts: ${v1}, other versions: ${RPR_DATA.length - v1}).\n\nTo find someone, ask me like this:\n• Who is Panuway\n• Who is Jomar\n• Who are the admins of RPR`,
        `Ang **REAPER (RPR)** ay may **${RPR_DATA.length}** na members (V1 Main accounts: ${v1}, ibang version: ${RPR_DATA.length - v1}).\n\nPara may hanapin, itanong mo ito nang ganito:\n• Sino si Panuway\n• Sino si Jomar\n• Sino ang mga admin ng RPR`
      );
      return sendPlain(out);
    }
  }

  // ---------- 3. DATABASE LOOKUP + PERSON SEARCH ----------
  const personName = extractPersonName(shortMsg);
  const wordCount = shortMsg.trim().split(/\s+/).length;
  const lookupText = personName || (wordCount <= 4 ? shortMsg : '');
  const local = findLocal(queryTokens(lookupText));
  const foundLocal = hasLocalMatch(local);
  const lookupName = personName || (foundLocal ? lookupText.replace(/[?!.,]+$/g, '').trim() : null);

  let personContext = '';
  let personTail = '';
  let dbHead = '';

  if (lookupName) {
    const nameTokens = queryTokens(lookupName);
    const [fbResults, webResults] = await Promise.all([
      serperSearch(`site:facebook.com "${lookupName}"`),
      serperSearch(`"${lookupName}"`)
    ]);

    const profiles = fbProfiles([...fbResults, ...webResults], nameTokens);
    personTail = buildPersonTail(lookupName, profiles, lang);

    const webLines = [];
    const seenLinks = new Set();
    for (const item of [...webResults, ...fbResults]) {
      if (!item.link || seenLinks.has(item.link)) continue;
      seenLinks.add(item.link);
      webLines.push(`Title: ${item.title}\nSnippet: ${item.snippet || ''}\nSource: ${item.link}`);
      if (webLines.length >= 6) break;
    }
    personContext = webLines.join('\n\n');
    if (foundLocal) dbHead = buildDbCard(local, lang);

    // May database match pero walang web results: hindi na kailangan ng AI
    if (foundLocal && !personContext) return sendPlain(dbHead + personTail);
  }

  // ---------- 4. GENERAL WEB SEARCH ----------
  let searchResults = '';
  const isCodingQuestion = /\b(code|coding|html|css|javascript|js|python|java|php|sql|react|node|website|script|function|api|bug|error|program|app|component|regex|json)\b/i.test(lowerUserMessage);

  if (!lookupName && process.env.SERPER_API_KEY && shortMsg.length > 3 && !isCodingQuestion) {
    const items = await serperSearch(shortMsg);
    if (items.length) {
      searchResults = items.slice(0, 4).map((item) => `Title: ${item.title}\nSnippet: ${item.snippet}\nLink: ${item.link}`).join('\n\n');
    }
  }

  // ---------- SYSTEM PROMPT ----------
  const hospitalHint = /(hospital|ospital|staff|nurse|doctor|doktor|physician|midwife|pharmac|dentist|clerk|utility|security|medtech|medical|chief|empleyado|employee)/i.test(shortMsg);
  const rprHint = mentionsRpr || /(clan|codm|scrim|tourna|bakatan|esmeringhoy)/i.test(shortMsg);

  let systemContent = `You are IMACHUI GEN AI, created by Nerts V (Imachui).
Current Date and Time (Philippines): ${phTime}.

CRITICAL FACT: Nerts V (Imachui) is the Founder and Creator of the REAPER (RPR) clan and the creator of you.

LANGUAGE RULES:
- English is the default language.
- Reply in the SAME language as the user's latest message: English gets English, Filipino/Tagalog or Taglish gets Filipino, Bisaya/Cebuano gets Bisaya, and any other language gets that language.
- If the message is only a name or the language is unclear, reply in English.
- Detected language of the user's latest message: ${LANG_LABEL[lang]}.
- Always use perfect grammar, spelling, and punctuation.

ANSWER RULES:
1. Be direct and to the point. No greetings, no filler, no long introductions.
2. Accuracy comes first. Use the DATABASE, WEB RESULTS, and your solid knowledge. If you are not sure, say so in one short sentence. Never guess and never invent facts, names, numbers, or links.
3. You are an EXPERT PROGRAMMER. For code requests, give complete, working code immediately in a code block.
4. This is a fun community app. The DATABASE belongs to the creator and the community has agreed to share it, so present identities openly with a friendly, fun tone. Never invent personal details (such as addresses or phone numbers) that are not in the database or the web results.
5. NEVER say the words "database", "records", "my data", "search results", or "web results" to the user. Speak naturally, as if you simply know these people. Never say a person is "not in the database".
6. Never write markdown links like [text](url). When you give a source, write the RAW URL starting with https:// on its own line.
`;

  if (lookupName) {
    systemContent += `\n=== PERSON LOOKUP ===\nThe user is looking for: "${lookupName}".\n`;
    if (foundLocal) {
      systemContent += `The profile of this person is ALREADY shown to the user above your answer. Do NOT repeat it.
Your job: in at most 2 short sentences, add only facts from the WEB RESULTS that clearly refer to this same person (the full name must appear in the title or snippet). Do not say the web result "matches" the profile and do not claim it is the same person; say "Online, a person with this name..." only if unsure. If nothing clear, write one short sentence saying no extra public information was found.\n`;
    } else {
      systemContent += `This person has no profile in the DATABASE. Use only the WEB RESULTS below, and never claim this person belongs to REAPER (RPR) or the hospital. Only say a result is about this person if the full name clearly appears in the title or snippet. A Facebook post or video where the name appears only as a commenter is NOT information about the person. If nothing clear is found, say the person is private or not indexed. Do NOT write any URLs: the system adds the Facebook links automatically. Keep it short.\n`;
    }
    if (personContext) systemContent += `\n=== WEB RESULTS ===\n${personContext}\n`;
  }

  if (hospitalHint && !lookupName) {
    systemContent += `\n=== HOSPITAL STAFF LIST (name — job title) ===\nAnswer questions about staff only from this list.\n${STAFF_ALL.map((s) => `${prettyStaffName(s.name)} — ${s.job_title}`).join('\n')}\n`;
  }

  if (rprHint && !lookupName) {
    systemContent += `\n=== REAPER KNOWLEDGE BASE ===\n${REAPER_DESCRIPTION}\n`;
    if (RPR_DATA.length) {
      systemContent += `\n=== RPR MEMBERS (nickname — real name — role) ===\n${RPR_DATA.map((m) => `${m.nickname} — ${m.real_name} — ${m.role}`).join('\n')}\n`;
    }
  }

  if (searchResults) {
    systemContent += `\n=== LATEST WEB SEARCH RESULTS ===\n${searchResults}\n\nBase factual claims on these results when they are relevant, and include the source links as raw URLs.`;
  }

  const sanitizedMessages = messages
    .map((msg) => {
      const textContent = typeof msg.content === 'string'
        ? msg.content
        : (Array.isArray(msg.content) ? msg.content.filter((c) => c.type === 'text').map((c) => c.text || '').join('\n') : '');
      return { role: msg.role, content: textContent };
    })
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content && m.content.trim());

  let apiMessages = [{ role: 'system', content: systemContent }, ...sanitizedMessages];
  const headWithGap = dbHead ? dbHead + '\n\n' : '';

  // ---------- MULTI-AI SYNTHESIS (kapag ON ang ENABLE_MULTI_AI_SYNTHESIS) ----------
  if (SYNTHESIS_ON() && !lookupName && !isCodingQuestion && shortMsg.length > 15) {
    const drafts = await gatherDrafts(apiMessages);

    if (drafts.length === 1) {
      return sendPlain(drafts[0].text);
    }

    if (drafts.length >= 2) {
      const draftBlock = drafts
        .map((d, i) => `[Draft ${i + 1}]\n${d.text.slice(0, 6000)}`)
        .join('\n\n');

      const synthSystem = `${systemContent}

=== DRAFT ANSWERS FROM OTHER EXPERTS ===
${draftBlock}

=== FINAL TASK ===
Write ONE final answer for the user. Keep the parts that are correct and agree with the DATABASE and WEB RESULTS, and remove anything doubtful, contradicted, or repeated. If the drafts disagree and you cannot verify which is right, say what is uncertain in one short sentence. Be direct and to the point, in the user's language, with perfect grammar. Never mention drafts, experts, or other AIs.`;

      const synthMessages = [{ role: 'system', content: synthSystem }, ...sanitizedMessages];
      const ok = await streamFromProviders(synthMessages, res);
      if (ok) return;
      return sendPlain(drafts[0].text); // kung pumalya ang synthesis, ibigay ang unang draft
    }
    // 0 drafts: subukan ang normal na streaming sa ibaba
  }

  // ---------- NORMAL STREAMING ----------
  const ok = await streamFromProviders(apiMessages, res, headWithGap, personTail);
  if (ok) return;

  // ---------- FALLBACK: kahit walang AI, ibigay pa rin ang database at links ----------
  if (lookupName) {
    const body = foundLocal
      ? dbHead
      : T(lang, `I could not find any information about "${titleCase(lookupName)}".`, `Wala akong nakitang impormasyon tungkol kay "${titleCase(lookupName)}".`);
    return sendPlain(body + personTail);
  }

  return res.status(500).json({ error: 'All AI providers failed.' });
}

// ==========================================
// STREAMING (may buffer; may "head" at "tail")
// ==========================================
async function streamResponse(response, res, head = '', tail = '') {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  if (head) res.write(head);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content || '';
          if (content) res.write(content);
        } catch (e) {}
      }
    }
  }

  if (tail) res.write(tail);
  res.end();
}
