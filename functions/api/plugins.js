import { checkAdmin } from '../../lib/auth.js';
import { redis, storeConfigured } from '../../lib/store.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    if (request.method === 'GET') {
      // Dito ilalagay ang logic mo para sa pagkuha ng plugins. 
      // Pansamantala, empty array muna para walang error.
      return new Response(JSON.stringify({ configured: storeConfigured(), plugins: [] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (body.action && body.action.startsWith('admin_')) {
        const auth = checkAdmin(request, env);
        if (!auth.ok) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      // Dito ilalagay ang logic mo para sa pag-save/toggle.
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('Plugins error:', e.message);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}
