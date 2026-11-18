import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { grantReadCapability } from '@main/ipc/document-capability';

import {
  directoryWasChosen,
  publishableFiles,
  publishScopeError,
  rememberChosenDirectory,
  resetChosenDirectories,
} from './publish-scope';

describe('publish scope', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    resetChosenDirectories();
    const { rm } = await import('node:fs/promises');
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('rejects an output folder the user did not choose', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-publish-'));
    tempDirs.push(root);
    const source = path.join(root, 'note.md');
    await writeFile(source, '# Note');
    grantReadCapability(source);

    const error = publishScopeError({
      files: [{ path: source, title: 'Note' }],
      outputDir: root,
      includeStyles: false,
      includeHighlighting: false,
      generateIndex: false,
    });

    expect(error).toBe('Choose an output folder before publishing');
  });

  it('allows an opened file inside a chosen folder', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-publish-'));
    tempDirs.push(root);
    const source = path.join(root, 'note.md');
    const output = path.join(root, 'out');
    await writeFile(source, '# Note');
    await mkdir(output);
    grantReadCapability(source);
    rememberChosenDirectory(output);

    expect(directoryWasChosen(output)).toBe(true);
    expect(
      publishScopeError({
        files: [{ path: source, title: 'Note' }],
        outputDir: output,
        includeStyles: false,
        includeHighlighting: false,
        generateIndex: false,
      })
    ).toBeNull();
  });

  it('rejects a source file the user has not opened', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-publish-'));
    tempDirs.push(root);
    const output = path.join(root, 'out');
    await mkdir(output);
    rememberChosenDirectory(output);
    const secret = path.join(root, 'secret.md');
    await writeFile(secret, 'hidden');

    expect(
      publishScopeError({
        files: [{ path: secret, title: 'Secret' }],
        outputDir: output,
        includeStyles: false,
        includeHighlighting: false,
        generateIndex: false,
      })
    ).toContain('not an opened file');
  });

  it('allows editor text for a file that has not been opened', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-publish-'));
    tempDirs.push(root);
    const output = path.join(root, 'out');
    await mkdir(output);
    rememberChosenDirectory(output);

    expect(
      publishScopeError({
        files: [{ path: '/tmp/not-opened.md', title: 'Draft', content: '# Draft' }],
        outputDir: output,
        includeStyles: false,
        includeHighlighting: false,
        generateIndex: false,
      })
    ).toBeNull();
    expect(publishableFiles([{ path: '/tmp/not-opened.md', content: '# Draft' }])).toEqual([
      { path: 'not-opened.md', content: '# Draft' },
    ]);
  });
});
