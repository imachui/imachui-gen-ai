import { checkAdmin, readBody } from '../../lib/auth.js';
import { redis, storeConfigured, FEEDBACK_KEY } from '../../lib/store.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    if (request.method === 'GET' || request.method === 'DELETE') {
      const auth = checkAdmin(request, env);
      if (!auth.ok) {
        return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!storeConfigured()) {
        return new Response(JSON.stringify({ configured: false, items: [] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (request.method === 'GET') {
        const flat = await redis(['LRANGE', FEEDBACK_KEY, 0, 199]);
        const items = [];
        if (Array.isArray(flat)) {
          for (const str of flat) { try { items.push(JSON.parse(str)); } catch (e) {} }
        }
        return new Response(JSON.stringify({ configured: true, items }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (request.method === 'DELETE') {
        await redis(['DEL', FEEDBACK_KEY]);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    if (request.method === 'POST') {
      if (!storeConfigured()) return new Response(JSON.stringify({ ok: true, note: 'Not saved (no storage)' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      
      const body = await request.json().catch(() => ({}));
      const vote = body.vote === 'down' ? 'down' : 'up';
      const item = {
        vote,
        question: String(body.question || '').slice(0, 500),
        answer: String(body.answer || '').slice(0, 1500),
        comment: String(body.comment || '').slice(0, 500),
        t: Date.now()
      };
      
      await redis(['LPUSH', FEEDBACK_KEY, JSON.stringify(item)]);
      await redis(['LTRIM', FEEDBACK_KEY, 0, 1999]);
      
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('Feedback error:', e.message);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}
