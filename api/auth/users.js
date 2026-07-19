// /api/auth/users — admin-only user management
// GET    → list all users (no password hashes)
// PUT    → update a user's role or name  { email, role?, name? }
// DELETE → remove a user                 { email }
const { requireAdmin, getUsers, saveUsers, hashPassword } = require('../_lib');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (!process.env.JWT_SECRET) { res.status(500).json({ error: 'JWT_SECRET env var not set.' }); return; }

    const admin = requireAdmin(req, res);
    if (!admin) return;

    const users = await getUsers();

    // ── LIST ──
    if (req.method === 'GET') {
      const safe = users.map(u => ({ email: u.email, name: u.name, role: u.role, createdAt: u.createdAt }));
      res.status(200).json(safe);
      return;
    }

    // ── UPDATE ──
    if (req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') try { body = JSON.parse(body); } catch (e) { body = {}; }
      if (!body || typeof body !== 'object') body = {};

      const email = String(body.email || '').trim().toLowerCase();
      const user = users.find(u => u.email === email);
      if (!user) { res.status(404).json({ error: 'User not found.' }); return; }

      if (body.role && ['admin','viewer','cs','res'].includes(body.role)) {
        // Prevent removing the last admin
        if (user.role === 'admin' && body.role === 'viewer') {
          const adminCount = users.filter(u => u.role === 'admin').length;
          if (adminCount <= 1) { res.status(400).json({ error: 'Cannot remove the last admin.' }); return; }
        }
        user.role = body.role;
      }
      if (body.name && typeof body.name === 'string' && body.name.trim()) {
        user.name = body.name.trim();
      }
      if (body.password && typeof body.password === 'string' && body.password.length >= 6) {
        user.hash = await hashPassword(body.password);
      }

      await saveUsers(users);
      res.status(200).json({ email: user.email, name: user.name, role: user.role });
      return;
    }

    // ── DELETE ──
    if (req.method === 'DELETE') {
      let body = req.body;
      if (typeof body === 'string') try { body = JSON.parse(body); } catch (e) { body = {}; }
      if (!body || typeof body !== 'object') body = {};

      const email = String(body.email || '').trim().toLowerCase();
      if (!email) { res.status(400).json({ error: 'Email is required.' }); return; }
      if (email === admin.email) { res.status(400).json({ error: 'You cannot delete your own account.' }); return; }

      const idx = users.findIndex(u => u.email === email);
      if (idx === -1) { res.status(404).json({ error: 'User not found.' }); return; }

      // Prevent removing the last admin
      if (users[idx].role === 'admin') {
        const adminCount = users.filter(u => u.role === 'admin').length;
        if (adminCount <= 1) { res.status(400).json({ error: 'Cannot delete the last admin.' }); return; }
      }

      users.splice(idx, 1);
      await saveUsers(users);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
