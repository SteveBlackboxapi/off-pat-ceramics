import { defineCollection, z } from 'astro:content';

// =============================================================
//  EVENTS — workshops, open studio days, etc.
//  Add a new file in src/content/events/ to create a new event.
// =============================================================
const events = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    endDate: z.date().optional(),
    time: z.string(),                    // e.g. "10:00 AM – 4:00 PM"
    location: z.string(),
    image: z.string().optional(),         // path under /public, e.g. "/images/workshop.jpg"
    imageAlt: z.string().optional(),
    description: z.string(),
    reserveUrl: z.string().optional(),    // booking link
    price: z.string().optional(),
    skillLevel: z.string().optional(),
    whatToBring: z.string().optional(),
    cancellationPolicy: z.string().optional(),
    spotsLeft: z.number().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

// =============================================================
//  JOURNAL — long-form posts, inspiration pieces, stories.
// =============================================================
const journal = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    date: z.date(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    excerpt: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

// =============================================================
//  WORKS — gallery items, individual pieces.
// =============================================================
const works = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    year: z.number(),
    series: z.string().optional(),       // e.g. "Tidelines"
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    materials: z.string(),                // e.g. "stoneware · celadon"
    dimensions: z.string().optional(),    // e.g. "18cm"
    price: z.string().optional(),
    description: z.string().optional(),
    available: z.boolean().default(true),
    featured: z.boolean().default(false),
    order: z.number().default(0),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  events,
  journal,
  works,
};
