import { lstat, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  assertOpenedDocumentWrite,
  assertSnapshotId,
  readOpenedDocument,
  readSnapshotText,
  sameOpenedFile,
  snapshotFile,
  writeOpenedDocument,
  writeSnapshotFile,
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

  it('reads a regular snapshot and skips a link', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-history-snapshot-'));
    try {
      const snapshot = path.join(dir, 'snapshot.json');
      const secret = path.join(dir, 'secret.json');
      const link = path.join(dir, 'linked.json');
      await writeFile(snapshot, '{"content":"kept"}');
      await writeFile(secret, '{"content":"hidden"}');
      await symlink(secret, link);

      await expect(readSnapshotText(snapshot)).resolves.toBe('{"content":"kept"}');
      await expect(readSnapshotText(link)).rejects.toThrow('Version not found');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not write a snapshot through a link', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-history-snapshot-write-'));
    try {
      const target = path.join(dir, 'secret.json');
      const link = path.join(dir, 'snapshot.json');
      await writeFile(target, 'secret');
      await symlink(target, link);

      await writeSnapshotFile(link, '{"content":"local"}');

      await expect(readFile(target, 'utf-8')).resolves.toBe('secret');
      expect((await lstat(link)).isSymbolicLink()).toBe(false);
      await expect(readFile(link, 'utf-8')).resolves.toBe('{"content":"local"}');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('writes a regular opened document', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-history-write-'));
    try {
      const note = path.join(dir, 'note.md');
      await writeFile(note, 'old');

      await writeOpenedDocument(note, 'restored');

      await expect(readOpenedDocument(note)).resolves.toBe('restored');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not write a restore through a link', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-history-restore-link-'));
    try {
      const target = path.join(dir, 'target.md');
      const link = path.join(dir, 'note.md');
      await writeFile(target, 'secret');
      await symlink(target, link);

      await expect(writeOpenedDocument(link, 'restored')).rejects.toThrow(
        'Version history can only write the opened document'
      );
      await expect(readFile(target, 'utf-8')).resolves.toBe('secret');
      await expect(readOpenedDocument(link)).rejects.toThrow(
        'Version history can only write the opened document'
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
