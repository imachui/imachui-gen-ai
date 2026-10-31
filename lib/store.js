// lib/store.js — maliit na helper para sa Upstash Redis / Vercel KV (REST, walang SDK)
// Env vars (alinman sa dalawang set):
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//   KV_REST_API_URL + KV_REST_API_TOKEN   (kapag gumamit ng Vercel integration)

export const DB_KEY = 'imachui:db';
export const FEEDBACK_KEY = 'imachui:feedback';

const baseUrl = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const token = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

export const storeConfigured = () => Boolean(baseUrl() && token());

// Isang Redis command, halimbawa: redis(['HSET', 'key', 'field', 'value'])
export async function redis(command) {
  if (!storeConfigured()) throw new Error('Storage is not configured.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const r = await fetch(baseUrl(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      signal: controller.signal
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.error) throw new Error(data.error || `Storage status ${r.status}`);
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}
