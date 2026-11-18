import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { computeChecksum } from '@shared/lib/checksum';
import type { FileId } from '@shared/types/file';

let tempDir = '';

vi.mock('electron', () => ({
  app: {
    getPath: () => tempDir,
  },
}));

import { AutoSaveManager, readVerifiedAutosave } from '../auto-save';

describe('autosave links', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('does not recover the text behind a linked autosave', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-autosave-link-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-autosave-secret-'));
    tempDirs.push(root, outside);
    tempDir = root;
    const secret = path.join(outside, 'secret.mdx');
    const link = path.join(root, 'mdxpad-autosave-abc123.mdx');
    await writeFile(secret, 'hidden');
    await writeFile(`${link}.sha256`, computeChecksum('hidden'));
    await symlink(secret, link);

    await expect(readVerifiedAutosave(link)).resolves.toBeNull();
    expect(await readFile(secret, 'utf-8')).toBe('hidden');
  });

  it('replaces a linked autosave instead of writing its target', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-autosave-write-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-autosave-target-'));
    tempDirs.push(root, outside);
    tempDir = root;
    const secret = path.join(outside, 'secret.mdx');
    const link = path.join(root, 'mdxpad-autosave-draft.mdx');
    await writeFile(secret, 'hidden');
    await symlink(secret, link);
    const manager = new AutoSaveManager();
    manager.registerDirty('draft' as FileId, null, 'Draft', 'local draft');

    await manager.saveDirty();

    expect(await readFile(secret, 'utf-8')).toBe('hidden');
    expect((await lstat(link)).isSymbolicLink()).toBe(false);
    expect(await readFile(link, 'utf-8')).toBe('local draft');
  });
});
