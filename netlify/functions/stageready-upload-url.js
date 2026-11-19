// Step 1 of a StageReady submission: validates the proposed files and returns short-lived presigned
// URLs so the browser can upload photos straight to the PRIVATE R2 bucket (no public access).
const { presignPut } = require('../lib/stageready-r2');
const S = require('../lib/stageready-shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return S.json(405, { error: 'Method not allowed' });

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (e) {
    return S.json(400, { error: 'Invalid request.' });
  }

  // Honeypot: bots fill the hidden field. Pretend success, do nothing.
  if (data.hp) return S.json(200, { orderId: 'SRO-00000000-00000000', uploads: [] });

  const kind = data.kind === 'demo' ? 'demo' : 'order';
  const maxFiles = kind === 'demo' ? 1 : S.PACKAGES[data.package];
  if (!maxFiles) return S.json(400, { error: 'Please choose a package.' });

  const files = Array.isArray(data.files) ? data.files : [];
  if (files.length < 1 || files.length > maxFiles) {
    return S.json(400, { error: `Please upload between 1 and ${maxFiles} photo${maxFiles > 1 ? 's' : ''}.` });
  }

  for (const f of files) {
    if (!S.ALLOWED_TYPES[f.type]) return S.json(400, { error: 'Only JPG, PNG or WebP photos are accepted.' });
    if (!Number.isFinite(f.size) || f.size <= 0 || f.size > S.MAX_FILE_BYTES) {
      return S.json(400, { error: 'Each photo must be under 15 MB.' });
    }
  }

  try {
    const orderId = S.newId(kind);
    const prefix = kind === 'demo' ? 'demos' : 'orders';
    const uploads = files.map((f, i) => {
      const key = `${prefix}/${orderId}/${i + 1}-${S.safeFileName(f.name, S.ALLOWED_TYPES[f.type])}`;
      return { key, url: presignPut(key, 900), type: f.type };
    });
    return S.json(200, { orderId, uploads });
  } catch (err) {
    console.error('stageready-upload-url error:', err.message);
    return S.json(500, { error: 'Uploads are temporarily unavailable. Please email hello@rynocroft.com.' });
  }
};
