import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveWorkspaceFilePath, WorkspacePathError } from '../agent-service';

describe('resolveWorkspaceFilePath', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    const { rm } = await import('node:fs/promises');
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeTempDir(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-agent-path-'));
    tempDirs.push(dir);
    return dir;
  }

  it('resolves a relative file inside the workspace', async () => {
    const root = await makeTempDir();
    await writeFile(path.join(root, 'note.md'), '# note');

    expect(resolveWorkspaceFilePath(root, 'note.md')).toBe(path.join(root, 'note.md'));
  });

  it('rejects a path that escapes the workspace', async () => {
    const root = await makeTempDir();

    expect(() => resolveWorkspaceFilePath(root, '../secret.md')).toThrow(WorkspacePathError);
  });

  it('rejects a symlink ancestor that leaves the workspace', async () => {
    const root = await makeTempDir();
    const outside = await makeTempDir();
    await mkdir(path.join(root, 'link-parent'), { recursive: true });
    await symlink(outside, path.join(root, 'link-parent', 'escape'));

    expect(() => resolveWorkspaceFilePath(root, 'link-parent/escape/secret.md')).toThrow(
      WorkspacePathError
    );
  });

  it('allows the workspace root only when requested', async () => {
    const root = await makeTempDir();

    expect(resolveWorkspaceFilePath(root, '.', { allowRoot: true })).toBe(root);
    expect(() => resolveWorkspaceFilePath(root, '.')).toThrow(WorkspacePathError);
  });
});
