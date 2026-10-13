# Off-Pat Ceramics

Pat Todd’s ceramics portfolio, upcoming events and contact enquiries. Built
with Astro; hosted on Cloudflare Workers with Static Assets. No shop,
checkout, prices or online booking.

## Current status

- Cloudflare preview: https://off-pat-ceramics.stevendavidlewis80.workers.dev
- Preview source branch: `codex/cloudflare-migration` (draft PR #1).
- Existing public website: https://offpatceramics.wordpress.com/
- Former staging copy: https://off-pat-ceramics.netlify.app/
- GoDaddy/domain work is deferred. Keep WordPress live until Steven approves
  the new design and explicitly authorizes the public switch.
- Typography: Arial throughout. Photos, upcoming appearances and enquiries
  are the priorities.

## Development and preview deployment

Use Node.js 22, as declared in `.node-version`.

```sh
npm ci
npm run dev
npm run build
npx wrangler deploy --dry-run
```

Static output is in `dist/`. For authenticated CLI deployment use
`npm run deploy`. No Supabase API credentials are required to build this site.

Cloudflare Workers Builds settings:

| Setting | Value |
| --- | --- |
| Worker | `off-pat-ceramics` |
| Branch during design review | `codex/cloudflare-migration` |
| Root | Repository root |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

The first deployment used a temporary build command that checked out the
migration branch. On 12 October 2026, Steven confirmed the settings above in
the Cloudflare dashboard: production branch `codex/cloudflare-migration`,
build command `npm run build`, deploy command `npx wrangler deploy`, and root
directory `/`. The temporary checkout command has been removed. Pushes to
this branch now target the workers.dev preview. Do not merge to `main` or
change the public domain as part of preview design work.

`wrangler.jsonc` configures static assets, clean URLs and the custom 404.
`public/_headers` contains the security headers. Set `SITE_URL` to the final
HTTPS origin only when the public domain has been confirmed.

If Astro builds successfully but Wrangler's Worker-name validation receives
`504 Gateway Timeout` from Cloudflare's `/workers/services/off-pat-ceramics`
API, the deployment request timed out. This does not establish a Worker-name
mismatch. Retry the failed build before changing the Worker name, build
commands or token permissions. The 12 October 2026 deployment encountered
this timeout after successfully building all 21 pages.

## Upcoming events

Homepage and `/events` share `src/components/EventList.astro`. Add a Markdown
file in `src/content/events/` with confirmed details from Pat, for example:

```yaml
---
title: 'Confirmed exhibition name'
date: 2027-04-10
endDate: 2027-04-11
time: '10am–4pm'
location: 'Confirmed venue and town'
description: 'A short description supplied by Pat.'
draft: true
---
```

Those example dates are not an announced event. Set `draft: false` only when
the real title, dates and venue are confirmed, then rebuild. `endDate` is
optional. Events remain visible through their final day in Europe/London,
including events that have already started. The browser also hides expired
entries between deployments. The three old sample events remain drafts.
The Suffolk Craft Society Winter Show (6–22 November 2026) is transcribed from
the supplied poster, including the earlier closing time on its final day.

## Enquiries

`src/config.ts` holds Pat’s email address. The default contact page links to
her email app through **Email Pat**. Gallery enquiries link to `/contact`.

An optional `PUBLIC_CONTACT_FORM_ACTION` build variable can enable an HTTPS
form service. The endpoint must accept the `name`, `email`, `subject` and
`message` fields and provide its own validation, spam protection and delivery
confirmation. Never put a secret key in this public URL. Without a configured
endpoint the site shows the email link, not an unhandled form.

## Photographs

Supabase project: `fgxfkyzvkpgrsphgjgxf` (**OFF PAT**).
The `images` storage bucket is private. Existing selected photos are served
using signed URLs already present in the page/content source. Preserve bucket
privacy; do not change access policies just to add a photo.

The October 2026 selection supplied in chat is optimised as WebP under
`public/images/selected/`, with responsive small variants. These derivatives
are served with the preview; the originals are unchanged. See
`docs/photo-selection.md` for the choices, source filenames and sizes.
Gallery data lives in `src/data/pieces.ts`; its captions are descriptive.

Upload additional pictures to this project, choose the photos to publish, and
add their signed URLs and accurate alt text to the appropriate pages. An
upload alone does not automatically publish an image in the gallery. Do not
put service-role keys or storage administration credentials in this repo.

## Editing

Click **Pat Todd** at the end of the footer, or open `/admin`. The private
editor supports on-page text editing, artwork titles and descriptions, event
dates/copy/posters, and replacement photographs. Choose a page, then click an
editable item in its preview. **Save draft** keeps changes private;
**Publish changes** makes the draft public. The previous published version
can be restored to a draft before republishing.

Authentication uses Supabase email sign-in links. Only the verified account
`stevendavidlewis@gmail.com` is authorized, through a fresh database lookup
in `offpat_private.is_editor()`. A sign-in by any other account confers no
content or image-library access. No secret/service-role key is shipped.

### One-time email return URL

In Supabase Authentication → URL Configuration, add this **Redirect URL**:

```text
https://off-pat-ceramics.stevendavidlewis80.workers.dev/admin
```

On 13 October, a read-only invalid-link check confirmed that this URL was not
yet allowed: Supabase fell back to `http://localhost:3000`. The connected MCP
tools do not expose Auth URL configuration. Complete this dashboard setting
before using the sign-in link; retain any existing URLs. When the public
domain is approved later, add its `/admin` URL as well.

### Content and uploads

The two `offpat_content` rows hold draft and published overrides. RLS exposes
only the published row to visitors. The save/publish RPC checks editor access,
uses a draft version to reject stale saves, and records previous published
content in `offpat_content_history`. These tables and Storage policies are
tracked in `supabase/migrations/`.

The editor offers the curated site pictures and the existing Supabase image
library. New selections are resized in the browser to a maximum 1600-pixel
long edge, converted to WebP, and given an 800-pixel alternative when useful.
They use new UUID names under the existing private `images/editor/` prefix.
Original images are preserved. Uploaded drafts are private; anonymous Storage
access is limited to files referenced by the published document. The Worker
serves them at `/media/…`. Signed editor previews last one hour.

The Worker renders published overrides into the static HTML before sending
it to visitors. Text is escaped, media paths are restricted, and changes need
no Git commit or rebuild. A last-known published copy is cached for database
outages, with the built site as a final fallback. `/admin` and draft preview
responses are not indexed or cached. Same-origin framing allows the editor's
preview; other sites cannot frame it.

Current supported editing scope: existing page sections and artwork entries,
including the existing event. Adding/removing whole artwork entries or events
still requires a source change. The editor does not change page URLs/layouts.

For direct source edits:

| Content | File |
| --- | --- |
| Fonts and colours | `src/styles/global.css` |
| Name, email, navigation | `src/config.ts` |
| Header and mobile menu | `src/layouts/BaseLayout.astro` |
| Homepage | `src/pages/index.astro` |
| Events | `src/content/events/*.md` |
| Gallery photos and captions | `src/data/pieces.ts` |
| Gallery layout | `src/pages/gallery.astro` and `src/pages/gallery/[...slug].astro` |
| Biography | `src/pages/about.astro` |
| Enquiries | `src/pages/contact.astro` |

## Retiring old hosting

Netlify is independent of the Cloudflare preview. Export any Netlify Forms
submissions worth keeping before deleting that project. Deleting Netlify does
not remove WordPress, the GitHub repository or the Supabase photographs.

The public WordPress site and GoDaddy DNS stay unchanged during design review.
After design approval, connect the confirmed domain to Cloudflare, preserving
existing email DNS records. Verify HTTPS, images, navigation and enquiries
before retiring WordPress. Account deletion and subscription cancellation are
separate decisions.
