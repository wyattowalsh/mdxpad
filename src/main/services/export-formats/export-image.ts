import { constants as fsConstants } from 'node:fs';
import { lstat, mkdir, open, realpath } from 'node:fs/promises';
import path from 'node:path';

import { readStaysInsideDirectory } from '@main/ipc/read-scope';

import { advanceFence } from './markdown-fence';
import { linkDestination, linkTitle } from './markdown-link';
import { expandImageReferences } from './markdown-reference';

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

export type ImageInlineMode = 'data-url' | 'absolute' | 'document' | 'resource';

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

function localDestination(destination: string): string | null {
  const address = linkDestination(destination);
  if (isRemote(address) || address.length === 0 || address.startsWith('//')) {
    return null;
  }
  try {
    return decodeURI(address);
  } catch {
    return address;
  }
}

function localPath(directory: string, destination: string): string | null {
  const raw = localDestination(destination);
  if (raw === null) {
    return null;
  }
  const resolved = path.resolve(directory, raw);
  return readStaysInsideDirectory(resolved, directory) ? resolved : null;
}

async function readRegularFile(filePath: string): Promise<Buffer | null> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const data = await handle.readFile();
    return data.byteLength > MAX_IMAGE_BYTES ? null : data;
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

async function readInside(directory: string, destination: string): Promise<Buffer | null> {
  const resolved = localPath(directory, destination);
  if (!resolved) {
    return null;
  }
  return readRegularFile(resolved);
}

function markdownAddress(pathValue: string): string {
  return /[\s()]/.test(pathValue) ? `<${pathValue.replaceAll('>', '%3E')}>` : pathValue;
}

function withTitle(destination: string, source: string): string {
  const title = linkTitle(destination);
  const address = markdownAddress(source);
  if (!title) {
    return address;
  }
  return `${address} "${title.replaceAll('"', '\\"')}"`;
}

function dataUrlMime(extension: string, mode: ImageInlineMode): string | null {
  if (mode === 'absolute' || mode === 'resource') {
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
  if (mode === 'absolute' || mode === 'resource') {
    if (mode === 'absolute' && !imageKind(extension)) {
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
    for (const match of line.matchAll(/<img\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)')/gi)) {
      const destination = match[1] ?? match[2];
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
      const images = line.replace(IMAGE, (full, alt: string, destination: string) => {
        const replacement = replacements.get(destination);
        return replacement ? `![${alt}](${replacement})` : full;
      });
      return images.replace(
        /<img\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)')/gi,
        (full, doubleQuoted: string | undefined, singleQuoted: string | undefined) => {
          const destination = doubleQuoted ?? singleQuoted ?? '';
          const replacement = replacements.get(destination);
          return replacement ? full.replace(destination, replacement) : full;
        }
      );
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
  const expanded = expandImageReferences(content);
  const directory = path.dirname(sourcePath);
  const replacements = new Map<string, string>();
  for (const destination of new Set(destinationsOutsideFences(expanded))) {
    const next = await replacementFor(directory, destination, mode);
    if (next) {
      replacements.set(destination, next);
    }
  }
  return replacements.size === 0 ? content : replaceOutsideFences(expanded, replacements);
}

function publishedTarget(outputDir: string, sourceDir: string, filePath: string): string | null {
  const relative = path.relative(sourceDir, filePath);
  if (
    relative.length === 0 ||
    relative === '.' ||
    relative.startsWith('..') ||
    path.isAbsolute(relative)
  ) {
    return null;
  }
  const target = path.resolve(outputDir, relative);
  const fromRoot = path.relative(path.resolve(outputDir), target);
  if (fromRoot.length === 0 || fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) {
    return null;
  }
  return target;
}

async function destinationInsideOutput(outputDir: string, target: string): Promise<boolean> {
  const realOutput = await realpath(outputDir);
  const relative = path.relative(path.resolve(outputDir), target);
  if (relative.length === 0 || relative.startsWith('..') || path.isAbsolute(relative)) {
    return false;
  }
  let current = realOutput;
  for (const segment of relative.split(path.sep)) {
    if (segment.length === 0 || segment === '.' || segment === '..') {
      return false;
    }
    const next = path.join(current, segment);
    try {
      const info = await lstat(next);
      if (info.isSymbolicLink()) {
        return false;
      }
    } catch {
      return true;
    }
    current = next;
  }
  return true;
}

async function writePublishedFile(target: string, data: Buffer): Promise<void> {
  const handle = await open(
    target,
    fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_TRUNC | fsConstants.O_NOFOLLOW,
    0o600
  );
  try {
    await handle.writeFile(data);
  } finally {
    await handle.close();
  }
}

async function copyOnePublishedImage(
  resolved: string,
  outputDir: string,
  sourceDir: string
): Promise<void> {
  const target = publishedTarget(outputDir, sourceDir, resolved);
  if (!target || !(await destinationInsideOutput(outputDir, target))) {
    return;
  }
  const data = await readRegularFile(resolved);
  if (!data) {
    return;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writePublishedFile(target, data);
}

/** Copy local images next to a published page. Paths outside the source folder stay put. */
export async function copyPublishedImages(
  content: string,
  sourcePath: string,
  outputDir: string
): Promise<void> {
  const sourceDir = path.dirname(sourcePath);
  const seen = new Set<string>();
  for (const destination of destinationsOutsideFences(expandImageReferences(content))) {
    const resolved = localPath(sourceDir, destination);
    if (!resolved || seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    await copyOnePublishedImage(resolved, outputDir, sourceDir).catch(() => undefined);
  }
}
