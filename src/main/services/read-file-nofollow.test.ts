import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readFileWithoutFollowingLinks } from './file-service';

describe('readFileWithoutFollowingLinks', () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function tempDir(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-read-'));
    directories.push(dir);
    return dir;
  }

  it('reads a regular file', async () => {
    const dir = await tempDir();
    const filePath = path.join(dir, 'note.md');
    await writeFile(filePath, 'hello');

    await expect(readFileWithoutFollowingLinks(filePath)).resolves.toEqual({
      ok: true,
      value: 'hello',
    });
  });

  it('does not return the target of a symlink', async () => {
    const dir = await tempDir();
    const secret = path.join(dir, 'secret.txt');
    const link = path.join(dir, 'note.md');
    await writeFile(secret, 'secret');
    await symlink(secret, link);

    await expect(readFileWithoutFollowingLinks(link)).resolves.toEqual({
      ok: false,
      error: { code: 'PERMISSION_DENIED', path: link },
    });
  });
});
