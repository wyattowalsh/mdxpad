import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { readStaysInsideDirectory } from './read-scope';

describe('readStaysInsideDirectory', () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it('allows a real file and rejects a symlink that leaves the directory', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'mdxpad-read-'));
    roots.push(root);
    const opened = path.join(root, 'opened');
    const outside = path.join(root, 'outside');
    await mkdir(opened);
    await mkdir(outside);
    const note = path.join(opened, 'note.md');
    const secret = path.join(outside, 'secret.md');
    await writeFile(note, 'note');
    await writeFile(secret, 'secret');
    const link = path.join(opened, 'link.md');
    await symlink(secret, link);

    expect(readStaysInsideDirectory(note, opened)).toBe(true);
    expect(readStaysInsideDirectory(path.join(opened, 'missing.md'), opened)).toBe(true);
    expect(readStaysInsideDirectory(link, opened)).toBe(false);
  });
});
