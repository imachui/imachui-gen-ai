// lib/knowledge.js — dagdag na database (mga tao at impormasyon)
// Dalawang pinagmulan, pinagsasama:
//   1) knowledge-data.json  (i-edit sa GitHub)
//   2) Redis (idinadagdag sa admin.html)
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { redis, storeConfigured, DB_KEY } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadJson(file) {
  const candidates = [path.join(process.cwd(), file), path.join(__dirname, '..', file)];
  for (const p of candidates) {
    try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) {}
  }
  return null;
}

const GROUPS = ['RPR', 'Hospital', 'Other'];
const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

// Linisin at i-validate ang isang entry. Returns null kung hindi valid.
export function sanitizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = raw.type === 'info' ? 'info' : 'person';
  const name = clean(raw.name, 120);
  const description = clean(raw.description, 1500);
  if (!name) return null;
  if (type === 'info' && !description) return null;

  let aliases = raw.aliases;
  if (typeof aliases === 'string') aliases = aliases.split(',');
  if (!Array.isArray(aliases)) aliases = [];
  aliases = aliases.map((a) => clean(a, 40)).filter(Boolean).slice(0, 12);

  const id = clean(raw.id, 60).replace(/[^a-zA-Z0-9_\-]/g, '') ||
    'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  return {
    id,
    type,
    group: GROUPS.includes(raw.group) ? raw.group : 'Other',
    name,
    role: clean(raw.role, 120),
    aliases,
    description
  };
}

export function getFileEntries() {
  const data = loadJson('knowledge-data.json');
  if (!Array.isArray(data)) return [];
  return data.map(sanitizeEntry).filter(Boolean).map((e) => ({ ...e, source: 'file' }));
}

let cache = { t: 0, redisEntries: [] };

export function clearExtraCache() {
  cache = { t: 0, redisEntries: cache.redisEntries };
}

// Lahat ng dagdag na entries (file + Redis). May 60 segundong cache para mabilis.
export async function getExtraEntries({ force = false } = {}) {
  const fileEntries = getFileEntries();

  if (storeConfigured() && (force || Date.now() - cache.t > 60000)) {
    try {
      const flat = await redis(['HGETALL', DB_KEY]);
      const entries = [];
      if (Array.isArray(flat)) {
        for (let i = 1; i < flat.length; i += 2) {
          try {
            const e = sanitizeEntry(JSON.parse(flat[i]));
            if (e) entries.push({ ...e, source: 'redis' });
          } catch (err) {}
        }
      }
      cache = { t: Date.now(), redisEntries: entries };
    } catch (err) {
      console.error('Extra entries failed:', err.message);
      cache = { t: Date.now(), redisEntries: cache.redisEntries };
    }
  }

  const seen = new Set();
  const out = [];
  for (const e of [...cache.redisEntries, ...fileEntries]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}
