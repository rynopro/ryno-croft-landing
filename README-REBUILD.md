# Ryno Croft site: how to edit

The new pages are generated from data, then committed as plain HTML (Netlify still has no build step).

- Packages, prices, delivery dates: `content/packages.json` (set `price`, `delivery`, `paymentLink` once approved)
- Samples: `content/samples.json`
- Articles: add a `.md` file to `content/insights/` (front matter: title, slug, date, audience, description)
- Contact details and navigation: `content/site.json`
- Styles: `assets/css/site.css` (design tokens at the top)
- After any edit run `node scripts/build.mjs`, then commit the changed HTML.

The contact form uses Netlify Forms (form name `enquiry`). Turn on email notifications in Netlify: Site configuration > Forms > Form notifications.
Legacy pages (authority-content*, email-marketing, authority-audit, sa-business, business-*) are hand-written and not touched by the generator.
