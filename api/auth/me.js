// GET /api/auth/me — return the current session user, or 401.
// When not logged in, also checks if any users exist (for first-time setup detection).
const { getSession, getUsers } = require('../_lib');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET only' }); return; }

  try {
    if (!process.env.JWT_SECRET) { res.status(500).json({ error: 'JWT_SECRET env var not set.' }); return; }

    const user = getSession(req);
    if (user) {
      res.status(200).json({ email: user.email, name: user.name, role: user.role });
      return;
    }

    // Not logged in — check if any users exist so the client can show setup vs login
    const users = await getUsers();
    res.status(401).json({ error: 'Not logged in', setup: users.length === 0 });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
