import { mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  assertOpenedDocumentWrite,
  assertSnapshotId,
  sameOpenedFile,
  snapshotFile,
} from '../version-history-path';

describe('version history path guards', () => {
  it('accepts snapshot and git ids and rejects traversal', () => {
    expect(assertSnapshotId('snapshot-1710000000000-abcd1234').kind).toBe('snapshot');
    expect(assertSnapshotId('git-abcdef1').gitHash).toBe('abcdef1');
    expect(() => assertSnapshotId('../secret')).toThrow('Version not found');
    expect(() => assertSnapshotId('snapshot-1-zzzzzzzz')).toThrow('Version not found');
  });

  it('keeps snapshot files inside the history directory', () => {
    const file = snapshotFile('/tmp/history', 'snapshot-1710000000000-abcd1234');
    expect(file.endsWith('/snapshot-1710000000000-abcd1234.json')).toBe(true);
  });

  it('refuses a write when the path was not opened', async () => {
    await expect(assertOpenedDocumentWrite('/tmp/other.md', () => false)).rejects.toThrow(
      'Version history can only write the opened document'
    );
  });

  it('accepts a symlink to a file the user opened', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-history-link-'));
    try {
      const realFile = path.join(dir, 'note.md');
      const link = path.join(dir, 'alias.md');
      await writeFile(realFile, '# note');
      await symlink(realFile, link);
      const real = await realpath(link);

      const opened = await assertOpenedDocumentWrite(link, (candidate) => candidate === real);

      expect(opened).toBe(real);
      expect(sameOpenedFile(link, realFile)).toBe(true);
      expect(sameOpenedFile(link, path.join(dir, 'other.md'))).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
