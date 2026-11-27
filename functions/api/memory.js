import { redis, storeConfigured } from '../../lib/store.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(request.url);
  const sid = url.searchParams.get('sid') || '';
  const key = `imachui:memory:${sid}`;

  try {
    if (request.method === 'GET') {
      if (!sid) return new Response(JSON.stringify({ facts: [] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const flat = await redis(['LRANGE', key, 0, 49]).catch(() => []);
      const facts = Array.isArray(flat) ? flat.map((f) => { try { return JSON.parse(f); } catch (e) { return f; } }) : [];
      return new Response(JSON.stringify({ facts }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!sid || !body.fact) return new Response(JSON.stringify({ error: 'Missing data' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      
      await redis(['LPUSH', key, JSON.stringify(body.fact)]);
      await redis(['LTRIM', key, 0, 49]);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (request.method === 'DELETE') {
      if (sid) await redis(['DEL', key]);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (e) {
    console.error('Memory error:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}
