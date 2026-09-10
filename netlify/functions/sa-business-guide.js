// netlify/functions/sa-business-guide.js
//
// Handles submissions from the /sa-business page's free-guide capture form
// (Volume 1: "A Practical Guide to Starting and Running a Small Business in
// South Africa") and syncs the lead into Brevo. Reuses the exact same
// BREVO_API_KEY and BREVO_LIST_ID environment variables already configured
// in Netlify for the Cal.com -> Brevo sync and the /product-copy free
// review form (see cal-booking-webhook.js / product-copy-review.js) — no
// new credentials needed.
//
// IMPORTANT — this does NOT deliver a PDF. There is currently no hosted
// download file or delivery automation wired up for this guide. This
// function only records interest (name + email) in Brevo so the contact
// can be followed up with manually or via a Brevo automation once one
// exists. See the delivery note in sa-business.html for what still needs
// to be set up before this is a complete, self-serve download.
//
// Expected JSON body from the browser:
// {
//   name: string (required),
//   email: string (required),
//   businessName: string (optional),
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
    console.error('sa-business-guide: BREVO_API_KEY is not configured in the environment');
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
  const businessName = (data.businessName || '').toString().trim();
  // "interest" distinguishes a Volume 1 free-guide request from someone
  // asking to be notified about a future paid volume (2-9), so both use
  // this same endpoint/list without conflating the two in reporting.
  const interest = (data.interest || 'volume-1').toString().trim();

  if (!fullName || !isValidEmail(email)) {
    return jsonResponse(400, { error: 'Please provide a valid name and email address.' });
  }

  const [firstName, ...rest] = fullName.split(' ');
  const lastName = rest.join(' ');

  const attributes = {
    SOURCE: interest === 'volume-1'
      ? 'SA Business Guide - Free Volume 1'
      : 'SA Business Guide - Volume Notify Request',
    SA_BUSINESS_INTEREST: interest,
  };
  if (firstName) attributes.FIRSTNAME = firstName;
  if (lastName) attributes.LASTNAME = lastName;
  if (businessName) attributes.BUSINESS_NAME = businessName;

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
      console.error('sa-business-guide: Brevo API error', resp.status, errText);
      return jsonResponse(502, {
        error: 'Something went wrong while submitting your request. Please try again or contact us directly.',
      });
    }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('sa-business-guide: unexpected error', err);
    return jsonResponse(500, {
      error: 'Something went wrong while submitting your request. Please try again or contact us directly.',
    });
  }
};
