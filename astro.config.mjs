// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import preact from '@astrojs/preact';

// The signed-in app and the auth forms are private screens: noindex in the
// layout, and kept out of the sitemap here.
const PRIVATE = /\/(app|login|signup|reset)\//;

// https://astro.build/config
export default defineConfig({
  site: 'https://proteinandlifts.com',
  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [sitemap({ filter: (page) => !PRIVATE.test(page) }), preact()]
});
