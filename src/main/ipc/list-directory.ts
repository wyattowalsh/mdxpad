/**
 * Lists document files in a folder the user already opened.
 */

import { readdir } from 'node:fs/promises';
import * as path from 'node:path';

import {
  FileListDirectoryResponseSchema,
  type FileListDirectoryResponse,
} from '@shared/contracts/file-schemas';

import { trustedDirectoryError } from './trusted-directory';

const DOCUMENT_EXTENSIONS = new Set(['.md', '.mdx', '.markdown', '.txt']);
const MAX_LISTED_FILES = 200;

export async function listTrustedDirectory(directory: string): Promise<FileListDirectoryResponse> {
  const scopeError = trustedDirectoryError(directory);
  if (scopeError !== null) {
    return FileListDirectoryResponseSchema.parse({ ok: false, files: [], error: scopeError });
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => {
      if (!entry.isFile() || entry.name.startsWith('.')) {
        return false;
      }
      return DOCUMENT_EXTENSIONS.has(path.extname(entry.name).toLowerCase());
    })
    .map((entry) => ({
      name: entry.name,
      path: path.join(directory, entry.name),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, MAX_LISTED_FILES);

  return FileListDirectoryResponseSchema.parse({ ok: true, files });
}
