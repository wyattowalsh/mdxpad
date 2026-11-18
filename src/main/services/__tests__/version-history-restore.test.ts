import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

let userDataDir = '';

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir,
  },
}));

import { VersionHistoryService } from '../version-history-service';

describe('VersionHistoryService.restoreVersion', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('keeps the unsaved editor text in the backup snapshot', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-history-restore-'));
    tempDirs.push(root);
    userDataDir = root;
    const note = path.join(root, 'note.md');
    await writeFile(note, 'old version');
    const service = new VersionHistoryService(() => true);
    const created = await service.createSnapshot(note, 'Older');
    const snapshotId = created.entry?.id;
    expect(created.ok).toBe(true);
    expect(snapshotId).toBeTruthy();
    if (!snapshotId) {
      return;
    }
    await writeFile(note, 'disk version');

    const restored = await service.restoreVersion(snapshotId, note, true, 'unsaved editor');

    expect(restored.ok).toBe(true);
    expect(await readFile(note, 'utf-8')).toBe('old version');
    const history = await service.getHistory(note);
    const backup = history.entries.find((entry) => entry.label === 'Pre-restore backup');
    expect(backup).toBeDefined();
    if (!backup) {
      return;
    }
    const version = await service.getVersion(backup.id, note);
    expect(version.content).toBe('unsaved editor');
  });

  it('stores the editor text instead of the copy on disk', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-history-editor-'));
    tempDirs.push(root);
    userDataDir = root;
    const note = path.join(root, 'note.md');
    await writeFile(note, 'disk version');
    const service = new VersionHistoryService(() => true);

    const created = await service.createSnapshot(note, 'Editor snapshot', 'editor text');
    const snapshotId = created.entry?.id;

    expect(created.ok).toBe(true);
    expect(snapshotId).toBeTruthy();
    if (!snapshotId) {
      return;
    }
    expect(await readFile(note, 'utf-8')).toBe('disk version');
    const version = await service.getVersion(snapshotId, note);
    expect(version.content).toBe('editor text');
  });
});
