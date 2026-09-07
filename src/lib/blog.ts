import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;

/** Every blog post, newest first. */
export async function getPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog');
  return posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

const WORDS_PER_MINUTE = 200;

/**
 * Rough reading time from the raw Markdown/MDX source. Counting the source
 * rather than the rendered HTML is what lets the index show the same number as
 * the article page, since `render()` output is only available on the article.
 */
export function readingTimeMinutes(body: string | undefined): number {
  if (!body) return 1;

  const prose = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/^(?:import|export)\s.*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~|-]/g, ' ');

  const words = prose.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function formatPostDate(date: Date): string {
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}
