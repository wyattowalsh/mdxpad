import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  AddLinkRequest,
  AddLinkResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  GetBacklinksRequest,
  GetBacklinksResponse,
  OpenWorkspaceRequest,
  OpenWorkspaceResponse,
  SaveWorkspaceRequest,
  SaveWorkspaceResponse,
} from '@shared/contracts/workspace-schemas';
import type { LinkRecord, WorkspaceModel } from '@shared/types/workspace';
import { useWorkspaceStore } from '@renderer/stores/workspace-store';
import { WorkspacePanel } from './WorkspacePanel';
import { FILTER_EVENTS } from '@renderer/commands/filter-commands';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const DOCUMENT_ID = '22222222-2222-4222-8222-222222222222';

interface WorkspaceBridgeMock {
  openWorkspace: ReturnType<
    typeof vi.fn<(request: OpenWorkspaceRequest) => Promise<OpenWorkspaceResponse>>
  >;
  saveWorkspace: ReturnType<
    typeof vi.fn<(request: SaveWorkspaceRequest) => Promise<SaveWorkspaceResponse>>
  >;
  createProject: ReturnType<
    typeof vi.fn<(request: CreateProjectRequest) => Promise<CreateProjectResponse>>
  >;
  addLink: ReturnType<typeof vi.fn<(request: AddLinkRequest) => Promise<AddLinkResponse>>>;
  getBacklinks: ReturnType<
    typeof vi.fn<(request: GetBacklinksRequest) => Promise<GetBacklinksResponse>>
  >;
}

function createWorkspaceBridgeMock(): WorkspaceBridgeMock {
  return {
    openWorkspace: vi.fn<(request: OpenWorkspaceRequest) => Promise<OpenWorkspaceResponse>>(),
    saveWorkspace: vi.fn<(request: SaveWorkspaceRequest) => Promise<SaveWorkspaceResponse>>(),
    createProject: vi.fn<(request: CreateProjectRequest) => Promise<CreateProjectResponse>>(),
    addLink: vi.fn<(request: AddLinkRequest) => Promise<AddLinkResponse>>(),
    getBacklinks: vi.fn<(request: GetBacklinksRequest) => Promise<GetBacklinksResponse>>(),
  };
}

function createWorkspaceModel(): WorkspaceModel {
  return {
    version: 1,
    workspace: {
      id: WORKSPACE_ID,
      name: 'Workspace',
      rootPath: '/workspace',
      documents: [],
      activeDocumentId: null,
      createdAt: '2026-02-20T00:00:00.000Z',
      updatedAt: '2026-02-20T00:00:00.000Z',
    },
    projects: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        workspaceId: WORKSPACE_ID,
        name: 'Project Alpha',
        rootPath: '/workspace/projects/alpha',
        documentIds: [],
        activeDocumentId: null,
        createdAt: '2026-02-20T00:00:00.000Z',
        updatedAt: '2026-02-20T00:00:00.000Z',
      },
    ],
    linkIndex: {},
  };
}

function createBacklink(overrides: Partial<LinkRecord> = {}): LinkRecord {
  return {
    sourceDocumentId: DOCUMENT_ID,
    sourcePath: '/workspace/docs/source.mdx',
    targetDocumentId: DOCUMENT_ID,
    targetPath: '/workspace/docs/target.mdx',
    targetAnchor: null,
    relation: 'references',
    position: { line: 1, column: 0, offset: 0 },
    ...overrides,
  };
}

