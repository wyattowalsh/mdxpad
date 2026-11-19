/**
 * Remove markdown pictures and links that point at a local file.
 * A picture inside the source folder can keep its absolute path.
 */

import path from 'node:path';

import { resolveWorkspaceFilePath } from '../ai/agent-path';

import { decodeHtmlEntities } from './markdown-entity';
import { advanceFence } from './markdown-fence';
import { linkDestination } from './markdown-link';
import { safeImageAddress, safeLinkAddress } from './markdown-export-address';

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
