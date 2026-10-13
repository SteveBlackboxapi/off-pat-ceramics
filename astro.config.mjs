import { defineConfig } from 'astro/config';

export default defineConfig({
  // Set SITE_URL as a build variable after the production domain is confirmed.
  site: process.env.SITE_URL || undefined,
});
