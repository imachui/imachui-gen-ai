import { timingSafeEqual } from 'node:crypto'; // Gumagana ito sa Cloudflare kapag may nodejs_compat

export function checkAdmin(req, env) {
  const key = env.ADMIN_KEY; // Kinukuha mula sa Cloudflare env
  if (!key) return { ok: false, status: 503, error: 'ADMIN_KEY is not set.' };

  const header = String((req.headers && req.headers.get('authorization')) || '');
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  
  try {
    const a = Buffer.from(given);
    const b = Buffer.from(key);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, status: 401, error: 'Wrong admin key.' };
    return { ok: true };
  } catch (e) {
    return { ok: false, status: 500, error: 'Auth error.' };
  }
}

export function readBody(req) {
  // Sa Cloudflare, direktang ginagamit ang request.json(), kaya hindi na natin kailangan ito.
  // Pero panatilihin natin para hindi mag-error kung tawagin man.
  return {}; 
}
