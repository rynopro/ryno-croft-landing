// netlify/functions/authority-content-review.js
//
// Handles submissions from the /authority-content "Request a Content
// Review" form and syncs the lead into Brevo. Reuses the exact same
// BREVO_API_KEY and BREVO_LIST_ID environment variables already configured
// in Netlify for the Cal.com -> Brevo sync and the other lead-capture forms
// on this site (see cal-booking-webhook.js / product-copy-review.js /
// sa-business-guide.js) — no new credentials needed.
//
// This is a B2B content-service enquiry, not a checkout: no payment is
// taken and nothing is charged. The form simply records enough detail for
// a proper scoping conversation to happen by email or call.
//
// Expected JSON body from the browser:
// {
//   name: string (required),
//   company: string (optional),
//   email: string (required),
//   website: string (optional),
//   companyDescription: string (optional),
//   topic: string (optional),
//   audience: string (optional),
//   goal: string (optional),
//   package: 'foundation' | 'authority' | 'thought-leadership' | 'not-sure' (optional),
//   additionalInfo: string (optional),
//   hpField: string (honeypot — leave empty; used to silently drop bots)
// }
//
// NOTE: COMPANY, WEBSITE, COMPANY_DESCRIPTION, CONTENT_TOPIC,
// TARGET_AUDIENCE, CONTENT_GOAL, PACKAGE_INTEREST and ADDITIONAL_INFO are
// sent as custom Brevo contact attributes. If they don't show up on the
// contact record in Brevo, create matching text-type Contact Attributes
// under Brevo -> Contacts -> Settings -> Contact attributes — Brevo
// silently drops attributes it doesn't recognize.

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_LIST_ID = process.env.BREVO_LIST_ID ? parseInt(process.env.BREVO_LIST_ID, 10) : null;

const PACKAGE_LABELS = {
  foundation: 'Foundation - $500',
  authority: 'Authority - $750',
  'thought-leadership': 'Thought Leadership - $1,200',
  'not-sure': 'Not sure yet',
};

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
    console.error('authority-content-review: BREVO_API_KEY is not configured in the environment');
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
  const company = (data.company || '').toString().trim();
  const website = (data.website || '').toString().trim();
  const companyDescription = (data.companyDescription || '').toString().trim();
  const topic = (data.topic || '').toString().trim();
  const audience = (data.audience || '').toString().trim();
  const goal = (data.goal || '').toString().trim();
  const additionalInfo = (data.additionalInfo || '').toString().trim();
  const packageKey = (data.package || '').toString().trim();

  if (!fullName || !isValidEmail(email)) {
    return jsonResponse(400, { error: 'Please provide a valid name and email address.' });
  }

  const [firstName, ...rest] = fullName.split(' ');
  const lastName = rest.join(' ');

  const attributes = {
    SOURCE: 'Authority Content Review Request',
  };
  if (firstName) attributes.FIRSTNAME = firstName;
  if (lastName) attributes.LASTNAME = lastName;
  if (company) attributes.COMPANY = company;
  if (website) attributes.WEBSITE = website;
  if (companyDescription) attributes.COMPANY_DESCRIPTION = companyDescription;
  if (topic) attributes.CONTENT_TOPIC = topic;
  if (audience) attributes.TARGET_AUDIENCE = audience;
  if (goal) attributes.CONTENT_GOAL = goal;
  if (additionalInfo) attributes.ADDITIONAL_INFO = additionalInfo;
  if (packageKey) attributes.PACKAGE_INTEREST = PACKAGE_LABELS[packageKey] || packageKey;

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
      console.error('authority-content-review: Brevo API error', resp.status, errText);
      return jsonResponse(502, {
        error: 'Something went wrong while submitting your request. Please try again or contact us directly.',
      });
    }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('authority-content-review: unexpected error', err);
    return jsonResponse(500, {
      error: 'Something went wrong while submitting your request. Please try again or contact us directly.',
    });
  }
};
