import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import cspHeaders from './src/integrations/csp-headers';

export default defineConfig({
  site: 'https://tenshii.moe',
  // cspHeaders reads the emitted HTML, so it has to come after every integration that contributes to it.
  integrations: [mdx(), sitemap(), cspHeaders()],
  vite: { plugins: [tailwindcss()] },
  output: 'static',
});
