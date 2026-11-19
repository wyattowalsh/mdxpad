import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { WorkspacePathError } from './agent-path';
import { collectMatchingFiles, readAgentFile, readWorkspaceFile } from './directory-entries';

describe('directory entries', () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function tempDir(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-dir-'));
    directories.push(dir);
    return dir;
  }

  it('does not search through a symlink directory', async () => {
    const root = await tempDir();
    const outside = await tempDir();
    await writeFile(path.join(root, 'note.md'), 'hello');
    await writeFile(path.join(outside, 'secret.md'), 'hidden');
    await symlink(outside, path.join(root, 'linked'));

    const matches = await collectMatchingFiles(root, 'secret');

    expect(matches).toEqual([]);
    await expect(collectMatchingFiles(root, 'note')).resolves.toEqual([path.join(root, 'note.md')]);
  });

  it('does not read a file that is a symlink', async () => {
    const root = await tempDir();
    const outside = await tempDir();
    const secret = path.join(outside, 'secret.md');
    await mkdir(path.join(root, 'docs'));
    await writeFile(secret, 'hidden');
    await symlink(secret, path.join(root, 'docs', 'note.md'));

    await expect(readWorkspaceFile(root, 'docs/note.md')).rejects.toThrow(WorkspacePathError);
  });

  it('returns the open editor text for that file and disk text for another', async () => {
    const root = await tempDir();
    const note = path.join(root, 'note.md');
    await writeFile(note, 'disk');
    await writeFile(path.join(root, 'other.md'), 'other');
    const other = path.join(root, 'other.md');
    const openFiles = [
      { path: note, content: 'typed!' },
      { path: other, content: 'other draft' },
    ];

    await expect(readAgentFile(root, 'note.md', openFiles)).resolves.toBe('typed!');
    await expect(readAgentFile(root, note, openFiles)).resolves.toBe('typed!');
    await expect(readAgentFile(root, 'other.md', openFiles)).resolves.toBe('other draft');
    await writeFile(path.join(root, 'disk.md'), 'saved');
    await expect(readAgentFile(root, 'disk.md', openFiles)).resolves.toBe('saved');
  });
});
