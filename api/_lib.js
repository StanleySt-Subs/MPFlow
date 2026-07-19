// Shared auth utilities — password hashing, JWT, session, user storage.
// Uses only Node.js built-ins (crypto) — no extra dependencies.
const crypto = require('crypto');

// ── Password hashing (PBKDF2-SHA512, 100 000 iterations) ──────────────
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';
const SALT_BYTES = 32;

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
    crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST, (err, key) => {
      if (err) return reject(err);
      resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

function verifyPassword(password, stored) {
  return new Promise((resolve, reject) => {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return resolve(false);
    crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST, (err, key) => {
      if (err) return reject(err);
      const a = Buffer.from(hash, 'hex');
      const b = key;
      if (a.length !== b.length) return resolve(false);
      resolve(crypto.timingSafeEqual(a, b));
    });
  });
}

// ── JWT (HMAC-SHA256, hand-rolled — no dependency) ────────────────────
function base64url(buf) {
  return (Buffer.isBuffer(buf) ? buf : Buffer.from(buf))
    .toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET env var not set');
  return s;
}

function signJWT(payload, expiresInSeconds = 7 * 24 * 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };
  const segments = [base64url(JSON.stringify(header)), base64url(JSON.stringify(body))];
  const sig = crypto.createHmac('sha256', jwtSecret()).update(segments.join('.')).digest();
  segments.push(base64url(sig));
  return segments.join('.');
}

function verifyJWT(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const sig = crypto.createHmac('sha256', jwtSecret()).update(parts[0] + '.' + parts[1]).digest();
    const expected = base64urlDecode(parts[2]);
    if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return null;
    const payload = JSON.parse(base64urlDecode(parts[1]).toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// ── Cookie helpers ────────────────────────────────────────────────────
const COOKIE_NAME = 'sst_token';

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(pair => {
    const [k, ...v] = pair.trim().split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('='));
  });
  return out;
}

function setTokenCookie(res, token) {
  const maxAge = 7 * 24 * 3600; // 7 days
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}; Secure`
  );
}

function clearTokenCookie(res) {
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0; Secure`
  );
}

// ── Session helpers ───────────────────────────────────────────────────
function getSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  return verifyJWT(token);
}

function requireAuth(req, res) {
  const user = getSession(req);
  if (!user) { res.status(401).json({ error: 'Not logged in' }); return null; }
  return user;
}

function requireAdmin(req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (user.role !== 'admin') { res.status(403).json({ error: 'Admin access required' }); return null; }
  return user;
}

// ── User storage (Vercel Blob) ────────────────────────────────────────
const USERS_KEY = 'sst-users.json';

async function getUsers() {
  const { list } = require('@vercel/blob');
  const { blobs } = await list({ prefix: USERS_KEY, limit: 1 });
  if (!blobs.length) return [];
  const r = await fetch(blobs[0].url + '?v=' + Date.now());
  const text = await r.text();
  try { return JSON.parse(text); } catch (e) { return []; }
}

async function saveUsers(users) {
  const { put } = require('@vercel/blob');
  await put(USERS_KEY, JSON.stringify(users), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json'
  });
}

// ── Exports ───────────────────────────────────────────────────────────
module.exports = {
  hashPassword, verifyPassword,
  signJWT, verifyJWT,
  setTokenCookie, clearTokenCookie,
  getSession, requireAuth, requireAdmin,
  getUsers, saveUsers,
  COOKIE_NAME
};
