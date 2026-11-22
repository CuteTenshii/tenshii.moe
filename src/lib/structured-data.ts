import { profileUrls } from '@/lib/profiles';

type Node = Record<string, unknown>;

const SITE = import.meta.env.SITE;
const PERSON_ID = new URL('/#person', SITE).toString();
const WEBSITE_ID = new URL('/#website', SITE).toString();

/** An absolute URL on this site. */
export const siteUrl = (path: string): string => new URL(path, SITE).toString();

/**
 * Tenshii as an author or publisher. Google does not follow `@id` across
 * pages, so every reference carries the name and URL itself.
 */
export const personRef = (): Node => ({
  '@type': 'Person',
  '@id': PERSON_ID,
  name: 'Tenshii',
  url: siteUrl('/'),
});

/** The full Person, with the profiles that tie the name to the same someone. */
export const person = (): Node => ({
  ...personRef(),
  image: siteUrl('/img/pfp.webp'),
  sameAs: Object.values(profileUrls),
});

export const website = (description: string): Node => ({
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: 'Tenshii.moe',
  url: siteUrl('/'),
  description,
  inLanguage: 'en',
  author: personRef(),
  publisher: personRef(),
});

/** A breadcrumb trail from the home page, each step as [name, path]. */
export const breadcrumbs = (...steps: [name: string, path: string][]): Node => ({
  '@type': 'BreadcrumbList',
  itemListElement: [['Home', '/'] as const, ...steps].map(([name, path], index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name,
    item: siteUrl(path),
  })),
});

/** Wraps nodes in one document, so a page can describe several things at once. */
export const graph = (...nodes: Node[]): Node => ({ '@context': 'https://schema.org', '@graph': nodes });

/** JSON for an inline `<script type="application/ld+json">`, safe against a stray `</script>` in a value. */
export const serializeJsonLd = (data: object): string => JSON.stringify(data).replace(/</g, '\\u003c');
