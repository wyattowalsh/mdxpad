import { describe, expect, it, vi } from 'vitest';

import type { WorkspaceModel } from '@shared/types/workspace';

import { scheduleActiveWorkspaceFile, withActiveWorkspaceFile } from './active-workspace-file';

const NOW = '2026-11-18T08:00:00.000Z';

function model(): WorkspaceModel {
  return {
    version: 1,
    workspace: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Workspace',
      rootPath: '/workspace',
      documents: [],
      activeDocumentId: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
    projects: [],
    linkIndex: {},
  };
}

describe('withActiveWorkspaceFile', () => {
  it('adds the open file and makes it active', () => {
    const next = withActiveWorkspaceFile(model(), '/workspace/notes/note.mdx', NOW, () => 'doc-1');
    expect(next?.workspace.activeDocumentId).toBe('doc-1');
    expect(next?.workspace.documents).toEqual([
      {
        id: 'doc-1',
        title: 'note.mdx',
        filePath: '/workspace/notes/note.mdx',
        tags: [],
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);
  });

  it('activates an existing document without duplicating it', () => {
    const current = model();
    const withDocument: WorkspaceModel = {
      ...current,
      workspace: {
        ...current.workspace,
        documents: [
          {
            id: 'doc-1',
            title: 'note.mdx',
            filePath: '/workspace/note.mdx',
            tags: [],
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
      },
    };
    const next = withActiveWorkspaceFile(withDocument, '/workspace/note.mdx', NOW, () => 'doc-2');
    expect(next?.workspace.documents).toHaveLength(1);
    expect(next?.workspace.activeDocumentId).toBe('doc-1');
  });

  it('leaves a file outside the workspace alone', () => {
    expect(withActiveWorkspaceFile(model(), '/other/note.mdx', NOW)).toBeNull();
    expect(withActiveWorkspaceFile(model(), '/workspace-other/note.mdx', NOW)).toBeNull();
    expect(withActiveWorkspaceFile(model(), '/workspace/../secret.mdx', NOW)).toBeNull();
  });

  it('saves the same open file once while a save is in flight', async () => {
    let finish: (() => void) | undefined;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const current = model();
    scheduleActiveWorkspaceFile(current, '/workspace/note.mdx', save);
    scheduleActiveWorkspaceFile(current, '/workspace/note.mdx', save);
    expect(save).toHaveBeenCalledTimes(1);
    finish?.();
    await save.mock.results[0]?.value;
  });
});
