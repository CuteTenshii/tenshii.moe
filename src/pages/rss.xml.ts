import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getPosts } from '@/lib/blog';

export const GET: APIRoute = async (context) => {
  const posts = await getPosts();

  return rss({
    title: 'Tenshii\'s blog',
    description: 'Notes on the things I build and take apart.',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
    })),
    customData: '<language>en-us</language>',
  });
};
