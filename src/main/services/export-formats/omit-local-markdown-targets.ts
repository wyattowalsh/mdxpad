/**
 * Remove markdown pictures and links that point at a local file.
 * A picture inside the source folder can keep its absolute path.
 */

import path from 'node:path';

import { decodeHtmlEntities } from './markdown-entity';
import { advanceFence } from './markdown-fence';
import { linkDestination } from './markdown-link';
import { safeImageAddress, safeLinkAddress } from './markdown-export-address';

const IMAGE = /!\[([^\]]*)\]\(((?:[^()]|\([^()]*\))+)\)/g;
const LINK = /(?<!!)\[([^\]]*)\]\(((?:[^()]|\([^()]*\))+)\)/g;

function insideRoot(root: string, address: string): boolean {
  if (!address.startsWith('/') || address.startsWith('//')) {
    return false;
  }
  const relative = path.relative(root, address);
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function pictureAllowed(address: string, root: string | null): boolean {
  if (safeImageAddress(address) !== null) {
    return true;
  }
  return root !== null && insideRoot(root, address);
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
      return fence || boundary ? line : rewriteLine(line, root);
    })
    .join('\n');
}
