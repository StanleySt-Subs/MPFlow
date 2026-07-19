// POST /api/auth/login — email + password → JWT cookie
const { verifyPassword, signJWT, setTokenCookie, getUsers } = require('../_lib');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  try {
    if (!process.env.JWT_SECRET) { res.status(500).json({ error: 'JWT_SECRET env var not set — login is disabled until it is.' }); return; }

    let body = req.body;
    if (typeof body === 'string') try { body = JSON.parse(body); } catch (e) { body = {}; }
    if (!body || typeof body !== 'object') body = {};

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) { res.status(400).json({ error: 'Email and password are required.' }); return; }

    const users = await getUsers();
    const user = users.find(u => u.email === email);
    if (!user) { res.status(401).json({ error: 'Invalid email or password.' }); return; }

    const ok = await verifyPassword(password, user.hash);
    if (!ok) { res.status(401).json({ error: 'Invalid email or password.' }); return; }

    const token = signJWT({ email: user.email, name: user.name, role: user.role });
    setTokenCookie(res, token);
    res.status(200).json({ email: user.email, name: user.name, role: user.role });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
