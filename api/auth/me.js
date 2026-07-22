// GET /api/auth/me — return the current session user, or 401.
// POST /api/auth/me — update current user profile (e.g. background)
const { getSession, getUsers, saveUsers } = require('../_lib');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (!process.env.JWT_SECRET) { res.status(500).json({ error: 'JWT_SECRET env var not set.' }); return; }

    if (req.method === 'GET') {
      const user = getSession(req);
      if (user) {
        const users = await getUsers();
        const dbUser = users.find(u => u.email === user.email);
        res.status(200).json({ email: user.email, name: user.name, role: user.role, bg: dbUser ? dbUser.bg : null, calUrl: dbUser ? dbUser.calUrl : null });
        return;
      }
      const users = await getUsers();
      res.status(401).json({ error: 'Not logged in', setup: users.length === 0 });
      return;
    }

    if (req.method === 'POST') {
      const user = getSession(req);
      if (!user) { res.status(401).json({error: 'Not logged in'}); return; }
      const users = await getUsers();
      const dbUser = users.find(u => u.email === user.email);
      if (!dbUser) { res.status(404).json({error: 'User not found'}); return; }
      
      let body = req.body;
      if (typeof body === 'string') try { body = JSON.parse(body); } catch(e){}
      
      if (body.bg !== undefined) dbUser.bg = body.bg;
      if (body.calUrl !== undefined) dbUser.calUrl = body.calUrl;
      
      await saveUsers(users);
      res.status(200).json({ ok: true, bg: dbUser.bg, calUrl: dbUser.calUrl });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
