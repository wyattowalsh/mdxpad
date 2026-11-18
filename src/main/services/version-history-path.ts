import { constants as fsConstants, realpathSync } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import path from 'node:path';

import { readFileWithoutFollowingLinks } from '@main/services/file-service';

const OPENED_DOCUMENT_ERROR = 'Version history can only write the opened document';
const SNAPSHOT_ID = /^snapshot-\d+-[a-f0-9]{8}$/;
const GIT_ID = /^git-([a-f0-9]{7,40})$/;

function canonicalExistingPath(filePath: string): string {
  const resolved = path.resolve(filePath);
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

export function sameOpenedFile(left: string, right: string): boolean {
  return canonicalExistingPath(left) === canonicalExistingPath(right);
}

export function assertSnapshotId(id: string): { kind: 'snapshot' | 'git'; gitHash?: string } {
  if (SNAPSHOT_ID.test(id)) {
    return { kind: 'snapshot' };
  }

  const gitMatch = GIT_ID.exec(id);
  if (gitMatch?.[1]) {
    return { kind: 'git', gitHash: gitMatch[1] };
  }

  throw new Error('Version not found');
}

export async function assertOpenedDocumentWrite(
  filePath: string,
  canWrite: (normalizedPath: string) => boolean
): Promise<string> {
  if (filePath.length === 0 || filePath.includes('\0')) {
    throw new Error(OPENED_DOCUMENT_ERROR);
  }

  const resolved = path.resolve(filePath);
  let canonical = resolved;
  try {
    canonical = await realpath(resolved);
  } catch {
    canonical = resolved;
  }

  if (!canWrite(canonical)) {
    throw new Error(OPENED_DOCUMENT_ERROR);
  }

  return canonical;
}

function isLinkError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ELOOP';
}

export async function readOpenedDocument(filePath: string): Promise<string> {
  const read = await readFileWithoutFollowingLinks(filePath);
  if (!read.ok) {
    throw new Error(read.error.code === 'NOT_FOUND' ? 'File not found' : OPENED_DOCUMENT_ERROR);
  }
  return read.value;
}

export async function writeOpenedDocument(filePath: string, content: string): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(
      filePath,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_TRUNC | fsConstants.O_NOFOLLOW,
      0o644
    );
    await handle.writeFile(content, 'utf-8');
  } catch (error) {
    if (isLinkError(error)) {
      throw new Error(OPENED_DOCUMENT_ERROR);
    }
    throw error;
  } finally {
    await handle?.close();
  }
}

export function snapshotFile(historyDir: string, id: string): string {
  if (assertSnapshotId(id).kind !== 'snapshot') {
    throw new Error('Version not found');
  }

  const resolvedDir = path.resolve(historyDir);
  const file = path.resolve(resolvedDir, `${id}.json`);
  const relative = path.relative(resolvedDir, file);
  if (relative.length === 0 || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Version not found');
  }

  return file;
}
