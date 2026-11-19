// Step 2: after the browser has uploaded the photos, this records the order/demo request,
// confirms the files really exist in R2, saves an order.json next to them, and sends two emails
// through Brevo (one to Ryno Croft, one confirmation to the customer).
const { headObject, putJson } = require('../lib/stageready-r2');
const S = require('../lib/stageready-shared');

const NOTIFY_TO = process.env.STAGEREADY_NOTIFY_EMAIL || 'hello@rynocroft.com';
const SENDER = process.env.STAGEREADY_SENDER_EMAIL || 'hello@rynocroft.com'; // must be a verified Brevo sender

async function sendEmail({ to, subject, html, replyTo }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'StageReady by Ryno Croft Digital Studio', email: SENDER },
      to: [{ email: to }],
      replyTo: replyTo ? { email: replyTo } : undefined,
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}`);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return S.json(405, { error: 'Method not allowed' });

  let d;
  try {
    d = JSON.parse(event.body || '{}');
  } catch (e) {
    return S.json(400, { error: 'Invalid request.' });
  }
  if (d.hp) return S.json(200, { ok: true });

  const kind = d.kind === 'demo' ? 'demo' : 'order';
  const orderId = String(d.orderId || '');
  if (!S.ID_PATTERN.test(orderId) || (kind === 'demo') !== orderId.startsWith('SRD')) {
    return S.json(400, { error: 'Invalid order reference.' });
  }

  const f = {
    name: S.clean(d.name, 120),
    email: S.clean(d.email, 254),
    agency: S.clean(d.agency, 120),
    location: S.clean(d.location, 120),
    roomType: S.clean(d.roomType, 60),
    style: S.clean(d.style, 60),
    instructions: S.clean(d.instructions, 2000),
    paymentRef: S.clean(d.paymentRef, 200),
    package: kind === 'demo' ? 'demo' : S.clean(d.package, 10),
  };

  if (!f.name || !S.isEmail(f.email)) return S.json(400, { error: 'Please enter your name and a valid email address.' });
  if (!f.roomType || !f.style) return S.json(400, { error: 'Please choose a room type and interior style.' });
  if (kind === 'order') {
    if (!S.PACKAGES[f.package]) return S.json(400, { error: 'Please choose a package.' });
    if (!f.paymentRef) return S.json(400, { error: 'Please enter your PayPal transaction ID or the email you paid with.' });
  } else if (!d.consent) {
    return S.json(400, { error: 'Please confirm you own or have permission to use the photograph.' });
  }

  const maxFiles = kind === 'demo' ? 1 : S.PACKAGES[f.package];
  const prefix = `${kind === 'demo' ? 'demos' : 'orders'}/${orderId}/`;
  const keys = Array.isArray(d.keys) ? d.keys.map(String) : [];
  if (keys.length < 1 || keys.length > maxFiles || !keys.every((k) => k.startsWith(prefix) && !k.includes('..'))) {
    return S.json(400, { error: 'Photo upload could not be verified. Please try again.' });
  }

  try {
    // Confirm every file really arrived, is an image and is within the size limit.
    for (const k of keys) {
      const h = await headObject(k);
      if (!h.exists || h.size > S.MAX_FILE_BYTES || !h.type.startsWith('image/')) {
        return S.json(400, { error: 'One of your photos did not upload correctly. Please try again.' });
      }
    }

    const record = { orderId, kind, receivedAt: new Date().toISOString(), ...f, photos: keys };
    await putJson(`${prefix}order.json`, record);

    const label = kind === 'demo' ? 'Demonstration request (1 watermarked image)' : S.PACKAGE_LABELS[f.package];
    const rows = [
      ['Reference', orderId],
      ['Type', label],
      ['Name', f.name],
      ['Email', f.email],
      ['Agency', f.agency || '-'],
      ['Property location', f.location || '-'],
      ['Room type', f.roomType],
      ['Interior style', f.style],
      kind === 'order' ? ['Payment reference (verify in PayPal)', f.paymentRef] : null,
      ['Instructions', f.instructions || '-'],
      ['Photos (private R2 keys)', keys.join('<br>')],
    ]
      .filter(Boolean)
      .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;vertical-align:top"><strong>${S.esc(k)}</strong></td><td>${k.startsWith('Photos') ? v.split('<br>').map(S.esc).join('<br>') : S.esc(v)}</td></tr>`)
      .join('');

    await sendEmail({
      to: NOTIFY_TO,
      replyTo: f.email,
      subject: `StageReady ${kind === 'demo' ? 'demo request' : 'order'} ${orderId}`,
      html: `<p>New StageReady ${kind === 'demo' ? 'demonstration request' : 'order'}.</p><table>${rows}</table><p>Photos are in the private R2 bucket under <code>${S.esc(prefix)}</code>. ${kind === 'order' ? 'Verify the payment in PayPal before processing.' : 'Review for suitability before producing a watermarked preview.'}</p>`,
    });

    const customerLine =
      kind === 'demo'
        ? 'Your request is being reviewed for suitability. If it is a good fit, you will receive one watermarked demonstration image by email. Submitting a request does not guarantee a demonstration.'
        : 'We will confirm your payment and start work on your images. Every image is checked by a person before delivery.';
    await sendEmail({
      to: f.email,
      subject: `StageReady: we received your ${kind === 'demo' ? 'demonstration request' : 'order'} (${orderId})`,
      html: `<p>Hi ${S.esc(f.name)},</p><p>Thanks for your ${kind === 'demo' ? 'demonstration request' : 'photos'}. Your reference is <strong>${S.esc(orderId)}</strong>.</p><p>${customerLine}</p><p>Questions? Just reply to this email.</p><p>StageReady&trade; by Ryno Croft Digital Studio</p>`,
    });

    return S.json(200, { ok: true, orderId });
  } catch (err) {
    console.error('stageready-order error:', err.message);
    return S.json(500, { error: 'We could not complete your submission. Your photos may have uploaded; please email hello@rynocroft.com quoting ' + orderId + '.' });
  }
};
