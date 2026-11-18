import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { grantReadCapability, resetFileCapabilities } from './document-capability';
import { listTrustedDirectory } from './list-directory';

describe('listTrustedDirectory', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    resetFileCapabilities();
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('lists documents in the opened file folder', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-list-dir-'));
    dirs.push(root);
    await writeFile(path.join(root, 'b.mdx'), '# b');
    await writeFile(path.join(root, 'a.md'), '# a');
    await writeFile(path.join(root, '.hidden.md'), 'hidden');
    await writeFile(path.join(root, 'script.js'), 'nope');
    await mkdir(path.join(root, 'nested'));
    grantReadCapability(path.join(root, 'b.mdx'));

    const result = await listTrustedDirectory(root);

    expect(result.ok).toBe(true);
    expect(result.files).toEqual([
      { name: 'nested', path: path.join(root, 'nested'), kind: 'directory' },
      { name: 'a.md', path: path.join(root, 'a.md'), kind: 'file' },
      { name: 'b.mdx', path: path.join(root, 'b.mdx'), kind: 'file' },
    ]);
  });

  it('does not follow a linked folder out of the opened directory', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-list-link-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-list-outside-'));
    dirs.push(root, outside);
    await writeFile(path.join(outside, 'secret.md'), 'hidden');
    await symlink(outside, path.join(root, 'linked'));
    grantReadCapability(path.join(root, 'note.md'));
    await writeFile(path.join(root, 'note.md'), '# note');

    const result = await listTrustedDirectory(root);

    expect(result.ok).toBe(true);
    expect(result.files.map((file) => file.name)).toEqual(['note.md']);
  });

  it('does not list a folder the user has not opened', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-list-closed-'));
    dirs.push(root);
    await writeFile(path.join(root, 'secret.md'), 'hidden');

    const result = await listTrustedDirectory(root);

    expect(result.ok).toBe(false);
    expect(result.files).toEqual([]);
    expect(result.error).toContain('open a file');
  });
});
