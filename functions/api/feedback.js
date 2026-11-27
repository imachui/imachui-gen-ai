// api/feedback.js — thumbs up / thumbs down
//   POST   (public) : mag-save ng feedback
//   GET    (admin)  : basahin ang feedback   (Authorization: Bearer ADMIN_KEY)
//   DELETE (admin)  : burahin lahat
// Kapag walang Redis, nakikita pa rin ang feedback sa Vercel Logs (hanapin ang "FEEDBACK").
import { checkAdmin, setCors, readBody } from '../lib/auth.js';
import { redis, storeConfigured, FEEDBACK_KEY } from '../lib/store.js';

const clean = (v, max) => String(v == null ? '' : v).replace(/\u0000/g, '').trim().slice(0, max);

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST') {
      const body = readBody(req);
      const vote = body.vote === 'up' ? 'up' : body.vote === 'down' ? 'down' : '';
      if (!vote) return res.status(400).json({ error: 'Invalid vote.' });

      const record = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        t: new Date().toISOString(),
        vote,
        question: clean(body.question, 600),
        answer: clean(body.answer, 1500),
        comment: clean(body.comment, 500),
        uid: clean(body.uid, 40)
      };

      console.log('FEEDBACK', JSON.stringify(record));

      let stored = false;
      if (storeConfigured()) {
        try {
          await redis(['LPUSH', FEEDBACK_KEY, JSON.stringify(record)]);
          await redis(['LTRIM', FEEDBACK_KEY, 0, 999]);
          stored = true;
        } catch (e) {
          console.error('Feedback store failed:', e.message);
        }
      }
      return res.status(200).json({ ok: true, stored });
    }

    const auth = checkAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    if (req.method === 'GET') {
      if (!storeConfigured()) return res.status(200).json({ configured: false, items: [] });
      const rows = await redis(['LRANGE', FEEDBACK_KEY, 0, 299]);
      const items = (Array.isArray(rows) ? rows : [])
        .map((r) => { try { return JSON.parse(r); } catch (e) { return null; } })
        .filter(Boolean);
      return res.status(200).json({ configured: true, items });
    }

    if (req.method === 'DELETE') {
      if (!storeConfigured()) return res.status(503).json({ error: 'Storage is not configured.' });
      await redis(['DEL', FEEDBACK_KEY]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('Feedback error:', e.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
