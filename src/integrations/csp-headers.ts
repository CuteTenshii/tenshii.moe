import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

/**
 * Writes `dist/_headers`, hashing every inline script and style the build
 * emitted into one policy served on all paths.
 *
 * Astro's own `security.csp` emits a per-page <meta> tag instead, which
 * breaks <ClientRouter />: it runs the next page's inline scripts without a
 * reload, under the policy the browser applied to the current page.
 */
export default function cspHeaders(): AstroIntegration {
  return {
    name: 'csp-headers',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const { scripts, styles, stylesheets } = await scan(await htmlFiles(outDir));
        const preload = stylesheets.map((href) => `<${href}>; rel=preload; as=style`).join(', ');
        const headers = [
          `  Content-Security-Policy: ${policy(scripts, styles)}`,
          '  Cross-Origin-Opener-Policy: same-origin',
          '  Cross-Origin-Resource-Policy: same-origin',
          `  Permissions-Policy: ${PERMISSIONS_POLICY}`,
          ...(preload ? [`  Link: ${preload}`] : []),
        ];

        await writeFile(join(outDir, '_headers'), `/*\n${headers.join('\n')}\n`, 'utf8');
        logger.info(`_headers written, ${scripts.length + styles.length} hash(es), ${stylesheets.length} preload(s)`);
      },
    },
  };
}

const PERMISSIONS_POLICY = ['accelerometer', 'autoplay', 'browsing-topics', 'camera', 'display-capture',
  'encrypted-media', 'fullscreen', 'geolocation', 'gyroscope', 'magnetometer', 'microphone', 'midi',
  'payment', 'screen-wake-lock', 'usb'].map((feature) => `${feature}=()`).join(', ');

// An origin missing here is an origin the browser refuses, so this list has to
// be extended alongside the markup.
function policy(scriptHashes: string[], styleHashes: string[]): string {
  const directives: Record<string, string[]> = {
    'default-src': ['\'self\''],
    'script-src': ['\'self\'', 'https://s.tenshii.moe', ...scriptHashes],
    // Shiki colors code tokens through style attributes, which only
    // 'unsafe-inline' covers; splitting keeps that off <style> elements.
    'style-src-elem': ['\'self\'', ...styleHashes],
    'style-src-attr': ['\'unsafe-inline\''],
    // Without this, browsers predating style-src-elem/attr drop to default-src.
    'style-src': ['\'self\'', '\'unsafe-inline\''],
    'font-src': ['\'self\''],
    // miwa.lol and raw.githubusercontent.com serve the project screenshots.
    'img-src': ['\'self\'', 'https://miwa.lol', 'https://raw.githubusercontent.com'],
    'connect-src': [
      '\'self\'',
      'https://s.tenshii.moe', // Plausible
      'https://api.github.com', // stars and last push on /projects
      'https://git.tenshii.moe', // the same, for the Forgejo-hosted repos
    ],
    // Nothing embeds, plays, or installs anything, so these stay shut.
    'frame-src': ['\'none\''],
    'media-src': ['\'none\''],
    'object-src': ['\'none\''],
    'worker-src': ['\'none\''],
    'manifest-src': ['\'none\''],
    // No <base> tag anywhere, so an injected one cannot repoint relative URLs.
    'base-uri': ['\'none\''],
    'form-action': ['\'none\''],
    'frame-ancestors': ['\'none\''],
    'upgrade-insecure-requests': [],
  };

  return Object.entries(directives)
    .map(([directive, sources]) => [directive, ...sources].join(' '))
    .join('; ');
}

// Anything carrying a src is covered by the origins in script-src instead.
const inlineScript = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
const inlineStyle = /<style[^>]*>([\s\S]*?)<\/style>/gi;
const stylesheet = /<link[^>]*\brel=["']?stylesheet["']?[^>]*\bhref=["']([^"']+)["']/gi;

const sha256 = (body: string) => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;

async function scan(pages: string[]) {
  const scripts = new Set<string>();
  const styles = new Set<string>();
  // Only what every page links, since `_headers` has a single `/*` block.
  let shared: string[] | undefined;

  for (const page of pages) {
    const html = await readFile(page, 'utf8');
    for (const [, body] of html.matchAll(inlineScript)) if (body) scripts.add(sha256(body));
    for (const [, body] of html.matchAll(inlineStyle)) if (body) styles.add(sha256(body));

    const linked = [...html.matchAll(stylesheet)].map(([, href]) => href).filter((href) => href.startsWith('/'));
    shared = shared?.filter((href) => linked.includes(href)) ?? linked;
  }

  return {
    scripts: [...scripts].sort(),
    styles: [...styles].sort(),
    stylesheets: [...new Set(shared)].sort(),
  };
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
