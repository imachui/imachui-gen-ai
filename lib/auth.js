// lib/auth.js — proteksyon para sa admin endpoints (ADMIN_KEY sa Vercel)
import { timingSafeEqual } from 'crypto';

export function checkAdmin(req) {
  const key = process.env.ADMIN_KEY;
  if (!key) return { ok: false, status: 503, error: 'ADMIN_KEY is not set in Vercel.' };

  const header = String((req.headers && req.headers.authorization) || '');
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const a = Buffer.from(given);
  const b = Buffer.from(key);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, status: 401, error: 'Wrong admin key.' };
  return { ok: true };
}

export function setCors(res, methods = 'GET,POST,DELETE,OPTIONS') {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function readBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  return body && typeof body === 'object' ? body : {};
}
