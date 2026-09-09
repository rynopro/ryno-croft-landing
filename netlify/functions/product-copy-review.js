// netlify/functions/product-copy-review.js
//
// Handles submissions from the /product-copy landing page's "Free Product
// Review" form and syncs the lead into Brevo. Reuses the exact same
// BREVO_API_KEY and BREVO_LIST_ID environment variables already configured
// in Netlify for the Cal.com -> Brevo sync (see cal-booking-webhook.js) —
// no new credentials needed.
//
// Expected JSON body from the browser:
// {
//   name: string (required),
//   email: string (required),
//   storeUrl: string (optional),
//   productUrl: string (optional),
//   hpField: string (honeypot — leave empty; used to silently drop bots)
// }
//
// NOTE: STORE_URL and PRODUCT_URL are sent as custom Brevo contact
// attributes. If they don't show up on the contact record in Brevo, create
// two text-type Contact Attributes named STORE_URL and PRODUCT_URL under
// Brevo -> Contacts -> Settings -> Contact attributes — Brevo silently
// drops attributes it doesn't recognize.

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

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  if (!BREVO_API_KEY) {
    console.error('product-copy-review: BREVO_API_KEY is not configured in the environment');
    return jsonResponse(500, {
      error: 'Something went wrong on our end. Please try again or reach out directly.',
    });
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResponse(400, { error: 'Invalid request.' });
  }

  // Honeypot: real visitors never see or fill this field. If it's filled,
  // pretend success so the bot moves on, without ever calling Brevo.
  if (data.hpField) {
    return jsonResponse(200, { ok: true });
  }

  const fullName = (data.name || '').toString().trim();
  const email = (data.email || '').toString().trim();
  const storeUrl = (data.storeUrl || '').toString().trim();
  const productUrl = (data.productUrl || '').toString().trim();

  if (!fullName || !isValidEmail(email)) {
    return jsonResponse(400, { error: 'Please provide a valid name and email address.' });
  }

  const [firstName, ...rest] = fullName.split(' ');
  const lastName = rest.join(' ');

  const attributes = {
    SOURCE: 'Product Copy Free Review',
  };
  if (firstName) attributes.FIRSTNAME = firstName;
  if (lastName) attributes.LASTNAME = lastName;
  if (storeUrl) attributes.STORE_URL = storeUrl;
  if (productUrl) attributes.PRODUCT_URL = productUrl;

  const payload = {
    email,
    attributes,
    updateEnabled: true,
  };
  if (BREVO_LIST_ID) {
    payload.listIds = [BREVO_LIST_ID];
  }

  try {
    const resp = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error('product-copy-review: Brevo API error', resp.status, errText);
      return jsonResponse(502, {
        error: 'Something went wrong while submitting your request. Please try again or contact us directly.',
      });
    }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('product-copy-review: unexpected error', err);
    return jsonResponse(500, {
      error: 'Something went wrong while submitting your request. Please try again or contact us directly.',
    });
  }
};
