// api/admin.js — pamamahala ng dagdag na database (mga tao at impormasyon)
// Lahat ay nangangailangan ng:  Authorization: Bearer <ADMIN_KEY>
import { checkAdmin, setCors, readBody } from '../lib/auth.js';
import { redis, storeConfigured, DB_KEY } from '../lib/store.js';
import { getExtraEntries, sanitizeEntry, clearExtraCache } from '../lib/knowledge.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = checkAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    if (req.method === 'GET') {
      const entries = await getExtraEntries({ force: true });
      return res.status(200).json({ configured: storeConfigured(), entries });
    }

    if (req.method === 'POST') {
      if (!storeConfigured()) {
        return res.status(503).json({ error: 'Storage is not configured. Add the Upstash Redis variables in Vercel first.' });
      }
      const entry = sanitizeEntry(readBody(req));
      if (!entry) return res.status(400).json({ error: 'Invalid entry. A name is required (and a description for info entries).' });
      await redis(['HSET', DB_KEY, entry.id, JSON.stringify(entry)]);
      clearExtraCache();
      return res.status(200).json({ ok: true, entry });
    }

    if (req.method === 'DELETE') {
      if (!storeConfigured()) return res.status(503).json({ error: 'Storage is not configured.' });
      const id = String((req.query && req.query.id) || readBody(req).id || '').trim();
      if (!id) return res.status(400).json({ error: 'Missing id.' });
      await redis(['HDEL', DB_KEY, id]);
      clearExtraCache();
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('Admin error:', e.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
