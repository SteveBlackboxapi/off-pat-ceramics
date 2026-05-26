Drop your real photos in this folder. The site looks for these paths:

  /images/workshop.jpg              ← featured event (homepage), aspect 4:5
  /images/journal-inspiration.jpg   ← journal post hero, aspect 4:3
  /images/journal-tide-stone.jpg    ← journal post hero, aspect 4:3
  /images/work-tide-vessel.jpg      ← gallery piece, aspect 4:5
  /images/work-tidepool-bowl.jpg    ← gallery piece, aspect 4:5
  /images/work-headland-jar.jpg     ← gallery piece, aspect 4:5
  /images/work-saltwater-pitcher.jpg ← gallery piece, aspect 4:5
  /images/about-portrait.jpg        ← about page (referenced in code comments)
  /images/contact.jpg               ← contact page (referenced in code comments)
  /images/og-default.jpg            ← link-preview image when site is shared

The aspect ratios above are what the layouts expect — the CSS uses
`object-fit: cover`, so anything close will work without breaking
layout, but going further off-ratio will crop more aggressively.

You can also change which file each piece of content uses by editing
the `image:` field in the matching markdown file under `src/content/`.

When you're ready to use Supabase Storage, just replace the local
paths in the markdown with full Supabase URLs, e.g.
`https://yourproject.supabase.co/storage/v1/object/public/images/workshop.jpg`
