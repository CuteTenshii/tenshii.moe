import { posix } from 'node:path';
import { getImage } from 'astro:assets';

export type ContentImage = { src: string; alt: string };

const localImages = import.meta.glob<{ default: ImageMetadata }>('/src/content/**/*.{png,jpg,jpeg,webp,gif,avif}');

const fencedCode = /^(```|~~~)[\s\S]*?^\1/gm;
const markdownImage = /!\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const imgTag = /<img\b[^>]*>/g;
const defaultImport = /^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/gm;

/**
 * The first image in a Markdown or MDX entry, as a site-relative or absolute
 * URL the build emits. Local files go through `getImage` because their
 * originals are only kept when something references them.
 */
export async function firstImage(entry: { body?: string; filePath?: string }): Promise<ContentImage | null> {
  if (!entry.body || !entry.filePath) return null;

  const body = entry.body.replace(fencedCode, '');
  const imports = new Map([...body.matchAll(defaultImport)].map(([, name, path]) => [name, path]));
  const candidates = [
    ...[...body.matchAll(markdownImage)].map((match) => ({ index: match.index, src: match[2], alt: match[1] })),
    ...[...body.matchAll(imgTag)].map((match) => ({ index: match.index, ...parseImgTag(match[0], imports) })),
  ].sort((a, b) => a.index - b.index);

  const first = candidates.find(({ src }) => src);
  if (!first?.src) return null;

  return { src: await resolveSource(first.src, entry.filePath), alt: first.alt };
}

function parseImgTag(tag: string, imports: Map<string, string>): { src: string | undefined; alt: string } {
  const alt = tag.match(/\balt=(?:"([^"]*)"|'([^']*)')/);
  const literal = tag.match(/\bsrc=(?:"([^"]+)"|'([^']+)')/);
  const imported = tag.match(/\bsrc=\{\s*(\w+)\.src\s*\}/);

  return {
    src: literal ? literal[1] ?? literal[2] : imported ? imports.get(imported[1]) : undefined,
    alt: alt ? alt[1] ?? alt[2] : '',
  };
}

async function resolveSource(src: string, entryPath: string): Promise<string> {
  if (/^https?:\/\//.test(src) || src.startsWith('/')) return src;

  const key = `/${posix.join(posix.dirname(entryPath), src)}`;
  const load = localImages[key];
  if (!load) throw new Error(`${entryPath} references an image that does not exist: ${src}`);

  const { default: metadata } = await load();
  return (await getImage({ src: metadata })).src;
}
