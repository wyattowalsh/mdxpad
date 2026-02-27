import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { BrowserWindow, IpcMain } from 'electron';

import { WorkspaceService } from '@main/services/workspace-service';
import { registerLinkHandlers, WORKSPACE_LINK_CHANNELS } from '../link-handlers';
import { registerWorkspaceHandlers, WorkspaceChannels } from '../workspace-handlers';

type WorkspaceHandlerService = Pick<
  WorkspaceService,
  | 'openWorkspace'
  | 'saveWorkspace'
  | 'createProject'
  | 'queryMetadataCollection'
  | 'aggregateMetadataCollection'
>;

const mockIpcMain = {
  handle: vi.fn(),
} as unknown as IpcMain;

function createMockWindow(): BrowserWindow {
  return {
    webContents: {
      id: 42,
      mainFrame: { routingId: 99 },
    },
  } as unknown as BrowserWindow;
}

function createInvokeEvent(
  window: BrowserWindow,
  overrides?: { senderId?: number; senderFrameRoutingId?: number }
) {
  const senderId = overrides?.senderId ?? window.webContents.id;
  const senderFrameRoutingId =
    overrides?.senderFrameRoutingId ?? window.webContents.mainFrame.routingId;

  return {
    sender: {
      id: senderId,
      mainFrame: { routingId: window.webContents.mainFrame.routingId },
    },
    senderFrame: { routingId: senderFrameRoutingId },
  };
}

function createWorkspaceModel() {
  const workspaceId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  return {
    version: 1 as const,
    workspace: {
      id: workspaceId,
      name: 'Workspace',
      rootPath: '/workspace',
      documents: [
        {
          id: documentId,
          title: 'Document',
          filePath: '/workspace/docs/document.mdx',
          tags: ['mdx'],
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      activeDocumentId: documentId,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    projects: [],
    linkIndex: {},
  };
}

function createProject(workspaceId: string) {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    workspaceId,
    name: 'Project Alpha',
    rootPath: '/workspace/projects/alpha',
    documentIds: [],
    activeDocumentId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createMetadataCollectionDocument() {
  return {
    id: crypto.randomUUID(),
    filePath: '/workspace/docs/roadmap.mdx',
    title: 'Roadmap',
    slug: 'roadmap',
    tags: ['planning'],
    snippet: 'Prioritized roadmap',
    frontmatter: {
      status: 'published',
      priority: 3,
    },
    indexedAt: new Date().toISOString(),
  };
}

describe('registerWorkspaceHandlers', () => {
  let window: BrowserWindow;
  let workspaceService: WorkspaceHandlerService;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    window = createMockWindow();
    handlers = {};

    const workspaceModel = createWorkspaceModel();
    workspaceService = {
      openWorkspace: vi.fn().mockResolvedValue({
        ok: true,
        value: workspaceModel,
      }),
      saveWorkspace: vi.fn().mockResolvedValue({
        ok: true,
        value: undefined,
      }),
      createProject: vi.fn().mockResolvedValue({
        ok: true,
        value: createProject(workspaceModel.workspace.id),
      }),
      queryMetadataCollection: vi.fn().mockResolvedValue({
        ok: true,
        value: [createMetadataCollectionDocument()],
      }),
      aggregateMetadataCollection: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          field: 'priority',
          operation: 'histogram',
          total: 1,
          buckets: {
            '0..5': 1,
          },
        },
      }),
    };

    vi.mocked(mockIpcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });

    registerWorkspaceHandlers(mockIpcMain, window, workspaceService);
  });

  it('registers all workspace handlers', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith(WorkspaceChannels.OPEN, expect.any(Function));
    expect(mockIpcMain.handle).toHaveBeenCalledWith(WorkspaceChannels.SAVE, expect.any(Function));
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      WorkspaceChannels.CREATE_PROJECT,
      expect.any(Function)
    );
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      WorkspaceChannels.QUERY_METADATA_COLLECTION,
      expect.any(Function)
    );
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      WorkspaceChannels.AGGREGATE_METADATA_COLLECTION,
      expect.any(Function)
    );
  });

  it('handles openWorkspace with validated request/response', async () => {
    const result = await handlers[WorkspaceChannels.OPEN]!(createInvokeEvent(window), {
      rootPath: '/workspace',
    });

    expect(workspaceService.openWorkspace).toHaveBeenCalledWith({ rootPath: '/workspace' });
    expect(result).toMatchObject({
      ok: true,
      value: {
        workspace: {
          rootPath: '/workspace',
        },
      },
    });
  });

  it('handles saveWorkspace with validated request/response', async () => {
    const model = createWorkspaceModel();

    const result = await handlers[WorkspaceChannels.SAVE]!(createInvokeEvent(window), { model });

    expect(workspaceService.saveWorkspace).toHaveBeenCalledWith({ model });
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it('applies createProject request defaults before calling service', async () => {
    const workspaceId = createWorkspaceModel().workspace.id;
    const result = await handlers[WorkspaceChannels.CREATE_PROJECT]!(createInvokeEvent(window), {
      workspaceId,
      name: 'Project Beta',
      rootPath: '/workspace/projects/beta',
    });

    expect(workspaceService.createProject).toHaveBeenCalledWith({
      workspaceId,
      name: 'Project Beta',
      rootPath: '/workspace/projects/beta',
      documentIds: [],
      activeDocumentId: null,
    });
    expect(result).toMatchObject({ ok: true });
  });

  it('handles queryMetadataCollection with validated request/response', async () => {
    const workspaceId = createWorkspaceModel().workspace.id;
    const result = await handlers[WorkspaceChannels.QUERY_METADATA_COLLECTION]!(
      createInvokeEvent(window),
      {
        workspaceId,
        filters: [
          {
            field: 'status',
            operator: 'eq',
            value: 'published',
          },
        ],
      }
    );

    expect(workspaceService.queryMetadataCollection).toHaveBeenCalledWith({
      workspaceId,
      documentIds: [],
      filters: [
        {
          field: 'status',
          operator: 'eq',
          value: 'published',
        },
      ],
    });
    expect(result).toMatchObject({ ok: true });
  });

  it('handles aggregateMetadataCollection with validated request/response', async () => {
    const workspaceId = createWorkspaceModel().workspace.id;
    const result = await handlers[WorkspaceChannels.AGGREGATE_METADATA_COLLECTION]!(
      createInvokeEvent(window),
      {
        workspaceId,
        field: 'priority',
        operation: 'histogram',
        histogramBinSize: 5,
      }
    );

    expect(workspaceService.aggregateMetadataCollection).toHaveBeenCalledWith({
      workspaceId,
      documentIds: [],
      filters: [],
      field: 'priority',
      operation: 'histogram',
      histogramBinSize: 5,
    });
    expect(result).toMatchObject({ ok: true });
  });

  it('rejects unauthorized sender', () => {
    expect(() =>
      handlers[WorkspaceChannels.OPEN]!(
        createInvokeEvent(window, { senderId: window.webContents.id + 1 }),
        { rootPath: '/workspace' }
      )
    ).toThrow('Unauthorized IPC sender');
  });

  it('throws on invalid request payload', async () => {
    await expect(handlers[WorkspaceChannels.OPEN]!(createInvokeEvent(window), {})).rejects.toThrow(
      'Validation failed'
    );
    expect(workspaceService.openWorkspace).not.toHaveBeenCalled();
  });

  it('throws on invalid response payload', async () => {
    vi.mocked(workspaceService.openWorkspace).mockResolvedValue({
      ok: true,
      value: {
        workspace: {},
      },
    } as never);

    await expect(
      handlers[WorkspaceChannels.OPEN]!(createInvokeEvent(window), {
        rootPath: '/workspace',
      })
    ).rejects.toThrow();
  });
});

