// Shared rules for StageReady functions. Prices are NOT handled here: payment happens on PayPal's own
// hosted links, and the three fixed prices live on the page and in the PayPal links themselves.
const crypto = require('crypto');

const PACKAGES = { single: 1, five: 5, ten: 10 }; // package key -> maximum photos
const PACKAGE_LABELS = {
  single: '1 image ($4.99)',
  five: '5 images ($19.95)',
  ten: '10 images ($34.90)',
};
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, max);

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 254;

function newId(kind) {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${kind === 'demo' ? 'SRD' : 'SRO'}-${d}-${crypto.randomBytes(4).toString('hex')}`;
}

const ID_PATTERN = /^(SRO|SRD)-\d{8}-[0-9a-f]{8}$/;

function safeFileName(name, ext) {
  const base = String(name || 'photo')
    .replace(/\.[^.]*$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'photo';
  return `${base}.${ext}`;
}

module.exports = { PACKAGES, PACKAGE_LABELS, MAX_FILE_BYTES, ALLOWED_TYPES, json, esc, clean, isEmail, newId, ID_PATTERN, safeFileName };
