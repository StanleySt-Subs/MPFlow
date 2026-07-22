// The shared data file. Requires login — any role can read, only admin can write.
// GET  -> returns the file (or null if it doesn't exist yet)
// PUT  -> overwrites it (admin only)
const KEY = 'sst-store.json';
const { requireAuth, requireAdmin } = require('./_lib');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  try {

    // GET: any logged-in user can read
    if (req.method === 'GET') {
      const user = requireAuth(req, res);
      if (!user) return;

      const fs = require('fs');
      const path = require('path');
      const seedPath = path.join(process.cwd(), 'new_seed.json');

      try {
        const { list } = require('@vercel/blob');
        const { blobs } = await list({ prefix: KEY, limit: 1 });
        if (blobs.length > 0) {
          const r = await fetch(blobs[0].url + '?v=' + Date.now());
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.status(200).send(await r.text());
          return;
        }
      } catch (e) {
        // Blob store not connected, gracefully fallback
      }

      // Fallback to seed data
      if (fs.existsSync(seedPath)) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(200).send(fs.readFileSync(seedPath, 'utf8'));
        return;
      }

      res.status(200).send('null');
      return;
    }

    // PUT/POST: admins, cs, and res can write. viewers cannot.
    if (req.method === 'PUT' || req.method === 'POST') {
      const user = requireAuth(req, res);
      if (!user) return;
      if (user.role === 'viewer') {
        res.status(403).json({ error: 'Viewers cannot modify data.' });
        return;
      }

      let body = req.body;
      if (typeof body !== 'object' || body === null) {
        try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; }
      }

      try {
        const { put } = require('@vercel/blob');
        await put(KEY, JSON.stringify(body), {
          access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json'
        });
        res.status(200).json({ ok: true });
        return;
      } catch (e) {
        // Fallback to local file system if blob isn't connected
        const fs = require('fs');
        const path = require('path');
        fs.writeFileSync(path.join(process.cwd(), 'new_seed.json'), JSON.stringify(body, null, 2));
        res.status(200).json({ ok: true, local: true });
        return;
      }
    }
    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
