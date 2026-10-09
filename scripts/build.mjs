// Static page generator for rynocroft.com. No dependencies: `node scripts/build.mjs`
// Reads content/*.json and content/insights/*.md, writes plain HTML into the repo root.
// Netlify serves the committed HTML directly (no build step in netlify.toml).
// To add an article: add a .md file to content/insights/ and re-run this script.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const site = JSON.parse(read('content/site.json'));
const pk = JSON.parse(read('content/packages.json'));
const samples = JSON.parse(read('content/samples.json')).samples;
const written = [];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

// ---- insights (markdown-lite with front matter) ----
function parsePost(file) {
  const raw = read('content/insights/' + file);
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('Missing front matter: ' + file);
  const meta = {};
  m[1].split('\n').forEach((l) => { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
  for (const k of ['title', 'slug', 'date', 'audience', 'description']) if (!meta[k]) throw new Error(`${file}: missing ${k}`);
  const html = m[2].trim().split(/\n\n+/).map((b) => b.startsWith('## ') ? `<h2>${inline(b.slice(3))}</h2>` : `<p>${inline(b.replace(/\n/g, ' '))}</p>`).join('\n');
  return { ...meta, html };
}
const posts = fs.readdirSync(path.join(ROOT, 'content/insights')).filter((f) => f.endsWith('.md')).map(parsePost)
  .sort((a, b) => b.date.localeCompare(a.date));

// ---- shared layout ----
const AUD = { dental: 'Dental', realestate: 'Luxury real estate', general: 'For both audiences' };
function layout({ file, urlPath, title, description, h1Page, body, ld, noindex }) {
  const url = site.domain + urlPath;
  const nav = site.nav.map((n) => `<li><a href="${n.href}"${n.href === h1Page ? ' aria-current="page"' : ''}>${esc(n.label)}</a></li>`).join('');
  const html = `<!DOCTYPE html>
<html lang="en-US">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27%3E%3Crect width=%2732%27 height=%2732%27 rx=%276%27 fill=%27%230A1128%27/%3E%3Ctext x=%2716%27 y=%2723%27 font-size=%2720%27 text-anchor=%27middle%27 fill=%27%23C5A059%27 font-family=%27Georgia,serif%27%3ER%3C/text%3E%3C/svg%3E">
${noindex ? '<meta name="robots" content="noindex, follow">\n' : ''}<meta property="og:type" content="${ld && ld.article ? 'article' : 'website'}">
<meta property="og:site_name" content="Ryno Croft">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/site.css">
${ld && ld.json ? ld.json.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n') : ''}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site"><div class="wrap bar">
  <a class="brand" href="/">Ryno Croft<small>Content writing</small></a>
  <button class="menu-btn" aria-expanded="false" aria-controls="main-nav">Menu</button>
  <nav class="main" id="main-nav" aria-label="Main"><ul>${nav}<li><a class="btn" href="/contact">Start an enquiry</a></li></ul></nav>
</div></header>
<main id="main">
${body}
</main>
<footer class="site"><div class="wrap">
  <div class="cols">
    <div><strong style="font-family:var(--serif);font-size:1.3rem;color:#fff">Ryno Croft</strong>
      <p style="margin-top:.6rem">Expertise-led content writing for dental practitioners and luxury real estate professionals. Based in Cape Town, South Africa, working remotely with clients in the United States.</p></div>
    <div><h4>Explore</h4><ul>
      <li><a href="/dental-content">Dental content</a></li><li><a href="/luxury-real-estate-content">Luxury real estate content</a></li>
      <li><a href="/services">Services and pricing</a></li><li><a href="/insights">Samples and insights</a></li>
      <li><a href="/about">About Ryno</a></li><li><a href="/contact">Contact</a></li></ul></div>
    <div><h4>Other services</h4><ul>
      <li><a href="/authority-content">B2B article writing</a></li><li><a href="/email-marketing.html">Email marketing campaigns</a></li>
      <li><a href="/authority-audit.html">Authority audit</a></li><li><a href="/sa-business.html">South African business guides</a></li></ul>
      <h4 style="margin-top:1.2rem">Legal</h4><ul><li><a href="/privacy.html">Privacy policy</a></li><li><a href="/terms.html">Terms</a></li></ul></div>
  </div>
  <p class="legal">&copy; ${new Date().getFullYear()} Ryno Croft Digital Studio. Content is not a guarantee of enquiries or sales, and nothing on this site is clinical, legal or financial advice.</p>
</div></footer>
<script src="/assets/js/site.js" defer></script>
</body>
</html>
`;
  const out = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  written.push({ file, urlPath, noindex });
}

// ---- components ----
const cta = (href, label, ghost) => `<a class="btn${ghost ? ' ghost' : ''}" href="${href}">${esc(label)}</a>`;
const ticks = (arr, cls = '') => `<ul class="tick ${cls}">${arr.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`;
function sampleCard(s) {
  const label = s.audience === 'dental' ? 'Dental' : 'Luxury real estate';
  return `<article class="sample ${s.audience}" id="${s.id}">
  <header><span class="tag ${s.audience}">${label} · ${esc(s.kind)}</span><span class="meta">Illustrative sample, not client work</span></header>
  <div class="inner">
    <div class="raw"><span class="label">The raw idea</span><q>${esc(s.rawIdea)}</q></div>
    <div class="out"><span class="label">The developed piece</span><h3>${esc(s.title)}</h3>
      ${s.body.map((p) => `<p>${inline(p)}</p>`).join('\n')}
      <p class="note"><strong>Editor's note:</strong> ${esc(s.notes)}</p></div>
  </div></article>`;
}
function packageCard(p, link = true) {
  const price = p.price ? esc(p.price) : esc(pk.priceFallback);
  const details = Object.entries(p.details).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  return `<div class="card pkg" id="${p.id}"><h3>${esc(p.name)}</h3><p>${esc(p.purpose)}</p>
  <p class="price">${price}</p>
  <h4 style="margin:.8rem 0 .4rem">What is included</h4>${ticks(p.included)}
  <dl>${details}
  <dt>Delivery</dt><dd>${esc(p.delivery || pk.deliveryFallback)}</dd>
  <dt>Payment</dt><dd>${esc(pk.paymentFallback)}</dd>
  <dt>What you provide</dt><dd>${esc(p.clientProvides)}</dd></dl>
  <h4 style="margin:1rem 0 .4rem">Not included</h4>${ticks(p.excluded, 'cross')}
  ${link ? cta(`/contact?package=${p.id}`, `Enquire about ${p.name}`) : ''}</div>`;
}
function pkgSummary() {
  return `<div class="grid g3">${pk.packages.map((p) => `<div class="card"><h3>${esc(p.name)}</h3><p>${esc(p.purpose)}</p>${ticks(p.included.slice(0, 3))}<a href="/services#${p.id}">See full details</a></div>`).join('')}</div>`;
}
const processSteps = `<ol class="steps">
<li><strong>Choose your audience and content package</strong>Pick the package that fits, or ask which one suits you.</li>
<li><strong>Complete a short intake form</strong>Your business, audience, goals and preferred tone. It takes a few minutes, not an afternoon.</li>
<li><strong>Share your ideas and source material</strong>Notes, voice recordings, old emails, frequent questions or a short briefing call, depending on the package.</li>
<li><strong>Ryno writes, edits and delivers</strong>Research is organized, angles are chosen, pieces are written and edited for clarity, tone and usefulness.</li>
<li><strong>Review and use the work</strong>You review the files, request the included revision round, and publish across your own channels.</li></ol>`;
const faqs = [
  ['Do you use AI to write the content?', 'AI tools may help with organizing research, suggesting angles or producing rough drafts. Every piece is then reviewed and edited by a person, checked against what you told me, and reshaped until it sounds like you. I do not sell raw AI output.'],
  ['Will it sound like me?', 'That is the aim. The intake form, your notes and any voice recordings are used to match your tone. The revision round exists so you can bring anything that does not sound right back to me.'],
  ['Do you give clinical or market advice?', 'No. I write up what you know. Any clinical statement is approved by the practitioner before it is final, and any local market claim comes from you or from a source named in the piece. I do not invent statistics, results or client stories.'],
  ['How long does it take?', 'Each package has a delivery date that is confirmed in your written scope before work starts. I would rather give you an accurate date than a fast-sounding one.'],
  ['What if I want changes?', 'Every package includes one revision round, requested within 7 days of delivery. Larger changes of direction can be scoped separately.'],
  ['Do you publish or schedule the content?', 'No. You receive editable files and publish them yourself. Graphic design, social media management and email platform setup are not included.'],
  ['Where are you based?', 'I work from Cape Town, South Africa, and serve clients in the United States remotely. Briefing calls can be arranged around both time zones.'],
  ['What does it cost?', 'Each package is a fixed-scope, one-off project. The price and payment terms are confirmed in writing before any work begins, and no payment is taken through this website.'],
];
const faqHtml = `<div>${faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>`;
const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
const orgLd = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Ryno Croft', url: site.domain, email: site.email, founder: { '@type': 'Person', name: site.author } };
const finalCta = (heading, text, href, label) => `<section class="dark"><div class="wrap narrow" style="text-align:center"><h2>${heading}</h2><p class="lede" style="margin:0 auto 1.4rem">${text}</p>${cta(href, label)}</div></section>`;

// =============== PAGES ===============
const dentalSamples = samples.filter((s) => s.audience === 'dental');
const reSamples = samples.filter((s) => s.audience === 'realestate');

// ---- Home ----
layout({
  file: 'index.html', urlPath: '/', h1Page: '/',
  title: 'Content Writing for Dental Practitioners and Luxury Realtors | Ryno Croft',
  description: 'Ryno Croft turns the expertise of dental practitioners and luxury real estate professionals into distinctive, well-written content that builds authority and trust.',
  ld: { json: [orgLd, faqLd] },
  body: `
<section class="hero"><div class="wrap">
  <p class="eyebrow">Content writing for dental practitioners and luxury realtors</p>
  <h1>Make your expertise impossible to ignore.</h1>
  <p class="lede">You know your industry. You understand your clients. You have insights worth sharing. Ryno Croft turns that expertise into clear, distinctive content that builds authority and helps the right people understand your value.</p>
  <div class="btns">${cta('/services', 'Explore Content Services')}${cta('#what-you-get', 'See What You Get', true)}</div>
  <p class="pathways"><a href="/dental-content">Content for Dental Practitioners &rarr;</a><a href="/luxury-real-estate-content">Content for Luxury Realtors &rarr;</a></p>
</div></section>

<section class="alt"><div class="wrap narrow">
  <p class="eyebrow">Your expertise deserves better content</p>
  <h2>You have the expertise. Finding the time to communicate it is another matter.</h2>
  <p>Serving clients already fills your working day. So content becomes an afterthought: an irregular stream of generic posts, a few promotional messages, or a plan that starts in January and quietly stops in March.</p>
  <p>The knowledge is there. It is in the explanations you give patients, the observations you make on showings and the questions you answer every week. It just rarely reaches the page in a form that does it justice.</p>
  <p>Ryno Croft turns what you already know into useful, well-written material, without asking you to become a full-time content creator. Good content will not guarantee enquiries, but it makes your expertise easier to understand and easier to remember.</p>
</div></section>

<section><div class="wrap">
  <p class="eyebrow">What makes Ryno Croft different</p>
  <h2>Your experience is the starting point. Not a generic AI prompt.</h2>
  <div class="grid g2"><div>
    <p>Every piece begins with you: your audience, your goals, your opinions and the way you speak. The writing is shaped from that material, then edited for clarity, originality and tone.</p>
    <p>AI tools may help organize research, suggest angles or produce rough drafts. A person reviews and edits everything that reaches you. Your voice and your judgment stay at the center.</p></div>
  <ol class="steps">
    <li><strong>Understand</strong>Your business, audience and objectives.</li>
    <li><strong>Gather</strong>Your ideas, observations and preferred voice.</li>
    <li><strong>Choose angles</strong>The most useful ideas for your readers.</li>
    <li><strong>Write and edit</strong>For clarity, originality and usefulness.</li>
    <li><strong>Deliver and revise</strong>You review, and the included revision round applies.</li></ol></div>
</div></section>

<section class="alt"><div class="wrap">
  <p class="eyebrow">Choose your profession</p>
  <h2>Two specialisms, each with its own approach.</h2>
  <div class="grid g2">
    <div class="card dental"><span class="tag dental">Dental</span><h3>Dental Content</h3><p>Turn your clinical knowledge, patient education and approach to care into useful content that reflects the quality of your practice.</p>${cta('/dental-content', 'Explore Dental Content')}</div>
    <div class="card realestate"><span class="tag realestate">Luxury real estate</span><h3>Luxury Real Estate Content</h3><p>Turn your market knowledge, professional experience and local insights into content that builds a recognizable personal brand.</p>${cta('/luxury-real-estate-content', 'Explore Real Estate Content')}</div>
  </div>
</div></section>

<section id="what-you-get"><div class="wrap">
  <p class="eyebrow">What you receive</p>
  <h2>Real pieces of writing, not abstract strategy.</h2>
  <p class="lede">Depending on the package you choose, you receive:</p>
  <div class="grid g2"><div>${ticks(['Professionally written LinkedIn and social posts', 'Educational articles', 'Email newsletters', 'Content adapted for one defined audience'])}</div>
  <div>${ticks(['A headline or opening hook, and a clear call to action where relevant, for every piece', 'Editable digital files (Google Doc or Word)', 'One defined revision round'])}</div></div>
  <p class="small">Publishing, scheduling, graphic design and email platform setup are not included. <a href="/services">See exactly what each package contains.</a></p>
</div></section>

<section class="alt"><div class="wrap narrow">
  <p class="eyebrow">A straightforward process</p>
  <h2>Five steps from first message to finished content.</h2>
  ${processSteps}
  <p style="margin-top:1.6rem">After you approve the scope and payment is made, I send the intake form and start once I have your briefing material. Delivery dates are confirmed in your written scope. Each package includes one revision round.</p>
</div></section>

<section><div class="wrap">
  <p class="eyebrow">Sample work</p>
  <h2>See the writing before you decide.</h2>
  <p class="lede">These are original samples written for this website, shown with the raw idea they started from. They are not commissioned client work.</p>
  <div class="stack">${[dentalSamples[0], reSamples[0]].map(sampleCard).join('')}</div>
  <p style="margin-top:1.6rem"><a href="/insights">See more samples and articles &rarr;</a></p>
</div></section>

<section class="alt"><div class="wrap">
  <p class="eyebrow">Service packages</p>
  <h2>Three ways to work together.</h2>
  <p class="lede">Each package is a fixed-scope, one-off project, with deliverables and exclusions spelled out in advance.</p>
  ${pkgSummary()}
  <div class="btns">${cta('/services', 'Compare packages in detail')}</div>
</div></section>

<section><div class="wrap narrow"><p class="eyebrow">Frequently asked questions</p><h2>Straight answers.</h2>${faqHtml}</div></section>
${finalCta('Your next great piece of content might already be in your head.', "Let's turn your expertise into something your audience will find useful.", '/contact', "Let's Talk About Your Content")}
`});

// ---- Audience pages ----
function audiencePage(a) {
  layout({
    file: a.file, urlPath: a.urlPath, h1Page: a.urlPath,
    title: a.title, description: a.description,
    ld: { json: [orgLd] },
    body: `
<section class="hero"><div class="wrap"><p class="eyebrow">${a.eyebrow}</p><h1>${a.h1}</h1><p class="lede">${a.lede}</p>
<div class="btns">${cta(`/contact?audience=${a.key}`, a.cta)}${cta('#samples', 'Read the samples', true)}</div></div></section>
<section class="alt"><div class="wrap"><p class="eyebrow">Sound familiar?</p><h2>${a.problemH}</h2><div class="grid g2"><div>${ticks(a.problems.slice(0, 3))}</div><div>${ticks(a.problems.slice(3))}</div></div><p>${a.problemClose}</p></div></section>
<section><div class="wrap"><p class="eyebrow">What you can have written</p><h2>${a.deliverH}</h2><div class="grid g2"><div>${ticks(a.deliver)}</div><div class="card ${a.key}"><h3>${a.guardH}</h3><p>${a.guard}</p></div></div></div></section>
<section class="alt" id="samples"><div class="wrap"><p class="eyebrow">Illustrative samples</p><h2>${a.sampleH}</h2><p class="lede">Original writing created for this site, starting from a simple idea. Not commissioned client work.</p><div class="stack">${a.samples.map(sampleCard).join('')}</div></div></section>
<section><div class="wrap narrow"><p class="eyebrow">How it works</p><h2>A short process that respects your schedule.</h2>${processSteps}</div></section>
<section class="alt"><div class="wrap"><p class="eyebrow">Packages</p><h2>Choose the amount of content that suits you.</h2>${pkgSummary()}</div></section>
${finalCta(a.finalH, a.finalT, `/contact?audience=${a.key}`, a.cta)}
`});
}
audiencePage({
  key: 'dental', file: 'dental-content.html', urlPath: '/dental-content',
  title: 'Dental Content Writing: Newsletters, Patient Education and LinkedIn | Ryno Croft',
  description: 'Content writing for dentists and dental practice owners: patient education articles, practice newsletters and LinkedIn posts written from your own expertise and approved by you.',
  eyebrow: 'Content writing for dental practitioners',
  h1: 'Dental content that sounds like your practice, not everyone else\'s.',
  lede: 'You explain things clearly in the chair. Ryno Croft helps you do the same on the page, through patient education, newsletters and professional posts that reflect how you actually practice.',
  cta: 'Start a dental content enquiry',
  problemH: 'Valuable knowledge, very little time to write it down.',
  problems: ['You are busy treating patients and cannot write consistently', 'Your website and social posts read like those of the practice down the road', 'You have clinical knowledge but struggle to make it engaging for patients', 'You want to explain your approach to care in an approachable way', 'You need steady material for newsletters, LinkedIn and your website', 'You want writing that feels professional and human, not machine-made'],
  problemClose: 'That is the gap Ryno Croft fills: your knowledge in, clear writing out.',
  deliverH: 'Content built from your ideas and your experience.',
  deliver: ['Patient education articles and FAQ content', 'Educational social media posts', 'LinkedIn content for practice owners', 'Practice newsletters', 'Website articles', 'Pieces drawn from your own explanations, notes and voice recordings'],
  guardH: 'Clinical content is always approved by you.',
  guard: 'Ryno Croft writes up what you know. It does not give medical advice on your behalf, invent clinical expertise, or publish unverified treatment information. Any clinical statement is flagged for your review, and nothing is final until you approve it. Claims that cannot be supported are removed.',
  sampleH: 'Two pieces, from raw idea to finished writing.', samples: dentalSamples,
  finalH: 'Your next patient education piece might already be in your head.', finalT: 'Tell me about your practice and what you wish patients understood better.',
});
audiencePage({
  key: 'realestate', file: 'luxury-real-estate-content.html', urlPath: '/luxury-real-estate-content',
  title: 'Luxury Real Estate Content Writing: Thought Leadership and Newsletters | Ryno Croft',
  description: 'Content writing for luxury realtors: LinkedIn thought leadership, market commentary and email newsletters that communicate your expertise beyond property listings.',
  eyebrow: 'Content writing for luxury real estate professionals',
  h1: 'Be known for what you know, not only for what you list.',
  lede: 'Listings show what you sell. Ryno Croft helps you show how you think, with writing that communicates your market knowledge and professional judgment between transactions.',
  cta: 'Start a real estate content enquiry',
  problemH: 'Your online presence should say more than "just listed."',
  problems: ['Your online presence does not show your experience or personal value', 'Your social media leans heavily on property listings', 'Your market commentary lacks a recognizable individual voice', 'You have local knowledge but struggle to turn it into compelling writing', 'You need to stay visible and credible between transactions', 'You want to stand out without sounding boastful or overly promotional'],
  problemClose: 'Ryno Croft turns your observations into confident, readable pieces that sound like you.',
  deliverH: 'Content built from your local knowledge and judgment.',
  deliver: ['LinkedIn thought-leadership posts', 'Local market commentary', 'Buyer and seller educational articles', 'Email newsletters', 'Personal-brand articles', 'Pieces built around your professional observations and lessons learned'],
  guardH: 'Market claims come from you or a named source.',
  guard: 'Ryno Croft does not invent property statistics, market trends, client stories, transaction values or performance claims. Any figure in your content comes from information you supply or from a source named in the piece, and you approve everything before it is final.',
  sampleH: 'Two pieces, from raw idea to finished writing.', samples: reSamples,
  finalH: 'Your next market insight might already be in your head.', finalT: 'Tell me where you work and what you notice that others miss.',
});

// ---- Services ----
layout({
  file: 'services.html', urlPath: '/services', h1Page: '/services',
  title: 'Content Writing Packages and Pricing | Ryno Croft',
  description: 'Three clearly defined content writing packages for dental practitioners and luxury real estate professionals, with deliverables, exclusions, revisions and how to order.',
  ld: { json: [orgLd] },
  body: `
<section class="hero"><div class="wrap"><p class="eyebrow">Services and pricing</p><h1>Know exactly what you are buying.</h1>
<p class="lede">Three one-off packages for dental practitioners and luxury real estate professionals. Each states what is included, what is not, and what happens after you order. These are fixed-scope projects, not monthly subscriptions.</p></div></section>
<section class="alt"><div class="wrap"><div class="grid g3">${pk.packages.map((p) => packageCard(p)).join('')}</div>
<p class="small" style="margin-top:1.4rem">Package contents are the same for both audiences. The topics, examples and tone are tailored to your profession.</p></div></section>
<section><div class="wrap narrow"><p class="eyebrow">How to order</p><h2>No sales call required.</h2>
<ol class="steps">
<li><strong>Send a short enquiry</strong>Choose a package on the <a href="/contact">contact form</a> and tell me what you need.</li>
<li><strong>Receive a written scope</strong>You get the deliverables, the fixed price, the delivery date and the payment terms in writing. Nothing starts until you agree.</li>
<li><strong>Approve and pay</strong>Payment follows the terms in your scope. No payment is taken through this website.</li>
<li><strong>Complete the intake and share your material</strong>I send the intake form, then collect your notes, recordings or briefing.</li>
<li><strong>Review and revise</strong>You receive editable files and can request one revision round within 7 days of delivery.</li></ol>
<h3 style="margin-top:2rem">What happens to clinical or market-specific claims?</h3>
<p>They are flagged for your confirmation. Anything that cannot be verified is changed or removed before delivery.</p>
<h3>AI use</h3>
<p>AI tools may assist with research organization, ideas or rough drafts. All finished work is reviewed and edited by a person.</p></div></section>
<section class="alt"><div class="wrap narrow"><p class="eyebrow">Other services</p><h2>Looking for something different?</h2>
<p>Ryno Croft Digital Studio also offers <a href="/authority-content">research-led B2B articles</a>, <a href="/email-marketing.html">email marketing campaigns</a> and an <a href="/authority-audit.html">authority audit</a>. They are separate from the packages above and keep their own terms.</p></div></section>
${finalCta('Not sure which package fits?', 'Send a short enquiry and I will recommend one, with no obligation.', '/contact', 'Start an enquiry')}
`});

// ---- Insights ----
layout({
  file: 'insights.html', urlPath: '/insights', h1Page: '/insights',
  title: 'Writing Samples and Insights for Dentists and Luxury Realtors | Ryno Croft',
  description: 'Original writing samples and practical articles on expertise-led content for dental practitioners and luxury real estate professionals.',
  ld: { json: [orgLd] },
  body: `
<section class="hero"><div class="wrap"><p class="eyebrow">Samples and insights</p><h1>The writing is the proof.</h1>
<p class="lede">Original samples written for this site, and practical articles on turning professional expertise into content people want to read.</p></div></section>
<section class="alt"><div class="wrap"><h2>Illustrative samples</h2><p class="lede">Each sample starts from a raw idea. None is commissioned client work.</p><div class="stack">${samples.map(sampleCard).join('')}</div></div></section>
<section><div class="wrap narrow"><h2>Articles</h2><ul class="post-list">${posts.map((p) => `<li class="card"><span class="tag ${p.audience === 'general' ? '' : p.audience}">${AUD[p.audience] || ''}</span><a href="/insights/${p.slug}"><h3>${esc(p.title)}</h3></a><p>${esc(p.description)}</p></li>`).join('')}</ul></div></section>
${finalCta('Want writing like this for your own practice or business?', 'Tell me what you do and who you want to reach.', '/contact', 'Start an enquiry')}
`});
for (const p of posts) {
  layout({
    file: `insights/${p.slug}.html`, urlPath: `/insights/${p.slug}`, h1Page: '/insights',
    title: `${p.title} | Ryno Croft`, description: p.description,
    ld: { article: true, json: [orgLd, { '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.description, datePublished: p.date, author: { '@type': 'Person', name: site.author }, publisher: { '@type': 'Organization', name: 'Ryno Croft' }, mainEntityOfPage: `${site.domain}/insights/${p.slug}` }] },
    body: `
<article class="hero"><div class="wrap narrow"><p class="eyebrow"><a href="/insights" style="text-decoration:none">Insights</a> &middot; ${AUD[p.audience] || ''}</p>
<h1 style="font-size:clamp(2rem,4.5vw,3rem)">${esc(p.title)}</h1><p class="byline">By ${esc(site.author)} &middot; ${new Date(p.date + 'T00:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</p>
<div class="prose" style="margin-top:2rem">${p.html}</div></div></article>
${finalCta('Turn your own expertise into writing.', 'Send a short enquiry and tell me what you do.', '/contact', 'Start an enquiry')}
`});
}

// ---- About ----
layout({
  file: 'about.html', urlPath: '/about', h1Page: '/about',
  title: `About ${site.author} | Ryno Croft`,
  description: 'Ryno Cilliers is a content writer based in Cape Town who helps dental practitioners and luxury real estate professionals communicate what they know.',
  ld: { json: [orgLd] },
  body: `
<section class="hero"><div class="wrap narrow"><p class="eyebrow">About Ryno</p><h1>I write for people who know more than they have time to say.</h1>
<div class="prose"><p>I'm ${esc(site.author)}, a writer based in Cape Town, South Africa. I have spent more than thirteen years working in content and search, and the pattern is always the same: the best material already exists in the heads of the people doing the work.</p>
<p>A dentist explains something to a patient with real clarity. A realtor notices something about a street that no listing mentions. Then both go back to work, and the insight never reaches the page.</p>
<p>Ryno Croft exists to close that gap. I ask good questions, listen carefully, and shape what I hear into writing that is clear, specific and recognizably yours.</p>
<h2>Why distinctive content matters</h2>
<p>When every practice and every agent publishes the same generic advice, the reader learns nothing about who is actually worth choosing. Distinctive writing shows how you think and what you care about, and it does so consistently.</p>
<h2>How AI fits in</h2>
<p>I use AI tools where they help, mostly for organizing research and exploring angles. They do not replace judgment. Everything you receive is reviewed, edited and checked against what you told me, and anything that cannot be supported is removed or flagged for you.</p>
<h2>Where I work</h2>
<p>I work remotely from South Africa with clients in the United States. I do not have a US office or address, and I would rather say so plainly.</p></div>
<div class="btns">${cta('/contact', 'Start an enquiry')}${cta('/services', 'See the packages', true)}</div></div></section>
`});

// ---- Contact ----
const pkgOpts = pk.packages.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
layout({
  file: 'contact.html', urlPath: '/contact', h1Page: '/contact',
  title: 'Contact Ryno Croft: Start a Content Writing Enquiry',
  description: 'Tell Ryno Croft what content you need. A short enquiry form for dental practitioners and luxury real estate professionals.',
  ld: { json: [orgLd] },
  body: `
<section class="hero"><div class="wrap narrow"><p class="eyebrow">Contact</p><h1>Tell me what you need.</h1>
<p class="lede">A few details are enough to start. I reply by email with questions or a recommended package. There is no obligation, and no payment is taken here.</p>
<form id="enquiry-form" class="enquiry" name="${site.formName}" method="POST" action="/thank-you" data-netlify="true" data-netlify-honeypot="bot-field">
  <input type="hidden" name="form-name" value="${site.formName}">
  <p class="hp"><label>Do not fill this out <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
  <div><label for="name">Name</label><input id="name" name="name" autocomplete="name" required></div>
  <div><label for="email">Business email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
  <div><label for="profession">Profession or business type</label><select id="profession" name="profession" required><option value="">Choose one</option><option value="dental">Dental practice</option><option value="realestate">Luxury real estate</option><option value="other">Something else</option></select></div>
  <div><label for="website">Website <span class="hint">(optional)</span></label><input id="website" name="website" type="url" placeholder="https://" autocomplete="url"></div>
  <div><label for="package">Preferred package</label><select id="package" name="package"><option value="not-sure">Not sure yet</option>${pkgOpts}</select></div>
  <div><label for="need">What content do you need?</label><textarea id="need" name="need" required></textarea></div>
  <div><label for="context">Anything else I should know? <span class="hint">(optional)</span></label><textarea id="context" name="context"></textarea></div>
  <p class="small">I use your details only to reply to this enquiry. I will not add you to a marketing list unless you ask me to. See the <a href="/privacy.html">privacy policy</a>.</p>
  <div id="form-ok" class="msg ok" role="status"></div>
  <div id="form-err" class="msg err" role="alert" tabindex="-1">Something went wrong and your message may not have been sent. Please try again, or email <a href="mailto:${site.email}">${site.email}</a>.</div>
  <div><button class="btn" type="submit">Send enquiry</button></div>
</form>
<p style="margin-top:2rem">Prefer email? Write to <a href="mailto:${site.email}">${site.email}</a>. If you would rather talk first, you can <a href="${site.calLink}" target="_blank" rel="noopener noreferrer">book a 15-minute call</a>.</p>
</div></section>
`});

// ---- Thank you ----
layout({
  file: 'thank-you.html', urlPath: '/thank-you', h1Page: '', noindex: true,
  title: 'Thank you | Ryno Croft', description: 'Your enquiry has been received.',
  body: `<section class="hero"><div class="wrap narrow"><p class="eyebrow">Enquiry received</p><h1>Thank you.</h1>
<p class="lede">Your message has been sent. I will read it and reply to you by email with questions or a recommendation.</p>
<p>In the meantime you can read the <a href="/insights">samples and articles</a> or look at the <a href="/services">packages</a> in detail.</p></div></section>`
});

// ---- sitemap + robots ----
const legacy = ['/authority-content', '/email-marketing.html', '/authority-audit.html', '/sa-business.html', '/privacy.html', '/terms.html'];
const urls = [...written.filter((w) => !w.noindex).map((w) => w.urlPath), ...legacy];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${site.domain}${u === '/' ? '/' : u}</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.domain}/sitemap.xml\n`);
console.log(`Built ${written.length} pages, ${posts.length} articles, ${urls.length} sitemap URLs.`);
