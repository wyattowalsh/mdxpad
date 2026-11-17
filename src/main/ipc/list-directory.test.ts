import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
    expect(result.files.map((file) => file.name)).toEqual(['a.md', 'b.mdx']);
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
