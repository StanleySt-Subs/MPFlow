const { put } = require('@vercel/blob');
const { requireAuth } = require('./_lib');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = requireAuth(req, res);
    if (!user) return;
    if (req.method !== 'POST') { res.status(405).json({error: 'POST only'}); return; }
    
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      res.status(500).json({ error: 'Blob storage not enabled.' }); return;
    }

    let body = req.body;
    if (typeof body === 'string') try { body = JSON.parse(body); } catch(e){}
    
    if (!body || !body.base64) { res.status(400).json({error: 'No base64 data provided'}); return; }
    
    let buffer;
    let mimeType = body.mimeType || 'application/octet-stream';
    let originalName = body.filename || 'upload.bin';
    
    if (body.base64.startsWith('data:')) {
      const match = body.base64.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) { res.status(400).json({error: 'Invalid base64 data URI format'}); return; }
      mimeType = match[1];
      buffer = Buffer.from(match[2], 'base64');
    } else {
      buffer = Buffer.from(body.base64, 'base64');
    }
    
    // Check size limit (approx 4MB)
    if (buffer.length > 4 * 1024 * 1024) {
      res.status(413).json({error: 'File is too large. Max 4MB.'}); return;
    }

    // Keep it clean and descriptive
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `uploads/${Date.now()}_${safeName}`;
    
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: true
    });
    
    res.status(200).json({ url: blob.url });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
