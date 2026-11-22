/**
 * Builders for Discord component embeds, the link preview Discord renders from
 * a `<script id="discord:component-embed">` payload in the page's <head>.
 * https://docs.discord.com/developers/link-previews/component-embeds
 */

export type LinkButton = { type: 2; style: 5; url: string; label: string };
export type ActionRow = { type: 1; components: LinkButton[] };
export type TextDisplay = { type: 10; content: string };
export type UnfurledMedia = { url: string };
export type Thumbnail = { type: 11; media: UnfurledMedia; description?: string };
export type Section = { type: 9; components: TextDisplay[]; accessory: Thumbnail | LinkButton };
export type MediaGallery = { type: 12; items: { media: UnfurledMedia; description?: string }[] };
export type Separator = { type: 14; divider?: boolean; spacing?: 1 | 2 };
export type ContainerChild = ActionRow | TextDisplay | Section | MediaGallery | Separator;
export type Container = { type: 17; accent_color?: number; components: ContainerChild[] };
export type ComponentEmbed = { component: Container };

const MAX_PAYLOAD_BYTES = 3000;
const MAX_COMPONENTS = 40;
const MAX_GALLERY_ITEMS = 10;
const MAX_MEDIA_URL_LENGTH = 2048;
const MAX_BUTTON_URL_LENGTH = 512;
const MAX_BUTTON_LABEL_LENGTH = 80;
const MAX_BUTTONS_PER_ROW = 5;
const MAX_MEDIA_DESCRIPTION_LENGTH = 1024;
const MEDIA_EXTENSIONS = ['.png', '.gif', '.jpg', '.jpeg', '.webp', '.avif', '.mp4', '.webm', '.mov'];

/** The blue used for links across the site (Tailwind's blue-400). */
export const SITE_ACCENT = 0x51a2ff;

export const text = (content: string): TextDisplay => ({ type: 10, content });

export const linkButton = (label: string, url: string | URL): LinkButton => ({
  type: 2,
  style: 5,
  url: url.toString(),
  label,
});

export const thumbnail = (url: string | URL, description?: string): Thumbnail => ({
  type: 11,
  media: { url: url.toString() },
  ...(description && { description }),
});

export const separator = (): Separator => ({ type: 14 });

/** A full-width gallery holding just `image`, or nothing when there is none Discord can unfurl. */
export function coverImage(image: { src: string; alt: string } | null, site: URL | undefined): MediaGallery[] {
  if (!image) return [];

  const url = new URL(image.src, site);
  if (!isEmbeddableMedia(url)) return [];

  const description = image.alt.slice(0, MAX_MEDIA_DESCRIPTION_LENGTH);
  return [{ type: 12, items: [{ media: { url: url.toString() }, ...(description && { description }) }] }];
}

/** Splits buttons into as many rows as Discord's per-row limit requires. */
export function actionRows(buttons: LinkButton[]): ActionRow[] {
  const rows: ActionRow[] = [];
  for (let i = 0; i < buttons.length; i += MAX_BUTTONS_PER_ROW) {
    rows.push({ type: 1, components: buttons.slice(i, i + MAX_BUTTONS_PER_ROW) });
  }
  return rows;
}

/** Whether Discord can render `url` as a thumbnail or gallery item, judged by its extension. */
export function isEmbeddableMedia(url: string | URL): boolean {
  const { pathname } = new URL(url);
  return MEDIA_EXTENSIONS.some((extension) => pathname.toLowerCase().endsWith(extension));
}

/** Escapes characters Discord markdown would otherwise interpret in plain text. */
export function escapeMarkdown(value: string): string {
  return value
    .replace(/[\\*_~`|[\]()<>]/g, '\\$&')
    // Headings, lists and quotes only start a block at the beginning of a line.
    .replace(/^(\s*)([#>-]|\d+\.)/gm, '$1\\$2');
}

/**
 * Serializes the embed for an inline `<script type="application/json">`,
 * throwing when Discord would reject it so a broken preview fails the build.
 */
export function serializeEmbed(embed: ComponentEmbed): string {
  validate(embed.component);

  // A literal "</script>" inside a description would close the tag early.
  const json = JSON.stringify(embed).replace(/</g, '\\u003c');
  const bytes = new TextEncoder().encode(json).byteLength;
  if (bytes > MAX_PAYLOAD_BYTES) {
    throw new Error(`Discord component embed is ${bytes} bytes, over the ${MAX_PAYLOAD_BYTES}-byte limit`);
  }

  return json;
}

function validate(container: Container): void {
  let components = 1;
  let galleryItems = 0;

  const checkMedia = ({ url }: UnfurledMedia) => {
    if (!/^https?:\/\//.test(url) || url.length > MAX_MEDIA_URL_LENGTH || !isEmbeddableMedia(url))
      throw new Error(`Discord component embed has unsupported media URL: ${url}`);
  };
  const checkButton = ({ url, label }: LinkButton) => {
    components += 1;
    if (!/^https?:\/\//.test(url) || url.length > MAX_BUTTON_URL_LENGTH)
      throw new Error(`Discord component embed has invalid button URL: ${url}`);
    if (!label || label.length > MAX_BUTTON_LABEL_LENGTH)
      throw new Error(`Discord component embed has invalid button label: "${label}"`);
  };

  for (const child of container.components) {
    components += 1;
    switch (child.type) {
      case 1:
        if (child.components.length === 0 || child.components.length > MAX_BUTTONS_PER_ROW)
          throw new Error(`Discord component embed has an action row with ${child.components.length} buttons`);
        child.components.forEach(checkButton);
        break;
      case 9:
        components += child.components.length;
        if (child.accessory.type === 11) {
          components += 1;
          checkMedia(child.accessory.media);
        } else {
          checkButton(child.accessory);
        }
        break;
      case 12:
        galleryItems += child.items.length;
        child.items.forEach(({ media }) => checkMedia(media));
        break;
    }
  }

  if (components > MAX_COMPONENTS)
    throw new Error(`Discord component embed has ${components} components, over the ${MAX_COMPONENTS} limit`);
  if (galleryItems > MAX_GALLERY_ITEMS)
    throw new Error(`Discord component embed has ${galleryItems} gallery items, over the ${MAX_GALLERY_ITEMS} limit`);
}
