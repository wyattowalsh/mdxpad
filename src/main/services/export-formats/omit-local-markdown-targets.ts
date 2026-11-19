/**
 * Remove markdown pictures and links that point at a local file.
 * A picture inside the source folder can keep its absolute path.
 */

import path from 'node:path';

import { decodeCssEscapes } from '@shared/lib/css-escape';
import { replaceCssImageFunctionAddresses } from '@shared/lib/css-image-function';

import { resolveWorkspaceFilePath } from '../ai/agent-path';

import { decodeHtmlEntities } from './markdown-entity';
import { advanceFence } from './markdown-fence';
import { linkDestination } from './markdown-link';
import { htmlTagEnd, safeImageAddress, safeLinkAddress } from './markdown-export-address';

const IMAGE = /!\[([^\]]*)\]\(((?:[^()]|\([^()]*\))+)\)/g;
const LINK = /(?<!!)\[([^\]]*)\]\(((?:[^()]|\([^()]*\))+)\)/g;

function hasScheme(address: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(address.trim());
}

function pictureAllowed(address: string, root: string | null): boolean {
  const safe = safeImageAddress(address);
  if (safe !== null && /^(?:https?:|data:)/i.test(safe)) {
    return true;
  }
  if (hasScheme(address) || root === null) {
    return safe !== null;
  }
  try {
    resolveWorkspaceFilePath(root, address);
    return true;
  } catch {
    return false;
  }
}

function attributeValue(raw: string): string {
  return raw.startsWith('"') || raw.startsWith("'") ? raw.slice(1, -1) : raw;
}

function tagAttribute(tag: string, name: string): string | null {
  const boundary = name.includes(':') ? name : `(?<![\\w:-])${name}`;
  const match = new RegExp(`${boundary}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, 'i').exec(tag);
  return match?.[1] ? decodeHtmlEntities(attributeValue(match[1])) : null;
}

function dropAttribute(tag: string, name: string): string {
  const boundary = name.includes(':') ? name : `(?<![\\w:-])${name}`;
  const pattern = new RegExp(`\\s+${boundary}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, 'i');
  return tag.replace(pattern, '');
}

function htmlImage(tag: string): { src: string; alt: string } | null {
  if (!/^<\s*img\b/i.test(tag)) {
    return null;
  }
  const src = tagAttribute(tag, 'src');
  if (src === null) {
    return null;
  }
  return { src, alt: tagAttribute(tag, 'alt') ?? '' };
}

const RESOURCE_TAGS = new Set(['img', 'video', 'audio', 'source', 'track', 'image', 'use']);

const HREF_TAGS = new Set([
  'image',
  'use',
  'feimage',
  'cursor',
  'filter',
  'pattern',
  'mask',
  'clippath',
  'marker',
  'textpath',
  'mpath',
  'lineargradient',
  'radialgradient',
  'meshgradient',
  'animate',
  'animatetransform',
  'animatemotion',
  'set',
  'femergenode',
  'discard',
]);

function elementName(tag: string): string {
  return (/^<\s*([A-Za-z][A-Za-z0-9:-]*)/.exec(tag)?.[1] ?? '').toLowerCase();
}

function keptSrcset(value: string, root: string | null): string {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => {
      const url = part.split(/\s+/)[0] ?? '';
      return url.length === 0 || pictureAllowed(url, root);
    })
    .join(', ');
}

function replaceAttribute(tag: string, name: string, value: string): string {
  const boundary = name.includes(':') ? name : `(?<![\\w:-])${name}`;
  const pattern = new RegExp(`(${boundary}\\s*=\\s*)("[^"]*"|'[^']*'|[^\\s>]+)`, 'i');
  return tag.replace(pattern, (_full, prefix: string, raw: string) => {
    const quote = raw.startsWith('"') || raw.startsWith("'") ? raw[0] : '';
    return `${prefix}${quote}${value}${quote}`;
  });
}

function resourceAttributes(name: string): readonly string[] {
  const href = HREF_TAGS.has(name) ? ['href', 'xlink:href'] : [];
  const media = RESOURCE_TAGS.has(name) ? ['src', 'poster', 'srcset', 'imagesrcset'] : [];
  return [...media, ...href];
}

function cssAddress(address: string): string {
  return decodeCssEscapes(decodeHtmlEntities(address.trim()));
}

