import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

/**
 * Writes `dist/_headers` with a Content-Security-Policy covering the whole
 * site, completing `script-src` with a hash for every inline script the build
 * emitted.
 *
 * Astro's own `security.csp` option is not usable here: it emits a per-page
 * `<meta>` tag, and `<ClientRouter />` runs the next page's inline scripts
 * without a reload, under the policy the browser applied to the current page.
 * Hashing every page's scripts into one policy served on all paths is what
 * keeps navigation working.
 */
export default function cspHeaders(): AstroIntegration {
  return {
    name: 'csp-headers',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const hashes = await inlineScriptHashes(outDir);
        const headers = `/*\n  Content-Security-Policy: ${policy(hashes)}\n`;

        await writeFile(join(outDir, '_headers'), headers, 'utf8');
        logger.info(`_headers written, ${hashes.length} inline script(s) hashed`);
      },
    },
  };
}

/**
 * Every origin the built pages load from. An origin missing here is an origin
 * the browser refuses, so this list has to be extended alongside the markup.
 */
function policy(scriptHashes: string[]): string {
  const directives: Record<string, string[]> = {
    'default-src': ['\'self\''],
    'script-src': ['\'self\'', 'https://s.tenshii.moe', ...scriptHashes],
    // Shiki colors code blocks, and WakapiStats sizes its bars, through style
    // attributes, which a hash cannot cover, only 'unsafe-inline'.
    'style-src': ['\'self\'', '\'unsafe-inline\''],
    // The Google Fonts <link> in BaseLayout never reaches the browser as
    // written: Cloudflare Fonts rewrites it, and the faces, to this origin.
    'font-src': ['\'self\''],
    // miwa.lol and raw.githubusercontent.com serve the project screenshots.
    'img-src': ['\'self\'', 'https://miwa.lol', 'https://raw.githubusercontent.com'],
    'connect-src': [
      '\'self\'',
      'https://s.tenshii.moe', // Plausible
      'https://wakapi.tenshii.moe', // Programming Stats on the home page
      'https://api.github.com', // stars and last push on /projects
      'https://git.tenshii.moe', // the same, for the Forgejo-hosted repos
    ],
    'base-uri': ['\'self\''],
    'object-src': ['\'none\''],
    'frame-ancestors': ['\'none\''],
    'form-action': ['\'none\''],
  };

  return Object.entries(directives)
    .map(([directive, sources]) => [directive, ...sources].join(' '))
    .join('; ');
}

// Anything carrying a src is covered by the origins in script-src instead.
const inlineScript = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;

async function inlineScriptHashes(outDir: string): Promise<string[]> {
  const hashes = new Set<string>();

  for (const file of await htmlFiles(outDir)) {
    const html = await readFile(file, 'utf8');

    for (const [, body] of html.matchAll(inlineScript)) {
      if (!body) continue;
      hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
    }
  }

  return [...hashes].sort();
}

async function htmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = await Promise.all(entries.map((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  }));

  return found.flat();
}
