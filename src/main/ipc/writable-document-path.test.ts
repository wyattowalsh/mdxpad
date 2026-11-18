import { lstat, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { writableDocumentPath } from './writable-document-path';

describe('writableDocumentPath', () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
    );
  });

  async function tempDir(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-write-'));
    directories.push(dir);
    return dir;
  }

  it('keeps a regular file path', async () => {
    const dir = await tempDir();
    const filePath = path.join(dir, 'note.md');
    await writeFile(filePath, 'hello');

    await expect(writableDocumentPath(filePath)).resolves.toBe(filePath);
  });

  it('saves a link as the real file', async () => {
    const dir = await tempDir();
    const realFile = path.join(dir, 'real.md');
    const link = path.join(dir, 'link.md');
    await writeFile(realFile, 'document');
    await symlink(realFile, link);

    await expect(writableDocumentPath(link)).resolves.toBe(realFile);
    expect((await lstat(link)).isSymbolicLink()).toBe(true);
  });

  it('keeps a path that does not exist yet', async () => {
    const dir = await tempDir();
    const missing = path.join(dir, 'new.md');

    await expect(writableDocumentPath(missing)).resolves.toBe(missing);
  });
});
