import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { findIndexableFiles } from './embedding-service';

describe('findIndexableFiles', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('skips files under an excluded directory', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-embed-'));
    tempDirs.push(root);
    await writeFile(path.join(root, 'note.md'), '# note');
    await mkdir(path.join(root, 'dist'));
    await writeFile(path.join(root, 'dist', 'built.md'), '# built');

    const files = await findIndexableFiles(root, ['dist']);

    expect(files.map((file) => path.basename(file))).toEqual(['note.md']);
  });

  it('indexes a chosen folder that is a link and skips a link inside it', async () => {
    const holder = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-embed-link-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-embed-out-'));
    const target = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-embed-target-'));
    tempDirs.push(holder, outside, target);
    await writeFile(path.join(target, 'note.md'), '# note');
    await writeFile(path.join(outside, 'secret.md'), '# secret');
    await symlink(outside, path.join(target, 'linked'));
    const root = path.join(holder, 'project');
    await symlink(target, root);

    const files = await findIndexableFiles(root);

    expect(files.map((file) => path.basename(file))).toEqual(['note.md']);
  });
});
