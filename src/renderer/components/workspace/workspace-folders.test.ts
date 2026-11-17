import { describe, expect, it, vi } from 'vitest';

import type { WorkspaceModel } from '@shared/types/workspace';
import {
  chooseWorkspaceFolder,
  foldersFromWorkspace,
  projectsInFolderOrder,
  readExcludesForDirectory,
  readFolderExcludes,
  withoutProjectFolder,
  writeFolderExcludes,
} from './workspace-folders';

const model = {
  workspace: { rootPath: '/notes', name: 'Notes' },
  projects: [
    { rootPath: '/notes', name: 'Notes' },
    { rootPath: '/notes/drafts', name: 'Drafts' },
  ],
} as unknown as WorkspaceModel;

describe('workspace folders', () => {
  it('lists the workspace root once and then each other project', () => {
    expect(
      foldersFromWorkspace('ws', '/notes', 'Notes', model.projects).map((folder) => folder.path)
    ).toEqual(['/notes', '/notes/drafts']);
  });

  it('reorders projects to match the folder list', () => {
    const ordered = projectsInFolderOrder(model, [{ path: '/notes/drafts' }, { path: '/notes' }]);
    expect(ordered.map((project) => project.rootPath)).toEqual(['/notes/drafts', '/notes']);
  });

  it('removes a project folder and keeps the workspace root', () => {
    expect(withoutProjectFolder(model, '/notes')).toBeNull();
    expect(withoutProjectFolder(model, '/notes/drafts')?.projects).toHaveLength(1);
  });

  it('remembers exclude patterns for a folder', () => {
    localStorage.clear();
    writeFolderExcludes('ws', '/notes', ['node_modules', '.git']);
    expect(readFolderExcludes('ws', '/notes')).toEqual(['node_modules', '.git']);
    const notes = foldersFromWorkspace('ws', '/notes', 'Notes', []).find(
      (folder) => folder.path === '/notes'
    );
    expect(notes?.excludePatterns).toEqual(['node_modules', '.git']);
    expect(readExcludesForDirectory('/notes/drafts')).toEqual(['node_modules', '.git']);
  });

  it('returns the directory chosen in the native dialog', async () => {
    const chooseDirectory = vi.fn().mockResolvedValue({ path: '/work', canceled: false });
    vi.stubGlobal('window', { mdxpad: { share: { chooseDirectory } } });

    await expect(chooseWorkspaceFolder()).resolves.toBe('/work');
    vi.unstubAllGlobals();
  });
});
