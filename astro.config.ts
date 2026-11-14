import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { satteri } from '@astrojs/markdown-satteri';
import cspHeaders from './src/integrations/csp-headers';
import { nofollowExternalLinks } from './src/plugins/nofollow';

export default defineConfig({
  site: 'https://tenshii.moe',
  // cspHeaders reads the emitted HTML, so it has to come after every integration that contributes to it.
  integrations: [mdx(), sitemap(), cspHeaders()],
  markdown: { processor: satteri({ hastPlugins: [nofollowExternalLinks] }) },
  vite: { plugins: [tailwindcss()] },
  output: 'static',
});
