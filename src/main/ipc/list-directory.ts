/**
 * Lists documents and folders in a directory the user already opened.
 */

import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import * as path from 'node:path';

import {
  FileListDirectoryRequestSchema,
  FileListDirectoryResponseSchema,
  type FileListDirectoryResponse,
  type FileListEntry,
} from '@shared/contracts/file-schemas';

import { trustedDirectoryError } from './trusted-directory';

const DOCUMENT_EXTENSIONS = new Set(['.md', '.mdx', '.markdown', '.txt']);
const MAX_LISTED_FILES = 200;

function listEntry(directory: string, entry: Dirent): FileListEntry | null {
  if (entry.name.startsWith('.') || entry.isSymbolicLink()) {
    return null;
  }
  const entryPath = path.join(directory, entry.name);
  if (entry.isDirectory()) {
    return { name: entry.name, path: entryPath, kind: 'directory' };
  }
  if (!entry.isFile() || !DOCUMENT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
    return null;
  }
  return { name: entry.name, path: entryPath, kind: 'file' };
}

function byExplorerOrder(left: FileListEntry, right: FileListEntry): number {
  const leftRank = left.kind === 'directory' ? 0 : 1;
  const rightRank = right.kind === 'directory' ? 0 : 1;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  return left.name.localeCompare(right.name);
}

export function listDirectoryRequest(args: unknown): Promise<FileListDirectoryResponse> {
  const parsed = FileListDirectoryRequestSchema.safeParse(args);
  if (!parsed.success) {
    return Promise.resolve(
      FileListDirectoryResponseSchema.parse({
        ok: false,
        files: [],
        error: 'Choose a folder before listing it',
      })
    );
  }
  return listTrustedDirectory(parsed.data.directory);
}

export async function listTrustedDirectory(directory: string): Promise<FileListDirectoryResponse> {
  const scopeError = trustedDirectoryError(directory);
  if (scopeError !== null) {
    return FileListDirectoryResponseSchema.parse({ ok: false, files: [], error: scopeError });
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .map((entry) => listEntry(directory, entry))
    .filter((entry): entry is FileListEntry => entry !== null)
    .sort(byExplorerOrder)
    .slice(0, MAX_LISTED_FILES);

  return FileListDirectoryResponseSchema.parse({ ok: true, files });
}
