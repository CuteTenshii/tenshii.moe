import type { HastPluginDefinition } from 'satteri';

const isOwnHost = (hostname: string) => hostname === 'tenshii.moe' || hostname.endsWith('.tenshii.moe');

export const nofollowExternalLinks: HastPluginDefinition = {
  name: 'nofollow-external-links',
  element: {
    filter: ['a'],
    visit(node, ctx) {
      const href = node.properties?.href;
      if (typeof href !== 'string' || !URL.canParse(href)) return;
      const { protocol, hostname } = new URL(href);
      if (protocol.startsWith('http') && !isOwnHost(hostname)) ctx.setProperty(node, 'rel', 'nofollow');
    },
  },
};