function rewriteCssImport(css: string, root: string | null): string {
  return css.replace(
    /@import\s*(?:url\(\s*(?:(['"])([\s\S]*?)\1|([^)'"]+))\s*\)|(['"])([\s\S]*?)\4)/gi,
    (
      full,
      _quote: string | undefined,
      quotedUrl: string | undefined,
      bare: string | undefined,
      _plain: string | undefined,
      quoted: string | undefined
    ) => {
      const address = cssAddress(quotedUrl ?? bare ?? quoted ?? '');
      return pictureAllowed(address, root) ? full : '';
    }
  );
}

function rewriteCssUrls(css: string, root: string | null): string {
  const urls = css.replace(
    /url\(\s*(?:(['"])([\s\S]*?)\1|([^)'"]+))\s*\)/gi,
    (full, _quote: string | undefined, quoted: string | undefined, bare: string | undefined) => {
      const address = cssAddress(quoted ?? bare ?? '');
      return pictureAllowed(address, root) ? full : 'none';
    }
  );
  return replaceCssImageFunctionAddresses(rewriteCssImport(urls, root), (address) => {
    return !pictureAllowed(cssAddress(address), root);
  });
}

function declaresLoadedFile(value: string): boolean {
  return /url\s*\(|image-set\s*\(|@import|(?:^|[^\w-])image\s*\(|(?:^|[^\w-])src\s*\(/i.test(value);
}

function rewriteStyleAttribute(tag: string, root: string | null): string {
  const value = tagAttribute(tag, 'style');
  if (value === null || !declaresLoadedFile(value)) {
    return tag;
  }
  const rewritten = rewriteCssUrls(value, root);
  return rewritten === value ? tag : replaceAttribute(tag, 'style', rewritten);
}

function rewriteResourceTag(tag: string, root: string | null): string {
  const name = elementName(tag);
  if (name === 'img') {
    const image = htmlImage(tag);
    if (image && !pictureAllowed(image.src, root)) {
      return image.alt;
    }
  }
  if (!RESOURCE_TAGS.has(name) && !HREF_TAGS.has(name)) {
    return rewriteStyleAttribute(tag, root);
  }
  let next = tag;
  for (const attr of resourceAttributes(name)) {
    const value = tagAttribute(next, attr);
    if (value === null) {
      continue;
    }
    if (attr === 'srcset' || attr === 'imagesrcset') {
      const kept = keptSrcset(value, root);
      if (kept.length === 0) {
        next = dropAttribute(next, attr);
      } else if (kept !== value) {
        next = replaceAttribute(next, attr, kept);
      }
      continue;
    }
    if (!pictureAllowed(value, root)) {
      next = dropAttribute(next, attr);
    }
  }
  return rewriteStyleAttribute(next, root);
}

function rewriteHtmlImages(line: string, root: string | null, style: { open: boolean }): string {
  let result = '';
  let index = 0;
  while (index < line.length) {
    if (style.open) {
      const close = /<\/style\s*>/i.exec(line.slice(index));
      if (!close) {
        result += rewriteCssUrls(line.slice(index), root);
        return result;
      }
      result += rewriteCssUrls(line.slice(index, index + close.index), root);
      index += close.index;
      style.open = false;
      continue;
    }
    if (line[index] !== '<') {
      result += line[index] ?? '';
      index += 1;
      continue;
    }
    const end = htmlTagEnd(line, index);
    if (end === -1) {
      result += line.slice(index);
      break;
    }
    const tag = line.slice(index, end);
    result += rewriteResourceTag(tag, root);
    if (/^<\s*style\b/i.test(tag) && !/^<\s*\//.test(tag)) {
      style.open = true;
    }
    index = end;
  }
  return result;
}

function rewriteLine(line: string, root: string | null): string {
  const images = line.replace(IMAGE, (full, alt: string, destination: string) => {
    const address = linkDestination(decodeHtmlEntities(destination));
    return pictureAllowed(address, root) ? full : alt;
  });
  return images.replace(LINK, (full, label: string, destination: string) => {
    const address = linkDestination(decodeHtmlEntities(destination));
    return safeLinkAddress(address) === null ? label : full;
  });
}

/** Drop local-file targets outside fenced code. */
export function omitLocalMarkdownTargets(
  content: string,
  sourcePath?: string | null
): string {
  const root = sourcePath ? path.dirname(path.resolve(sourcePath)) : null;
  let fence: string | null = null;
  const style = { open: false };
  return content
    .split('\n')
    .map((line) => {
      const next = advanceFence(line, fence);
      const boundary = fence !== next;
      fence = next;
      if (fence || boundary) {
        return line;
      }
      const source = style.open ? line : rewriteLine(line, root);
      return rewriteHtmlImages(source, root, style);
    })
    .join('\n');
}
