// The rate card — server-side, behind a passphrase AND login.
// Requires: logged in + correct COSTS_KEY passphrase.
// Set the passphrase once in Vercel:  Settings -> Environment Variables ->
//   COSTS_KEY = whatever-you-choose
// Share it only with the people allowed to see money.
const crypto = require('crypto');
const KEY = 'sst-rates.json';
const { requireAuth } = require('./_lib');

function keyOk(req) {
  const want = process.env.COSTS_KEY || '';
  const got = String(req.headers['x-costs-key'] || '');
  if (!want || !got || want.length !== got.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    // Must be logged in first
    const user = requireAuth(req, res);
    if (!user) return;

    if (!process.env.COSTS_KEY) { res.status(500).json({ error: 'COSTS_KEY env var not set in Vercel — costs are disabled until it is.' }); return; }
    if (!keyOk(req)) { res.status(403).json({ error: 'wrong passphrase' }); return; }

    if (req.method === 'GET') {
      const { list } = require('@vercel/blob');
      const { blobs } = await list({ prefix: KEY, limit: 1 });
      if (!blobs.length) { res.status(200).json({}); return; }
      const r = await fetch(blobs[0].url + '?v=' + Date.now());
      res.status(200).send(await r.text());
      return;
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      let body = req.body;
      if (typeof body !== 'object' || body === null) { try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; } }
      const clean = {};
      Object.entries(body).forEach(([k, v]) => { const n = parseFloat(v); if (k && isFinite(n) && n >= 0) clean[k] = n; });
      const { put } = require('@vercel/blob');
      await put(KEY, JSON.stringify(clean), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: 'method' });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
