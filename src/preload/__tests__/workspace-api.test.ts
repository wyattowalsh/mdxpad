import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IPC_CHANNELS } from '@shared/lib/ipc';

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
  },
}));

const mockValidatedInvoke = vi.fn();

vi.mock('../validated-invoke', () => ({
  validatedInvoke: (...args: unknown[]) => mockValidatedInvoke(...args),
}));

import { workspaceApi } from '../workspace-api';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const DOCUMENT_ID = '22222222-2222-4222-8222-222222222222';

describe('workspaceApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes workspace open channel', async () => {
    const request = { rootPath: '/workspace' };
    mockValidatedInvoke.mockResolvedValue({ ok: true });

    await workspaceApi.openWorkspace(request);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      IPC_CHANNELS.workspace.open,
      expect.any(Object),
      expect.any(Object),
      request
    );
  });

  it('invokes workspace save channel', async () => {
    const request = {
      model: {
        version: 1,
        workspace: {
          id: WORKSPACE_ID,
          name: 'Workspace',
          rootPath: '/workspace',
          activeDocumentId: null,
          documents: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        projects: [],
        linkIndex: {},
      },
    };
    mockValidatedInvoke.mockResolvedValue({ ok: true });

    await workspaceApi.saveWorkspace(request as never);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      IPC_CHANNELS.workspace.save,
      expect.any(Object),
      expect.any(Object),
      request
    );
  });

  it('invokes create project channel', async () => {
    const request = {
      workspaceId: WORKSPACE_ID,
      name: 'Project Alpha',
      rootPath: '/workspace/projects/alpha',
      documentIds: [],
      activeDocumentId: null,
    };
    mockValidatedInvoke.mockResolvedValue({ ok: true });

    await workspaceApi.createProject(request);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      IPC_CHANNELS.workspace.createProject,
      expect.any(Object),
      expect.any(Object),
      request
    );
  });

  it('invokes add link channel', async () => {
    const request = {
      workspaceId: WORKSPACE_ID,
      link: {
        sourceDocumentId: DOCUMENT_ID,
        sourcePath: '/workspace/docs/source.mdx',
        targetDocumentId: DOCUMENT_ID,
        targetPath: '/workspace/docs/target.mdx',
        targetAnchor: null,
        relation: 'references',
        position: { line: 1, column: 0, offset: 0 },
      },
    };
    mockValidatedInvoke.mockResolvedValue({ ok: true });

    await workspaceApi.addLink(request as never);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      IPC_CHANNELS.workspace.addLink,
      expect.any(Object),
      expect.any(Object),
      request
    );
  });

  it('invokes get backlinks channel', async () => {
    const request = {
      workspaceId: WORKSPACE_ID,
      documentId: DOCUMENT_ID,
    };
    mockValidatedInvoke.mockResolvedValue({ ok: true });

    await workspaceApi.getBacklinks(request);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      IPC_CHANNELS.workspace.getBacklinks,
      expect.any(Object),
      expect.any(Object),
      request
    );
  });

  it('invokes query metadata collection channel', async () => {
    const request = {
      workspaceId: WORKSPACE_ID,
      filters: [
        {
          field: 'status',
          operator: 'eq' as const,
          value: 'published',
        },
      ],
    };
    mockValidatedInvoke.mockResolvedValue({ ok: true });

    await workspaceApi.queryMetadataCollection(request as never);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      IPC_CHANNELS.workspace.queryMetadataCollection,
      expect.any(Object),
      expect.any(Object),
      request
    );
  });

  it('invokes aggregate metadata collection channel', async () => {
    const request = {
      workspaceId: WORKSPACE_ID,
      field: 'priority',
      operation: 'histogram' as const,
      histogramBinSize: 5,
    };
    mockValidatedInvoke.mockResolvedValue({ ok: true });

    await workspaceApi.aggregateMetadataCollection(request as never);

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      IPC_CHANNELS.workspace.aggregateMetadataCollection,
      expect.any(Object),
      expect.any(Object),
      request
    );
  });
});
