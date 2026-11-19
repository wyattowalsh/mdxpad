/**
 * Remove markdown pictures and links that point at a local file.
 * A picture inside the source folder can keep its absolute path.
 */

import path from 'node:path';

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
  const match = new RegExp(`\\b${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, 'i').exec(tag);
  return match?.[1] ? decodeHtmlEntities(attributeValue(match[1])) : null;
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

function rewriteHtmlImages(line: string, root: string | null): string {
  let result = '';
  let index = 0;
  while (index < line.length) {
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
    const image = htmlImage(tag);
    result += image && !pictureAllowed(image.src, root) ? image.alt : tag;
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
  return content
    .split('\n')
    .map((line) => {
      const next = advanceFence(line, fence);
      const boundary = fence !== next;
      fence = next;
      return fence || boundary ? line : rewriteHtmlImages(rewriteLine(line, root), root);
    })
    .join('\n');
}
