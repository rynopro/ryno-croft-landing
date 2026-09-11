// netlify/functions/craft-food-audit.js
//
// Handles submissions from the /craft-food-product-copy-audit landing
// page's $100 audit intake form and syncs the lead into Brevo. Reuses the
// exact same BREVO_API_KEY and BREVO_LIST_ID environment variables already
// configured in Netlify for the other lead-capture forms on this site (see
// cal-booking-webhook.js / product-copy-review.js / sa-business-guide.js) —
// no new credentials needed.
//
// IMPORTANT — this function itself does NOT process payment. It only
// records the intake details (name, email, website, platform, priority
// pages) in Brevo, tagged as a paid audit request, so the audit scope is
// captured before the visitor pays. Payment is handled entirely on the
// front end by PayPal's own Hosted Button (see the PayPal SDK <script> in
// craft-food-product-copy-audit.html's <head> and the render call that
// runs right after this function succeeds) — no card or payment details
// ever reach this function, and no PayPal API keys or secrets are used or
// exposed anywhere in this codebase (the PayPal client-id embedded in the
// page's <head> is a public SDK identifier, not a secret).
//
// NOTE: WEBSITE_URL, ECOMMERCE_PLATFORM and PRIORITY_PAGES are sent as
// custom Brevo contact attributes. If they don't show up on the contact
// record in Brevo, create three text-type Contact Attributes with those
// exact names under Brevo -> Contacts -> Settings -> Contact attributes —
// Brevo silently drops attributes it doesn't recognize.
//
// Expected JSON body from the browser:
// {
//   name: string (required),
//   email: string (required),
//   websiteUrl: string (required),
//   platform: string (required — Shopify / WooCommerce / Squarespace / Wix / BigCommerce / Other),
//   priorityPages: string (required — free text, 2-3 pasted product URLs),
//   hpField: string (honeypot — leave empty; used to silently drop bots)
// }

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
    console.error('craft-food-audit: BREVO_API_KEY is not configured in the environment');
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
  const websiteUrl = (data.websiteUrl || '').toString().trim();
  const platform = (data.platform || '').toString().trim();
  const priorityPages = (data.priorityPages || '').toString().trim().slice(0, 2000);

  if (!fullName || !isValidEmail(email) || !websiteUrl || !platform || !priorityPages) {
    return jsonResponse(400, { error: 'Please fill in every field so the audit can be scoped correctly.' });
  }

  const [firstName, ...rest] = fullName.split(' ');
  const lastName = rest.join(' ');

  const attributes = {
    SOURCE: 'Craft Food Product Copy Audit ($100)',
    WEBSITE_URL: websiteUrl,
    ECOMMERCE_PLATFORM: platform,
    PRIORITY_PAGES: priorityPages,
  };
  if (firstName) attributes.FIRSTNAME = firstName;
  if (lastName) attributes.LASTNAME = lastName;

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
      console.error('craft-food-audit: Brevo API error', resp.status, errText);
      return jsonResponse(502, {
        error: 'Something went wrong while submitting your request. Please try again or contact us directly.',
      });
    }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('craft-food-audit: unexpected error', err);
    return jsonResponse(500, {
      error: 'Something went wrong while submitting your request. Please try again or contact us directly.',
    });
  }
};
