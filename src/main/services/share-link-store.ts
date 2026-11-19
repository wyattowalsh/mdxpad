/**
 * Persist share links without following a link to another file.
 */

import { closeSync, constants, lstatSync, openSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { ensureRealDirectory } from './ensure-real-directory';

import type { ShareAccessMode, ShareLink } from '@shared/contracts/share-schemas';
import { atomicWrite } from '@shared/lib/atomic-write';

export interface ShareStoreData {
  readonly links: ShareLink[];
  readonly contents: Readonly<Record<string, string>>;
}

const EMPTY_STORE: ShareStoreData = { links: [], contents: {} };

function isAccessMode(value: unknown): value is ShareAccessMode {
  return value === 'read-only' || value === 'read-write';
}

function isShareLink(value: unknown): value is ShareLink {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.token === 'string' &&
    typeof record.docId === 'string' &&
    typeof record.url === 'string' &&
    isAccessMode(record.accessMode) &&
    typeof record.createdAt === 'number' &&
    (record.expiresAt === null || typeof record.expiresAt === 'number') &&
    typeof record.isActive === 'boolean'
  );
}

function parseShareStore(raw: string): ShareStoreData {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return EMPTY_STORE;
    }
    const record = parsed as Record<string, unknown>;
    const links = Array.isArray(record.links) ? record.links.filter(isShareLink) : [];
    const contents: Record<string, string> = {};
    if (typeof record.contents === 'object' && record.contents !== null) {
      for (const [id, value] of Object.entries(record.contents)) {
        if (typeof value === 'string') {
          contents[id] = value;
        }
      }
    }
    return { links, contents };
  } catch {
    return EMPTY_STORE;
  }
}

function readLocalText(filePath: string): string | null {
  try {
    const info = lstatSync(filePath);
    if (info.isSymbolicLink() || !info.isFile()) {
      return null;
    }
    const handle = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      return readFileSync(handle, 'utf8');
    } finally {
      closeSync(handle);
    }
  } catch {
    return null;
  }
}

export function readShareStore(filePath: string): ShareStoreData {
  const raw = readLocalText(filePath);
  return raw === null ? EMPTY_STORE : parseShareStore(raw);
}

export async function writeShareStore(filePath: string, data: ShareStoreData): Promise<void> {
  await ensureRealDirectory(path.dirname(filePath));
  await atomicWrite(filePath, JSON.stringify(data));
}