describe('WorkspacePanel', () => {
  let previousMdxpad: unknown;
  let mockWorkspaceApi: WorkspaceBridgeMock;

  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    vi.clearAllMocks();
    mockWorkspaceApi = createWorkspaceBridgeMock();

    const windowWithBridge = window as unknown as { mdxpad?: unknown };
    previousMdxpad = windowWithBridge.mdxpad;
    windowWithBridge.mdxpad = mockWorkspaceApi;
  });

  afterEach(() => {
    cleanup();
    useWorkspaceStore.getState().reset();

    const windowWithBridge = window as unknown as { mdxpad?: unknown };
    if (previousMdxpad === undefined) {
      Reflect.deleteProperty(windowWithBridge, 'mdxpad');
    } else {
      windowWithBridge.mdxpad = previousMdxpad;
    }
  });

  it('loads workspace projects for a root path', async () => {
    mockWorkspaceApi.openWorkspace.mockResolvedValue({
      ok: true,
      value: createWorkspaceModel(),
    });
    mockWorkspaceApi.getBacklinks.mockResolvedValue({ ok: true, value: [] });

    render(<WorkspacePanel rootPath="/workspace" activeDocumentId={DOCUMENT_ID} />);

    await waitFor(() => {
      expect(mockWorkspaceApi.openWorkspace).toHaveBeenCalledWith({ rootPath: '/workspace' });
    });

    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeTruthy();
    });
  });

  it('registers the open file and requests its backlinks', async () => {
    mockWorkspaceApi.openWorkspace.mockResolvedValue({
      ok: true,
      value: createWorkspaceModel(),
    });
    mockWorkspaceApi.saveWorkspace.mockResolvedValue({ ok: true, value: undefined });
    mockWorkspaceApi.getBacklinks.mockResolvedValue({ ok: true, value: [] });

    render(<WorkspacePanel rootPath="/workspace" activeFilePath="/workspace/notes/note.mdx" />);

    await waitFor(() => {
      expect(mockWorkspaceApi.saveWorkspace).toHaveBeenCalled();
    });
    const saved = mockWorkspaceApi.saveWorkspace.mock.calls[0]?.[0].model;
    expect(saved).toBeTruthy();
    if (!saved) {
      return;
    }
    expect(saved.workspace.documents[0]?.filePath).toBe('/workspace/notes/note.mdx');
    expect(saved.workspace.activeDocumentId).toBe(saved.workspace.documents[0]?.id);

    await waitFor(() => {
      expect(mockWorkspaceApi.getBacklinks).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        documentId: saved.workspace.activeDocumentId,
      });
    });
  });

  it('requests and renders backlinks for active document', async () => {
    mockWorkspaceApi.openWorkspace.mockResolvedValue({
      ok: true,
      value: createWorkspaceModel(),
    });
    mockWorkspaceApi.getBacklinks.mockResolvedValue({
      ok: true,
      value: [createBacklink()],
    });

    render(<WorkspacePanel rootPath="/workspace" activeDocumentId={DOCUMENT_ID} />);

    await waitFor(() => {
      expect(mockWorkspaceApi.getBacklinks).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        documentId: DOCUMENT_ID,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('/workspace/docs/source.mdx')).toBeTruthy();
    });
  });

  it('filters backlink results using the workspace link search query and clear event', async () => {
    mockWorkspaceApi.openWorkspace.mockResolvedValue({
      ok: true,
      value: createWorkspaceModel(),
    });
    mockWorkspaceApi.getBacklinks.mockResolvedValue({
      ok: true,
      value: [
        createBacklink({ sourcePath: '/workspace/docs/source.mdx' }),
        createBacklink({
          sourceDocumentId: '33333333-3333-4333-8333-333333333333',
          sourcePath: '/workspace/docs/reference.mdx',
          relation: 'derived-from',
        }),
      ],
    });

    render(<WorkspacePanel rootPath="/workspace" activeDocumentId={DOCUMENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText('/workspace/docs/source.mdx')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Search backlinks'), { target: { value: 'derived' } });

    expect(screen.queryByText('/workspace/docs/source.mdx')).toBeNull();
    expect(screen.getByText('/workspace/docs/reference.mdx')).toBeTruthy();

    act(() => {
      window.dispatchEvent(new CustomEvent(FILTER_EVENTS.clearWorkspaceLinkSearch));
    });

    await waitFor(() => {
      expect(screen.getByText('/workspace/docs/source.mdx')).toBeTruthy();
    });
  });
});
