# Off-Pat Ceramics — site

The Off-Pat Ceramics website, built with Astro and edited in Markdown.
Prepared for Cloudflare Workers with Static Assets. See the cutover steps below;
committing these files does not move the live site or remove its Netlify project.

---

## 1 · Quick start (local)

Use Node.js 22 (also declared in `.node-version`).

```bash
npm ci
npm run dev
```

Astro serves the site at `http://localhost:4321`. To build and then preview
using the Cloudflare runtime:

```bash
npm run build
npm run preview:cloudflare
```

The static output is `dist/`. No server-rendering adapter, database, or API
credentials are required for the default email-contact version.

---

## 2 · Deploy to Cloudflare and retire Netlify

This migration uses **Cloudflare Workers with Static Assets**. The
`wrangler.jsonc` file declares the asset directory, clean URLs, and custom 404
handling. `public/_headers` preserves the previous security headers.

### Git-connected deployment

In the Cloudflare dashboard, open **Workers & Pages**, create a Worker, and
choose the option to import a Git repository. Select
`SteveBlackboxapi/off-pat-ceramics`.

| Setting | Value |
|---|---|
| Worker name | `off-pat-ceramics` |
| Root directory | Repository root |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Production branch after cutover | `main` |
| Node version | `22` (from `.node-version`) |

For the first validation deployment, choose the migration branch
`codex/cloudflare-migration`, which contains the Cloudflare configuration.
Keep the existing Netlify production deployment running during this check.
Cloudflare generates the actual `workers.dev` URL; copy it from the deployment
result rather than assuming the account subdomain.

Once deployed, the build integration can rebuild and deploy on pushes to its
selected production branch. After the migration branch is merged, change that
production branch to `main`.

### Contact enquiries: decide before cutover

The old form depended on Netlify Forms. Cloudflare does not provide that
service simply by moving the HTML. This branch removes the Netlify form
attributes and uses an explicit email contact by default, pointing to the
existing studio email in `src/config.ts`. It does not submit messages or show
an unearned success response.

To retain an on-page form, configure a public HTTPS form-processing endpoint
using the build variable `PUBLIC_CONTACT_FORM_ACTION`, then rebuild. The form
posts `name`, `email`, `subject`, and `message` using a normal HTML POST.
The chosen service must support these fields, validate submissions, provide
spam protection, and display a real success/error response. There is no
built-in form backend in this repository. Do not use a generic URL or an API
endpoint requiring secret headers; the action is public in the generated HTML.

`.env.example` documents the optional variable for local builds. Until an
endpoint is configured and tested, the page shows the studio email and an
**Email the studio** link that opens the visitor's email app.

Before switching the live site, confirm the email-only contact is acceptable,
or configure and test the replacement form. Existing Netlify submissions do
not move with the Git repository: export any records that must be retained
before removing that project.

### Domain and cutover

1. Verify the Cloudflare URL: homepage, gallery and individual pieces,
   journal and individual posts, studio, contact, mobile navigation, images,
   security headers, and a deliberately missing URL returning the 404 page.
2. Confirm email enquiries are acceptable, or configure and test the new form.
3. If a custom domain is in use, identify its existing Netlify/DNS settings and
   preserve a record for rollback. Add that domain in the Worker's
   **Settings → Domains & Routes**. Worker custom domains require a domain
   managed in the same Cloudflare account. Preserve email DNS records (MX/TXT)
   when changing DNS; do not change unrelated services.
4. Set `SITE_URL` to the confirmed public HTTPS origin as a Cloudflare **build**
   variable and rebuild. The repository no longer contains a fake domain.
5. Merge this branch and point Cloudflare's production build integration at
   `main`. Pause Netlify's automatic production builds during cutover so
   merging the migration cannot inadvertently alter the old production site.
6. Verify the real domain, HTTPS, images, and contact route on Cloudflare.
   Keep the Netlify deployment available until those checks pass.
7. Export retained Netlify form submissions, then disconnect its Git
   integration and retire the old site when rollback is no longer needed.
   Account deletion and subscription cancellation are separate actions.

Rollback before Netlify is retired: restore the recorded web DNS records to
Netlify. Keep the verified old deployment available for this purpose; if
rebuilding there, use the pre-migration revision containing `netlify.toml` and
the original Netlify form.

### CLI deployment (optional)

For an already authenticated Cloudflare CLI session:

```bash
npm run deploy
```

This builds before deploying. The Cloudflare dashboard integration uses the
separate commands above so it builds only once. Do not commit API tokens.

Official guidance:
- [Migrate Netlify to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/netlify-to-workers/)
- [Workers build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/)

---

## 3 · Adding content

This is the whole point of using Astro — every piece of content is a
markdown file. Add a file, rebuild, it's on the site.

### Adding a new event

Create `src/content/events/your-event.md`:

```markdown
---
title: 'Sunset Throwing Session'
date: 2026-07-04
time: '5:00 PM – 8:00 PM'
location: 'Your Studio, Coastal Britain'
image: '/images/sunset-event.jpg'
imageAlt: 'Studio wheel at sunset.'
description: |
  A relaxed evening at the wheel with the sea outside.
reserveUrl: 'https://yourbookingplatform.com/sunset-session'
price: '£90'
skillLevel: 'All levels welcome.'
whatToBring: 'Just yourself.'
cancellationPolicy: 'Full refund 7 days prior.'
spotsLeft: 6
featured: false       # set true to make it the big featured event on the homepage
draft: false          # set true to hide while you're still editing
---

Optional longer write-up of the event goes here. This bit shows up
on the homepage too.
```

