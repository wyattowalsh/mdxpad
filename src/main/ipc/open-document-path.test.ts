import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readFileWithoutFollowingLinks } from '@main/services/file-service';

import { openableDocumentPath } from './open-document-path';

describe('openableDocumentPath', () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function tempDir(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-open-'));
    directories.push(dir);
    return dir;
  }

  it('keeps the path of a regular file', async () => {
    const dir = await tempDir();
    const filePath = path.join(dir, 'note.md');
    await writeFile(filePath, 'hello');

    await expect(openableDocumentPath(filePath)).resolves.toEqual({ ok: true, value: filePath });
  });

  it('opens the real file when the dialog path is a link', async () => {
    const dir = await tempDir();
    const realFile = path.join(dir, 'real.md');
    const link = path.join(dir, 'link.md');
    await writeFile(realFile, 'document');
    await symlink(realFile, link);

    await expect(openableDocumentPath(link)).resolves.toEqual({ ok: true, value: realFile });
    await expect(readFileWithoutFollowingLinks(realFile)).resolves.toEqual({
      ok: true,
      value: 'document',
    });
  });

  it('reports a missing file', async () => {
    const dir = await tempDir();
    const missing = path.join(dir, 'missing.md');

    await expect(openableDocumentPath(missing)).resolves.toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', path: missing },
    });
  });
});
