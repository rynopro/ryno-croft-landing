// netlify/functions/cal-booking-webhook.js
//
// Receives the "Booking Created" webhook from Cal.com and syncs the
// attendee into Brevo, so anyone who books a strategy audit automatically
// enters your follow-up list/automation — no manual data entry.
//
// SETUP (see the setup guide you were given for full detail):
// 1. In Cal.com: Settings -> Developer -> Webhooks -> Add.
//    - Subscriber URL: https://<your-site>.netlify.app/.netlify/functions/cal-booking-webhook
//    - Event trigger: "Booking Created"
//    - Generate a signing secret, and set it below as CAL_WEBHOOK_SECRET
//      in Netlify (Site settings -> Environment variables).
// 2. In Brevo: SMTP & API -> API Keys -> generate a key -> set as
//    BREVO_API_KEY in Netlify.
// 3. In Brevo: Contacts -> Lists -> open your target list -> the numeric
//    ID is in the URL -> set as BREVO_LIST_ID in Netlify.
//
// None of these values are ever committed to the repository — they live
// only as Netlify environment variables.

const crypto = require('crypto');

const CAL_WEBHOOK_SECRET = process.env.CAL_WEBHOOK_SECRET;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_LIST_ID = process.env.BREVO_LIST_ID ? parseInt(process.env.BREVO_LIST_ID, 10) : null;

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Cal.com signs the raw request body with HMAC-SHA256 using your webhook
// secret, sent in the "X-Cal-Signature-256" header. Verifying this proves
// the request genuinely came from Cal.com and not a random POST to this URL.
function isValidSignature(rawBody, signatureHeader) {
  if (!CAL_WEBHOOK_SECRET) return false;
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac('sha256', CAL_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch (e) {
    // Lengths differed, etc. — treat as invalid rather than throwing.
    return false;
  }
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  if (!BREVO_API_KEY) {
    console.error('cal-booking-webhook: BREVO_API_KEY is not configured in the environment');
    return jsonResponse(500, { error: 'Server not configured.' });
  }

  if (!CAL_WEBHOOK_SECRET) {
    console.error('cal-booking-webhook: CAL_WEBHOOK_SECRET is not configured in the environment');
    return jsonResponse(500, { error: 'Server not configured.' });
  }

  const rawBody = event.body || '';
  const signatureHeader =
    event.headers['x-cal-signature-256'] || event.headers['X-Cal-Signature-256'];

  if (!isValidSignature(rawBody, signatureHeader)) {
    console.error('cal-booking-webhook: invalid or missing signature');
    return jsonResponse(401, { error: 'Invalid signature.' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return jsonResponse(400, { error: 'Invalid JSON body.' });
  }

  // Only act on booking-created events; acknowledge anything else so
  // Cal.com doesn't retry it as a failure.
  if (payload.triggerEvent && payload.triggerEvent !== 'BOOKING_CREATED') {
    return jsonResponse(200, { ok: true, skipped: payload.triggerEvent });
  }

  const booking = payload.payload || {};
  const attendee = Array.isArray(booking.attendees) ? booking.attendees[0] : null;

  const email = (attendee && attendee.email || '').trim();
  const fullName = (attendee && attendee.name || '').trim();
  const [firstName, ...rest] = fullName.split(' ');
  const lastName = rest.join(' ');

  if (!isValidEmail(email)) {
    console.error('cal-booking-webhook: no valid attendee email in payload');
    // Acknowledge with 200 so Cal.com doesn't keep retrying a booking that
    // will never have a valid email — this is a data issue, not ours to fix.
    return jsonResponse(200, { ok: true, skipped: 'no_valid_email' });
  }

  const attributes = {
    SOURCE: 'Cal.com Booking',
    BOOKING_TITLE: booking.title || '',
    BOOKING_START: booking.startTime || '',
  };
  if (firstName) attributes.FIRSTNAME = firstName;
  if (lastName) attributes.LASTNAME = lastName;

  const brevoPayload = {
    email,
    attributes,
    updateEnabled: true,
  };
  if (BREVO_LIST_ID) {
    brevoPayload.listIds = [BREVO_LIST_ID];
  }

  try {
    const resp = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(brevoPayload),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error('cal-booking-webhook: Brevo API error', resp.status, errText);
      return jsonResponse(502, { error: 'Failed to sync contact to Brevo.' });
    }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('cal-booking-webhook: unexpected error', err);
    return jsonResponse(500, { error: 'Unexpected error.' });
  }
};
