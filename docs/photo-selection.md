# Photo selection — 12 October 2026

Steven asked us to choose the strongest photographs, avoid near-duplicates,
and optimise the selected images as WebP. The original uploads are unchanged.

| Original upload | WebP name | Use / reason |
| --- | --- | --- |
| `image(6).png` | `blue-coast.webp` | Homepage lead and gallery: clear composition, blue glaze and red marker |
| `image(1).png` | `rust-coast.webp` | Gallery: fuller view of the rust and cream seascape |
| `image(2).png` | `crackle-bowl.webp` | Gallery: shows the bowl's shape, rim and interior |
| `image(3).png` | `architectural-wall-piece.webp` | Gallery: adds architectural variety |
| `image(8).png` | `turquoise-coast.webp` | Gallery: distinct framed turquoise coastal piece |
| `image(10).png` | `ammonite-crackle.webp` | Gallery detail: the better-balanced of the dark ammonite views |
| `image(4).png` | `ammonite-detail.webp` | About Pat: clearer, more complete pale ammonite close-up |
| `image(20261012-123633).png` | `winter-show-2026.webp` | Events only: the supplied Suffolk Craft Society poster |

Hold the tighter rust-coast (`image.png`) and blue-coast (`image(7).png`) details
in reserve. Omit `image(5).png` and `image(9).png` from this selection as near-
duplicates. Hold `image(20261012-123629).png` in reserve to keep the initial
gallery varied. No original files were deleted.

The poster credits the pictured ceramics to **Moira Goodall**, with photography
by **Chris White**. It is not an image of Pat's work and must not be used in
her gallery or as her homepage artwork.

## Web images

- Full images: original proportions, maximum 1600px on the longest side.
- Responsive small images: maximum 800px on the longest side.
- WebP quality 80, method 6; poster quality 85 to preserve its text.
- No crops, colour changes, artwork changes or AI-generated replacements.
- Eight originals: 33,370,088 bytes. Eight full WebPs: 1,948,850 bytes
  (94.2% smaller). Seven small WebPs add 564,694 bytes, selected by the browser
  through `srcset`; they are alternatives, not additional image downloads.
- Blue coastal lead: 4,349,887 bytes to 180,654 bytes (small version 59,022).

These optimised derivatives are included under `public/images/selected/` so
the preview can serve the chosen uploads immediately. The original Supabase
bucket stays private and unchanged. Existing studio/portrait images continue
to use their established signed Supabase URLs. If the new derivatives are
later uploaded to Supabase, update the paths in `src/data/pieces.ts` and the
homepage/About/events sources to the provided signed URLs.

Gallery captions describe visible subjects. Official artwork titles, dates,
dimensions and individual clay types have not been supplied and are not
invented. Pat's biography follows her supplied April 2022 statement; the
historical Naze Tower sentence is not presented as a current appearance.
