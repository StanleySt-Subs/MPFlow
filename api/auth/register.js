// POST /api/auth/register — create a new user account.
// First user ever → automatic admin. After that, only admins can create users.
const { hashPassword, getUsers, saveUsers, requireAdmin, signJWT, setTokenCookie } = require('../_lib');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  try {
    if (!process.env.JWT_SECRET) { res.status(500).json({ error: 'JWT_SECRET env var not set.' }); return; }
    if (!process.env.BLOB_READ_WRITE_TOKEN) { res.status(500).json({ error: 'Blob storage not enabled.' }); return; }

    let body = req.body;
    if (typeof body === 'string') try { body = JSON.parse(body); } catch (e) { body = {}; }
    if (!body || typeof body !== 'object') body = {};

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim();
    if (!email || !password || !name) { res.status(400).json({ error: 'Name, email, and password are required.' }); return; }
    if (password.length < 6) { res.status(400).json({ error: 'Password must be at least 6 characters.' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: 'Invalid email address.' }); return; }

    const users = await getUsers();
    const isFirstUser = users.length === 0;

    // Approved email domains that can self-register
    const APPROVED_DOMAINS = ['stanleyst.nz', 'culture.nz', 'hustleandbustle.co.nz', 'waitapugroup.nz'];
    const emailDomain = email.split('@')[1] || '';
    const isApprovedDomain = APPROVED_DOMAINS.includes(emailDomain);

    // After the first user, only admins or approved-domain emails can register
    if (!isFirstUser && !isApprovedDomain) {
      const admin = requireAdmin(req, res);
      if (!admin) return; // 401/403 already sent
    }

    if (users.find(u => u.email === email)) { res.status(409).json({ error: 'An account with this email already exists.' }); return; }

    const allowed = ['viewer','cs','res'];
    const isSuperAdmin = email === 'rachel.bullen@stanleyst.nz';
    const role = isSuperAdmin ? 'admin' : (allowed.includes(body.role) ? body.role : 'viewer');
    const hash = await hashPassword(password);
    const newUser = { email, name, role, hash, createdAt: new Date().toISOString() };
    users.push(newUser);
    await saveUsers(users);

    // If first user, auto-login them
    if (isFirstUser) {
      const token = signJWT({ email, name, role });
      setTokenCookie(res, token);
    }

    res.status(201).json({ email, name, role });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
