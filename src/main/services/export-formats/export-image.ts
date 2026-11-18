import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { readStaysInsideDirectory } from '@main/ipc/read-scope';

import { advanceFence } from './markdown-fence';
import { linkDestination } from './markdown-link';

const IMAGE = /!\[([^\]]*)\]\(((?:[^()]|\([^()]*\))+)\)/g;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
};

const DOCUMENT_MIME_BY_EXTENSION: Record<string, string> = {
  ...MIME_BY_EXTENSION,
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

export type ImageInlineMode = 'data-url' | 'absolute' | 'document';

export type ImageKind = 'png' | 'jpg' | 'gif' | 'bmp';

function imageKind(extension: string): ImageKind | null {
  if (extension === '.png') return 'png';
  if (extension === '.jpg' || extension === '.jpeg') return 'jpg';
  if (extension === '.gif') return 'gif';
  if (extension === '.bmp') return 'bmp';
  return null;
}

function isRemote(destination: string): boolean {
  return /^(?:https?:|data:|mailto:)/i.test(destination.trim());
}

/** Pixel size for a PNG, or a readable fallback for other image kinds. */
export function imagePixels(data: Buffer, kind: ImageKind): { width: number; height: number } {
  if (kind === 'png' && data.length >= 24) {
    const width = data.readUInt32BE(16);
    const height = data.readUInt32BE(20);
    if (width > 0 && height > 0 && width <= 8000 && height <= 8000) {
      return { width, height };
    }
  }
  return { width: 480, height: 320 };
}

function localPath(directory: string, destination: string): string | null {
  const raw = linkDestination(destination);
  if (isRemote(raw) || raw.length === 0) {
    return null;
  }
  const resolved = path.resolve(directory, raw);
  return readStaysInsideDirectory(resolved, directory) ? resolved : null;
}

async function readInside(directory: string, destination: string): Promise<Buffer | null> {
  const resolved = localPath(directory, destination);
  if (!resolved) {
    return null;
  }
  try {
    const data = await readFile(resolved);
    return data.byteLength > MAX_IMAGE_BYTES ? null : data;
  } catch {
    return null;
  }
}

function withTitle(destination: string, source: string): string {
  const titled = /^(\S+)(\s+\S[\s\S]*)?$/.exec(destination.trim());
  return `${source}${titled?.[2] ?? ''}`;
}

function dataUrlMime(extension: string, mode: ImageInlineMode): string | null {
  if (mode === 'absolute') {
    return null;
  }
  const table = mode === 'document' ? DOCUMENT_MIME_BY_EXTENSION : MIME_BY_EXTENSION;
  return table[extension] ?? null;
}

async function replacementFor(
  directory: string,
  destination: string,
  mode: ImageInlineMode
): Promise<string | null> {
  const resolved = localPath(directory, destination);
  if (!resolved) {
    return null;
  }
  const extension = path.extname(resolved).toLowerCase();
  if (mode === 'absolute') {
    if (!imageKind(extension)) {
      return null;
    }
    const data = await readInside(directory, destination);
    return data ? withTitle(destination, resolved.split(path.sep).join('/')) : null;
  }
  const mime = dataUrlMime(extension, mode);
  const data = mime ? await readInside(directory, destination) : null;
  if (!data || !mime) {
    return null;
  }
  return withTitle(destination, `data:${mime};base64,${data.toString('base64')}`);
}

function destinationsOutsideFences(content: string): string[] {
  const found: string[] = [];
  let fence: string | null = null;
  for (const line of content.split('\n')) {
    const next = advanceFence(line, fence);
    const boundary = fence !== next;
    fence = next;
    if (fence || boundary) {
      continue;
    }
    for (const match of line.matchAll(IMAGE)) {
      const destination = match[2];
      if (destination) {
        found.push(destination);
      }
    }
  }
  return found;
}

function replaceOutsideFences(content: string, replacements: ReadonlyMap<string, string>): string {
  let fence: string | null = null;
  return content
    .split('\n')
    .map((line) => {
      const next = advanceFence(line, fence);
      const boundary = fence !== next;
      fence = next;
      if (fence || boundary) {
        return line;
      }
      return line.replace(IMAGE, (full, alt: string, destination: string) => {
        const replacement = replacements.get(destination);
        return replacement ? `![${alt}](${replacement})` : full;
      });
    })
    .join('\n');
}

/** Rewrite local images beside the source file. Paths outside that folder stay unchanged. */
export async function inlineLocalImages(
  content: string,
  sourcePath: string | null | undefined,
  mode: ImageInlineMode
): Promise<string> {
  if (!sourcePath) {
    return content;
  }
  const directory = path.dirname(sourcePath);
  const replacements = new Map<string, string>();
  for (const destination of new Set(destinationsOutsideFences(content))) {
    const next = await replacementFor(directory, destination, mode);
    if (next) {
      replacements.set(destination, next);
    }
  }
  return replacements.size === 0 ? content : replaceOutsideFences(content, replacements);
}