Save the file. The homepage will automatically show whichever event
has the soonest upcoming date. Past events disappear automatically.

### Adding a journal post

Create `src/content/journal/your-post-title.md`:

```markdown
---
title: 'A note on glaze'
subtitle: 'Why I stopped trying to control it'
date: 2026-05-20
image: '/images/glaze-note.jpg'
imageAlt: 'Glaze swatches on test tiles.'
excerpt: |
  Short blurb that shows up on the journal index page.
tags: ['glaze', 'process']
draft: false
---

# Heading

Your post body, in markdown. You can use **bold**, _italics_, links,
lists, blockquotes, images — anything markdown supports.

## Subheading

More writing.
```

The filename becomes the URL slug, so `your-post-title.md` →
`/journal/your-post-title`.

### Adding a gallery piece

Create `src/content/works/your-piece.md`:

```markdown
---
title: 'Headland Bowl No. 2'
year: 2026
series: 'Tidelines'        # used to group pieces under a heading
image: '/images/headland-no-2.jpg'
imageAlt: 'A small bowl with a coastal glaze.'
materials: 'stoneware · celadon'
dimensions: '16cm diameter'
price: '£165'
available: true
order: 5                   # lower numbers appear first
draft: false
---

Short description of the piece.
```

---

## 4 · Customising the brand

Everything brand-specific lives in **one file**: `src/config.ts`.
Open it, edit the values, save. Changes propagate to the header,
footer, contact page, SEO defaults, and so on.

```ts
export const site = {
  name: 'Your Studio',
  tagline: 'Hand-thrown ceramics',
  location: 'Coastal Britain',
  email: 'hello@yourstudio.com',
  // ...etc
};
```

### Colours and fonts

Open `src/styles/global.css`. The first block (`:root`) is all the
design tokens:

```css
:root {
  --color-bg: #EDE7DC;      /* page background */
  --color-text: #2A241E;    /* main text colour */
  --color-accent: #C25A3E;  /* terracotta — buttons, hover, accents */
  /* ... */
}
```

Change those and the entire site re-themes. Same for fonts — swap
`--font-display` and `--font-body` for any two Google Fonts (and
update the `<link>` tag in `src/layouts/BaseLayout.astro` to load them).

---

## 5 · Connecting Supabase for images (later)

You don't need to do this on day one. Local images under `public/images/`
work fine and ship with the site.

When you're ready, two routes:

### Easiest: just paste URLs

In any markdown file, change:

```yaml
image: '/images/workshop.jpg'
```

to:

```yaml
image: 'https://yourproject.supabase.co/storage/v1/object/public/images/workshop.jpg'
```

That's it — Astro doesn't care whether the URL is local or remote.

### More involved: dynamic gallery from Supabase

If you want the gallery to query Supabase directly (so adding a row in
Supabase shows a new piece on the site without redeploying), that
requires switching parts of the site from static to server-rendered.
That's a non-trivial change — happy to walk you through it when you're
ready.

---

## 6 · Project structure

```
your-studio-site/
├── public/                 ← static files served as-is
│   ├── favicon.svg
│   └── images/             ← your photos
├── src/
│   ├── config.ts           ← brand settings (edit this first!)
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── components/
│   │   ├── Header.astro
│   │   └── Footer.astro
│   ├── pages/              ← every file here becomes a page
│   │   ├── index.astro          → /
│   │   ├── gallery.astro        → /gallery
│   │   ├── about.astro          → /about
│   │   ├── journal.astro        → /journal
│   │   ├── journal/[...slug].astro  → /journal/post-name (dynamic)
│   │   ├── contact.astro        → /contact
│   │   └── 404.astro
│   ├── content/            ← markdown content
│   │   ├── config.ts            ← schemas (do not delete)
│   │   ├── events/
│   │   ├── journal/
│   │   └── works/
│   └── styles/
│       └── global.css
├── astro.config.mjs
├── wrangler.jsonc          ← Cloudflare static asset hosting
├── package.json
└── tsconfig.json
```

---

## 7 · Common edits — quick reference

| Want to change… | Edit this |
|---|---|
| Studio name, location, email, social | `src/config.ts` |
| Site colours / fonts | `src/styles/global.css` (`:root` block at the top) |
| Header logo / nav | `src/components/Header.astro` |
| Footer text / links | `src/components/Footer.astro` |
| Homepage layout | `src/pages/index.astro` |
| Add a page | Create `src/pages/new-page.astro` |
| Add to nav menu | Edit the `nav` array in `src/config.ts` |
| About-page bio | `src/pages/about.astro` |
| Contact form options | `src/pages/contact.astro` |

---

## 8 · Contact configuration

The contact page uses the studio email in `src/config.ts` unless
`PUBLIC_CONTACT_FORM_ACTION` is configured at build time. See section 2 for
replacement form requirements, testing, and preservation of old Netlify
submissions. Netlify's form dashboard is not part of the Cloudflare deployment.
