import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { grantReadCapability, resetFileCapabilities } from './document-capability';
import { rememberChosenDirectory, resetChosenDirectories } from '@main/services/publish-scope';
import { trustedDirectoryError } from './trusted-directory';

describe('trustedDirectoryError', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    resetFileCapabilities();
    resetChosenDirectories();
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('allows the folder of an opened file and a folder chosen in the dialog', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-trusted-dir-'));
    dirs.push(root);
    const opened = path.join(root, 'opened');
    const chosen = path.join(root, 'chosen');
    const closed = path.join(root, 'closed');
    await mkdir(opened);
    await mkdir(chosen);
    await mkdir(closed);
    await writeFile(path.join(opened, 'note.md'), '# note');
    grantReadCapability(path.join(opened, 'note.md'));
    rememberChosenDirectory(chosen);

    expect(trustedDirectoryError(opened)).toBeNull();
    expect(trustedDirectoryError(path.join(opened, 'nested'))).toBeNull();
    expect(trustedDirectoryError(chosen)).toBeNull();
    expect(trustedDirectoryError(closed)).toContain('open a file');
  });
});
