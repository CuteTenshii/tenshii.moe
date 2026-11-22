import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;

/** Every blog post, newest first. */
export async function getPosts(): Promise<BlogPost[]> {
  const posts: BlogPost[] = await getCollection('blog');
  return posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

const WORDS_PER_MINUTE = 200;

/**
 * Words of prose in the raw Markdown/MDX source. Counting the source rather
 * than the rendered HTML is what lets the index show the same reading time as
 * the article page, since `render()` output is only available on the article.
 */
export function wordCount(body: string | undefined): number {
  if (!body) return 0;

  const prose = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/^(?:import|export)\s.*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~|-]/g, ' ');

  return prose.split(/\s+/).filter(Boolean).length;
}

export function readingTimeMinutes(body: string | undefined): number {
  return Math.max(1, Math.round(wordCount(body) / WORDS_PER_MINUTE));
}

export function formatPostDate(date: Date): string {
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}
