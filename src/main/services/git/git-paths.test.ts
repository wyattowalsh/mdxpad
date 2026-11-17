import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { pathsInsideDirectory } from './git-paths';

describe('pathsInsideDirectory', () => {
  const root = path.join(os.tmpdir(), 'mdxpad-git-paths');
  const outside = path.join(os.tmpdir(), 'mdxpad-git-paths-outside');

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it('keeps a new file in the opened folder and rejects a path that leaves it', () => {
    mkdirSync(root, { recursive: true });

    expect(pathsInsideDirectory(root, ['note.md', 'docs/draft.md'])).toEqual([
      'note.md',
      'docs/draft.md',
    ]);
    expect(pathsInsideDirectory(root, ['../secret.md'])).toBeNull();
    expect(pathsInsideDirectory(root, ['/etc/passwd'])).toBeNull();
  });

  it('rejects a symlink that points outside the opened folder', () => {
    mkdirSync(root, { recursive: true });
    mkdirSync(outside, { recursive: true });
    writeFileSync(path.join(outside, 'secret.md'), 'secret');
    symlinkSync(path.join(outside, 'secret.md'), path.join(root, 'linked.md'));

    expect(pathsInsideDirectory(root, ['linked.md'])).toBeNull();
  });
});
