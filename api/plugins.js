// api/plugins.js — Plugin marketplace
//   POST {action:'catalog', sid}                    -> listahan ng lahat ng plugin + status ng user
//   POST {action:'install', sid, id, perms}         -> reader/demo: i-install agad. account: {url} para sa sign-in. ai: {needsKey:true}
//   POST {action:'uninstall', sid, id}              -> alisin (binubura rin ang token/key kung account o AI)
//   POST {action:'toggle', sid, id, on}             -> active / inactive
//   POST {action:'permissions', sid, id, perms}     -> palitan ang optional permissions
//   Admin (Authorization: Bearer <ADMIN_KEY>):
//   GET                                             -> listahan + bilang ng installs
//   POST {action:'admin_save', plugin}              -> gumawa/mag-edit ng sariling plugin
//   POST {action:'admin_delete', id}                -> burahin ang sariling plugin
//   POST {action:'admin_flag', id, hidden, featured}
import { checkAdmin, setCors, readBody } from '../lib/auth.js';
import { storeConfigured } from '../lib/store.js';
import {
  SID_RX, oauthReady, isConfigured, listConnected, cleanServices, createState, buildAuthUrl,
  removeService, removeUserKey
} from '../lib/oauth.js';
import * as PL from '../lib/plugins.js';

const ADMIN_ACTIONS = new Set(['admin_save', 'admin_delete', 'admin_flag']);

export default async function handler(req, res) {
  setCors(res, 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ---------- Admin: listahan ----------
    if (req.method === 'GET') {
      const auth = checkAdmin(req);
      if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
      return res.status(200).json({ configured: storeConfigured(), plugins: await PL.adminList() });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = readBody(req);
    const action = String(body.action || '');

    // ---------- Admin: mga aksyon ----------
    if (ADMIN_ACTIONS.has(action)) {
      const auth = checkAdmin(req);
      if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
      if (!storeConfigured()) return res.status(503).json({ error: 'Storage is not configured.' });
      if (action === 'admin_save') return res.status(200).json({ ok: true, plugin: await PL.adminSaveCustom(body.plugin) });
      if (action === 'admin_delete') { await PL.adminDeleteCustom(String(body.id || '')); return res.status(200).json({ ok: true }); }
      await PL.adminFlag(String(body.id || ''), { hidden: body.hidden, featured: body.featured });
      return res.status(200).json({ ok: true });
    }

    // ---------- Mga aksyon ng user ----------
    const sid = String(body.sid || '');
    if (action === 'catalog') {
      const plugins = await PL.listForUser(sid);
      const status = await PL.getStatus(sid);
      return res.status(200).json({ ready: storeConfigured(), signIn: oauthReady(), customized: status.customized, plugins });
    }

    if (!storeConfigured()) return res.status(503).json({ error: 'Plugins need storage, which is not set up yet.' });
    if (!SID_RX.test(sid)) return res.status(400).json({ error: 'Invalid session.' });
    const id = String(body.id || '');
    if (!PL.ID_RX.test(id)) return res.status(400).json({ error: 'Invalid plugin.' });

    if (action === 'install') {
      const e = (await PL.getCatalog()).find((x) => x.id === id);
      if (!e) return res.status(404).json({ error: 'Plugin not found.' });
      if (e.status) return res.status(400).json({ error: 'This plugin is not available yet.' });

      if (e.kind === 'account') {
        if (!oauthReady() || !isConfigured(e.provider)) return res.status(503).json({ error: 'Sign-in for this platform is not set up on the server yet.' });
        const existing = (await listConnected(sid)).find((c) => c.provider === e.provider);
        const want = cleanServices(e.provider, e.service ? [e.service] : []);
        const services = [...new Set([...(existing ? existing.services : []), ...want])];
        const nonce = await createState(sid, e.provider, services, want, e.id);
        return res.status(200).json({ ok: true, url: buildAuthUrl(e.provider, nonce, services) });
      }
      if (e.kind === 'ai') return res.status(200).json({ ok: true, needsKey: true });

      await PL.installSimple(sid, id, body.perms);
      return res.status(200).json({ ok: true });
    }

    if (action === 'uninstall') {
      await PL.uninstall(sid, id, {
        removeAccount: async (e) => { if (oauthReady()) await removeService(sid, e.provider, e.service || ''); },
        removeKey: async (e) => { if (oauthReady()) await removeUserKey(sid, e.keyId); }
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'toggle') {
      await PL.setActive(sid, id, body.on === true);
      return res.status(200).json({ ok: true });
    }

    if (action === 'permissions') {
      await PL.setPermissions(sid, id, body.perms);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (e) {
    if (e instanceof PL.PluginError) return res.status(e.status).json({ error: e.message });
    console.error('Plugins error:', e.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
