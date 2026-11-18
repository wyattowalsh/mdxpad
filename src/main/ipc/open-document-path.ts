/**
 * Path chosen by the Open dialog.
 * A regular file keeps its path. A link opens the real file so the later
 * no-follow read loads that document.
 */

import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

import { readFileWithoutFollowingLinks } from '@main/services/file-service';
import type { FileResult } from '@shared/types/file';

async function canonicalPath(filePath: string): Promise<string | null> {
  try {
    return await realpath(filePath);
  } catch {
    return null;
  }
}

async function isSymbolicLink(filePath: string): Promise<boolean> {
  try {
    return (await lstat(filePath)).isSymbolicLink();
  } catch {
    return false;
  }
}

export async function openableDocumentPath(filePath: string): Promise<FileResult<string>> {
  const direct = await readFileWithoutFollowingLinks(filePath);
  if (direct.ok) {
    return { ok: true, value: filePath };
  }
  if (direct.error.code !== 'PERMISSION_DENIED') {
    return direct;
  }

  const canonical = await canonicalPath(filePath);
  if (canonical !== null && canonical !== path.resolve(filePath)) {
    const target = await readFileWithoutFollowingLinks(canonical);
    if (!target.ok) {
      return target;
    }
    return { ok: true, value: canonical };
  }

  if (await isSymbolicLink(filePath)) {
    return { ok: false, error: { code: 'NOT_FOUND', path: filePath } };
  }
  return direct;
}
