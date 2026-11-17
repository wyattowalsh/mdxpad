import { describe, expect, it } from 'vitest';

import { assertOpenedDocumentWrite, assertSnapshotId, snapshotFile } from '../version-history-path';

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
});
