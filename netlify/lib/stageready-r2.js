// Minimal Cloudflare R2 (S3-compatible) helper using AWS Signature V4 and Node's built-in crypto.
// No dependencies. Secrets are read from Netlify environment variables and never reach the browser.
//
// Required env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
const crypto = require('crypto');

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

function config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error('R2 is not configured');
  }
  return {
    id: R2_ACCESS_KEY_ID,
    secret: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    host: `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: 'auto',
    service: 's3',
  };
}

// Keys are built only from sanitised segments, so plain encodeURIComponent per segment is safe.
const encodeKey = (key) => key.split('/').map(encodeURIComponent).join('/');

function signingKey(secret, date, region, service) {
  return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), service), 'aws4_request');
}

function amzDate(now) {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

// Presigned URL the browser can PUT a file to. Valid for `expires` seconds, one object key only.
function presignPut(key, expires = 900, now = new Date()) {
  const c = config();
  const stamp = amzDate(now);
  const date = stamp.slice(0, 8);
  const scope = `${date}/${c.region}/${c.service}/aws4_request`;
  const query = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${c.id}/${scope}`,
    'X-Amz-Date': stamp,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join('&');
  const path = `/${c.bucket}/${encodeKey(key)}`;
  const canonicalRequest = ['PUT', path, canonicalQuery, `host:${c.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256(canonicalRequest)].join('\n');
  const signature = crypto
    .createHmac('sha256', signingKey(c.secret, date, c.region, c.service))
    .update(stringToSign)
    .digest('hex');
  return `https://${c.host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

// Server-side signed request (used for HEAD checks and for writing the order record).
async function signedRequest(method, key, { body = '', contentType } = {}) {
  const c = config();
  const now = new Date();
  const stamp = amzDate(now);
  const date = stamp.slice(0, 8);
  const scope = `${date}/${c.region}/${c.service}/aws4_request`;
  const payloadHash = sha256(body);
  const headers = {
    host: c.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': stamp,
  };
  if (contentType) headers['content-type'] = contentType;
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${headers[n]}\n`).join('');
  const signedHeaders = names.join(';');
  const path = `/${c.bucket}/${encodeKey(key)}`;
  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256(canonicalRequest)].join('\n');
  const signature = crypto
    .createHmac('sha256', signingKey(c.secret, date, c.region, c.service))
    .update(stringToSign)
    .digest('hex');
  const reqHeaders = {
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': stamp,
    Authorization: `AWS4-HMAC-SHA256 Credential=${c.id}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
  if (contentType) reqHeaders['content-type'] = contentType;
  return fetch(`https://${c.host}${path}`, { method, headers: reqHeaders, body: method === 'PUT' ? body : undefined });
}

// Returns { exists, size, type } for an object without downloading it.
async function headObject(key) {
  const res = await signedRequest('HEAD', key);
  if (res.status === 404) return { exists: false };
  if (!res.ok) throw new Error(`R2 HEAD failed (${res.status})`);
  return {
    exists: true,
    size: Number(res.headers.get('content-length') || 0),
    type: res.headers.get('content-type') || '',
  };
}

async function putJson(key, obj) {
  const res = await signedRequest('PUT', key, { body: JSON.stringify(obj, null, 2), contentType: 'application/json' });
  if (!res.ok) throw new Error(`R2 PUT failed (${res.status})`);
}

module.exports = { presignPut, headObject, putJson };
