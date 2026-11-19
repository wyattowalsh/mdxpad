/**
 * Pictures in an EPUB chapter.
 * The EPUB writer only embeds file: and http(s) images, and a failed fetch
 * cancels the book. Local pictures are written to temp files. A picture
 * that cannot be embedded becomes its alt text.
 */

import { randomBytes } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { decodeHtmlEntities } from './markdown-entity';
import { safeImageAddress } from './markdown-export-address';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TAG = /<img\b[^>]*?\/?>/gi;
const IMAGE_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
};

export interface EpubImageResult {
  readonly html: string;
  readonly warnings: readonly string[];
  readonly cleanup: () => Promise<void>;
}

function attribute(tag: string, name: string): string {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return decodeHtmlEntities(match?.[1] ?? match?.[2] ?? '');
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

async function writeTempImage(bytes: Buffer, extension: string): Promise<string> {
  const file = path.join(tmpdir(), `mdxpad-epub-${randomBytes(8).toString('hex')}.${extension}`);
  await writeFile(file, bytes);
  return pathToFileURL(file).href;
}

function dataImage(src: string): { readonly bytes: Buffer; readonly extension: string } | null {
  if (safeImageAddress(src) === null) {
    return null;
  }
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(src);
  const mime = match?.[1]?.toLowerCase();
  const payload = match?.[2];
  const extension = mime ? IMAGE_MIME[mime] : undefined;
  if (!extension || !payload) {
    return null;
  }
  const bytes = Buffer.from(payload, 'base64');
  return bytes.byteLength > 0 && bytes.byteLength <= MAX_IMAGE_BYTES ? { bytes, extension } : null;
}

async function remoteImage(src: string): Promise<{ readonly bytes: Buffer; readonly extension: string } | null> {
  if (!/^https?:\/\//i.test(src)) {
    return null;
  }
  try {
    const response = await fetch(src, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      return null;
    }
    const mime = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    const extension = IMAGE_MIME[mime];
    if (!extension) {
      return null;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
      return null;
    }
    if (extension === 'svg' && safeImageAddress(`data:image/svg+xml;base64,${bytes.toString('base64')}`) === null) {
      return null;
    }
    return { bytes, extension };
  } catch {
    return null;
  }
}

async function embeddedSrc(src: string): Promise<string | null> {
  const image = dataImage(src) ?? (await remoteImage(src));
  if (!image) {
    return null;
  }
  return writeTempImage(image.bytes, image.extension);
}

async function replaceImage(tag: string): Promise<{ readonly html: string; readonly file?: string; readonly warning?: string }> {
  const src = attribute(tag, 'src');
  const alt = escapeText(attribute(tag, 'alt'));
  const file = src.length > 0 ? await embeddedSrc(src) : null;
  if (file) {
    return { html: `<img src="${file}" alt="${alt}" />`, file };
  }
  return {
    html: alt,
    ...(src.length > 0 ? { warning: 'A picture could not be included in the EPUB' } : {}),
  };
}

export async function embedEpubImages(html: string): Promise<EpubImageResult> {
  const files: string[] = [];
  const warnings: string[] = [];
  let next = html;
  for (const match of html.matchAll(IMAGE_TAG)) {
    const tag = match[0];
    const replaced = await replaceImage(tag);
    next = next.replace(tag, () => replaced.html);
    if (replaced.file) {
      files.push(replaced.file);
    }
    if (replaced.warning) {
      warnings.push(replaced.warning);
    }
  }
  return {
    html: next,
    warnings,
    cleanup: async () => {
      await Promise.all(files.map(async (file) => unlink(file).catch(() => undefined)));
    },
  };
}
