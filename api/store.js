// The shared data file. Requires login — any role can read, only admin can write.
// GET  -> returns the file (or null if it doesn't exist yet)
// PUT  -> overwrites it (admin only)
const KEY = 'sst-store.json';
const { requireAuth, requireAdmin } = require('./_lib');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      res.status(500).json({ error: 'Blob storage not enabled. Vercel -> Storage -> Create -> Blob -> Connect, then redeploy.' });
      return;
    }

    // GET: any logged-in user can read
    if (req.method === 'GET') {
      const user = requireAuth(req, res);
      if (!user) return;

      const { list } = require('@vercel/blob');
      const { blobs } = await list({ prefix: KEY, limit: 1 });
      if (!blobs.length) { res.status(200).send('null'); return; }
      const r = await fetch(blobs[0].url + '?v=' + Date.now());
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(200).send(await r.text());
      return;
    }

    // PUT/POST: only admins can write
    if (req.method === 'PUT' || req.method === 'POST') {
      const user = requireAdmin(req, res);
      if (!user) return;

      let body = req.body;
      if (typeof body !== 'object' || body === null) {
        try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; }
      }
      const { put } = require('@vercel/blob');
      await put(KEY, JSON.stringify(body), {
        access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json'
      });
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
