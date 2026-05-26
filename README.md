# Your Studio — site

A clean, editorial Astro site for a ceramic studio (or any maker-style brand).
Designed to be deployed to Netlify and edited in markdown.

---

## 1 · Quick start (local)

You need [Node.js 20+](https://nodejs.org) installed.

```bash
npm install
npm run dev
```

The site will be at `http://localhost:4321`. Edits to any file
hot-reload automatically.

To build for production:

```bash
npm run build
```

The static site is output to `dist/`. That's what Netlify deploys.

---

## 2 · Deploy to Netlify

You've got two routes — pick whichever is easier.

### A) Drag-and-drop (simplest)

1. Run `npm run build` locally.
2. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
3. Drag the `dist/` folder onto the page.
4. Done — you'll get a `*.netlify.app` URL immediately.

This is great for the first deploy, but every update means
re-building locally and re-dragging.

### B) Git-based (recommended for ongoing edits)

1. Push this folder to a GitHub / GitLab / Bitbucket repo.
2. In Netlify, click **Add new site → Import an existing project**.
3. Pick your repo. Netlify auto-detects Astro and reads `netlify.toml`,
   so you don't need to configure anything.
4. Click **Deploy**. Every `git push` to your main branch redeploys
   automatically. Pull requests get preview URLs.

### Connecting your existing domain

In your Netlify site dashboard:

1. **Domain management → Add a domain you already own**, enter it.
2. Netlify gives you DNS records to add. You have two options:
   - **Easiest**: change your domain's nameservers to Netlify's
     (Netlify shows you which ones). Netlify then handles all DNS.
   - **Keep your existing DNS provider**: add a `CNAME` (or `A` for
     apex domains) pointing at Netlify, as shown in their instructions.
3. Wait for DNS to propagate (usually a few minutes, sometimes a few
   hours). HTTPS certificate is provisioned automatically by Netlify.

That's it — no server, no maintenance, no hosting fees on the free tier.

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
├── netlify.toml
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

## 8 · Form submissions

The contact form uses **Netlify Forms** — submissions appear in your
Netlify dashboard under **Forms** with no backend needed. The free
tier includes 100 submissions per month. Spam protection is built-in
(there's a hidden honeypot field already configured).

To get email notifications when someone submits, configure them in
**Site settings → Forms → Form notifications** in Netlify.

---

That's everything. Anything unclear, ask.
