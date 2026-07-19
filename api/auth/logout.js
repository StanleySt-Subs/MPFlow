// POST /api/auth/logout — clear the auth cookie
const { clearTokenCookie } = require('../_lib');

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  clearTokenCookie(res);
  res.status(200).json({ ok: true });
};
