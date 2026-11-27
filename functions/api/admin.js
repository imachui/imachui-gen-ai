import { checkAdmin, readBody } from '../../lib/auth.js';
import { redis, storeConfigured, DB_KEY } from '../../lib/store.js';
import { getExtraEntries, sanitizeEntry, clearExtraCache } from '../../lib/knowledge.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const auth = checkAdmin(request, env);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    if (request.method === 'GET') {
      const entries = await getExtraEntries({ force: true });
      return new Response(JSON.stringify({ configured: storeConfigured(), entries }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'POST') {
      if (!storeConfigured()) {
        return new Response(JSON.stringify({ error: 'Storage is not configured. Add the Upstash Redis variables.' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const body = await request.json().catch(() => ({}));
      const entry = sanitizeEntry(body);
      if (!entry) {
        return new Response(JSON.stringify({ error: 'Invalid entry. A name is required (and a description for info entries).' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await redis(['HSET', DB_KEY, entry.id, JSON.stringify(entry)]);
      clearExtraCache();
      return new Response(JSON.stringify({ ok: true, entry }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'DELETE') {
      if (!storeConfigured()) {
        return new Response(JSON.stringify({ error: 'Storage is not configured.' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const id = String(url.searchParams.get('id') || '').trim();
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing id.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await redis(['HDEL', DB_KEY, id]);
      clearExtraCache();
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Admin error:', e.message);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