describe('workspace and link handlers with shared WorkspaceService', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = {};

    vi.mocked(mockIpcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });
  });

  it('supports addLink and getBacklinks after opening workspace', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-ipc-workspace-'));
    const workspaceRoot = path.join(tempDir, 'workspace');
    await mkdir(workspaceRoot, { recursive: true });

    try {
      const window = createMockWindow();
      const sharedWorkspaceService = new WorkspaceService();
      registerWorkspaceHandlers(mockIpcMain, window, sharedWorkspaceService);
      registerLinkHandlers(mockIpcMain, window, sharedWorkspaceService);

      const openResult = await handlers[WorkspaceChannels.OPEN]!(createInvokeEvent(window), {
        rootPath: workspaceRoot,
      });
      expect(openResult).toMatchObject({ ok: true });
      if (!openResult.ok) {
        return;
      }

      const sourceDocumentId = crypto.randomUUID();
      const targetDocumentId = crypto.randomUUID();
      const now = new Date().toISOString();

      // Register documents in the workspace so addLink target validation passes
      const saveResult = await handlers[WorkspaceChannels.SAVE]!(createInvokeEvent(window), {
        model: {
          ...openResult.value,
          workspace: {
            ...openResult.value.workspace,
            documents: [
              {
                id: sourceDocumentId,
                title: 'Source',
                filePath: path.join(workspaceRoot, 'docs', 'source.mdx'),
                tags: [],
                createdAt: now,
                updatedAt: now,
              },
              {
                id: targetDocumentId,
                title: 'Target',
                filePath: path.join(workspaceRoot, 'docs', 'target.mdx'),
                tags: [],
                createdAt: now,
                updatedAt: now,
              },
            ],
            updatedAt: now,
          },
        },
      });
      expect(saveResult).toMatchObject({ ok: true });

      const link = {
        sourceDocumentId,
        sourcePath: path.join(workspaceRoot, 'docs', 'source.mdx'),
        targetDocumentId,
        targetPath: path.join(workspaceRoot, 'docs', 'target.mdx'),
        targetAnchor: null,
        relation: 'references' as const,
        position: null,
      };

      const addLinkResult = await handlers[WORKSPACE_LINK_CHANNELS.addLink]!(
        createInvokeEvent(window),
        {
          workspaceId: openResult.value.workspace.id,
          link,
        }
      );
      expect(addLinkResult).toEqual({
        ok: true,
        value: link,
      });

      const backlinksResult = await handlers[WORKSPACE_LINK_CHANNELS.getBacklinks]!(
        createInvokeEvent(window),
        {
          workspaceId: openResult.value.workspace.id,
          documentId: targetDocumentId,
        }
      );
      expect(backlinksResult).toEqual({
        ok: true,
        value: [link],
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
