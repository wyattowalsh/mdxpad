/**
 * Path a save should update.
 * A regular file keeps its path. A link saves the real file so the link stays a link.
 */

import { lstat, realpath } from 'node:fs/promises';

export async function writableDocumentPath(filePath: string): Promise<string> {
  try {
    const info = await lstat(filePath);
    if (!info.isSymbolicLink()) {
      return filePath;
    }
    return await realpath(filePath);
  } catch {
    return filePath;
  }
}
