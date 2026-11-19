import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ensureRealDirectory } from './ensure-real-directory';

describe('ensureRealDirectory', () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('replaces a linked directory and leaves the target untouched', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-real-dir-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-real-outside-'));
    directories.push(root, outside);
    const secret = path.join(outside, 'secret.txt');
    const link = path.join(root, 'recovery');
    await writeFile(secret, 'hidden');
    await symlink(outside, link);

    await ensureRealDirectory(link);
    await writeFile(path.join(link, 'note.json'), 'local');

    expect(await readFile(secret, 'utf8')).toBe('hidden');
    expect((await lstat(link)).isSymbolicLink()).toBe(false);
    expect((await lstat(link)).isDirectory()).toBe(true);
    expect(await readFile(path.join(link, 'note.json'), 'utf8')).toBe('local');
  });
});
