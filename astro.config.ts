import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://tenshii.moe',
  integrations: [react(), mdx(), sitemap()],
  vite: { plugins: [tailwindcss()] },
  output: 'static',
});
