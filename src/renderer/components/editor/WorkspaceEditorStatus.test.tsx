import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import type { DocumentId } from '@shared/types/document';
import type { LinkRecord, WorkspaceDocumentId, WorkspaceModel } from '@shared/types/workspace';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useWorkspaceStore } from '@renderer/stores/workspace-store';
import { useFeatureFlagsStore } from '@renderer/stores/feature-flags-store';
import { WorkspaceEditorStatus } from './WorkspaceEditorStatus';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const ACTIVE_DOCUMENT_ID: WorkspaceDocumentId = '33333333-3333-4333-8333-333333333333';
const SOURCE_DOCUMENT_ID: WorkspaceDocumentId = '44444444-4444-4444-8444-444444444444';
const ACTIVE_FILE_PATH = '/workspace/docs/active.mdx';
const ACTIVE_CREATED_AT = '2026-03-01T00:00:00.000Z';
const ACTIVE_UPDATED_AT = '2026-03-01T00:00:00.000Z';

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

function createWorkspaceModel(): WorkspaceModel {
  return {
    version: 1,
    workspace: {
      id: WORKSPACE_ID,
      name: 'Workspace Alpha',
      rootPath: '/workspace',
      documents: [
        {
          id: ACTIVE_DOCUMENT_ID,
          title: 'Active Doc',
          filePath: ACTIVE_FILE_PATH,
          tags: [],
          createdAt: ACTIVE_CREATED_AT,
          updatedAt: ACTIVE_UPDATED_AT,
        },
      ],
      activeDocumentId: ACTIVE_DOCUMENT_ID,
      createdAt: ACTIVE_CREATED_AT,
      updatedAt: ACTIVE_UPDATED_AT,
    },
    projects: [
      {
        id: PROJECT_ID,
        workspaceId: WORKSPACE_ID,
        name: 'Project Alpha',
        rootPath: '/workspace/docs',
        documentIds: [ACTIVE_DOCUMENT_ID],
        activeDocumentId: ACTIVE_DOCUMENT_ID,
        createdAt: ACTIVE_CREATED_AT,
        updatedAt: ACTIVE_UPDATED_AT,
      },
    ],
    linkIndex: {},
  };
}

function createBacklink(overrides: Partial<LinkRecord> = {}): LinkRecord {
  return {
    sourceDocumentId: SOURCE_DOCUMENT_ID,
    sourcePath: '/workspace/docs/source.mdx',
    targetDocumentId: ACTIVE_DOCUMENT_ID,
    targetPath: ACTIVE_FILE_PATH,
    targetAnchor: null,
    relation: 'references',
    position: { line: 1, column: 1, offset: 1 },
    ...overrides,
  };
}

function setActiveDocumentPath(): void {
  useDocumentStore.getState().openDocument(
    {
      fileId: ACTIVE_DOCUMENT_ID as unknown as DocumentId,
      filePath: ACTIVE_FILE_PATH,
      mtime: Date.now(),
    },
    '# Active document'
  );
}

describe('WorkspaceEditorStatus', () => {
  let previousMdxpad: unknown;
  let previousApi: unknown;
  let mockWorkspaceApi: WorkspaceBridgeMock;

  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.getState().reset();
    useDocumentStore.getState().reset();
    useFeatureFlagsStore.getState().setFlag('workspace', true);

    mockWorkspaceApi = {
      openWorkspace: vi.fn<(request: OpenWorkspaceRequest) => Promise<OpenWorkspaceResponse>>(),
      saveWorkspace: vi.fn<(request: SaveWorkspaceRequest) => Promise<SaveWorkspaceResponse>>(),
      createProject: vi.fn<(request: CreateProjectRequest) => Promise<CreateProjectResponse>>(),
      addLink: vi.fn<(request: AddLinkRequest) => Promise<AddLinkResponse>>(),
      getBacklinks: vi.fn<(request: GetBacklinksRequest) => Promise<GetBacklinksResponse>>(),
    };

    const windowWithBridge = window as unknown as { mdxpad?: unknown; api?: unknown };
    previousMdxpad = windowWithBridge.mdxpad;
    previousApi = windowWithBridge.api;
    windowWithBridge.mdxpad = mockWorkspaceApi;
    Reflect.deleteProperty(windowWithBridge, 'api');
  });

  afterEach(() => {
    cleanup();
    useWorkspaceStore.getState().reset();
    useDocumentStore.getState().reset();

    const windowWithBridge = window as unknown as { mdxpad?: unknown; api?: unknown };
    if (previousMdxpad === undefined) {
      Reflect.deleteProperty(windowWithBridge, 'mdxpad');
    } else {
      windowWithBridge.mdxpad = previousMdxpad;
    }

    if (previousApi === undefined) {
      Reflect.deleteProperty(windowWithBridge, 'api');
    } else {
      windowWithBridge.api = previousApi;
    }
  });

  it('returns null when workspace context is not available', () => {
    render(<WorkspaceEditorStatus />);

    expect(screen.queryByTestId('workspace-editor-status')).toBeNull();
  });

  it('returns null when workspace feature flag is disabled', () => {
    useFeatureFlagsStore.getState().setFlag('workspace', false);
    setActiveDocumentPath();
    useWorkspaceStore.getState().setModel(createWorkspaceModel());

    render(<WorkspaceEditorStatus />);

    expect(screen.queryByTestId('workspace-editor-status')).toBeNull();
  });

  it('shows workspace status, project context, and backlink count for the active document', () => {
    setActiveDocumentPath();
    useWorkspaceStore.getState().setModel(createWorkspaceModel());
    useWorkspaceStore.setState({
      backlinksByDocumentId: {
        [ACTIVE_DOCUMENT_ID]: [createBacklink(), createBacklink()],
      },
    });

    render(<WorkspaceEditorStatus />);

    expect(screen.getByTestId('workspace-editor-status-label').textContent).toContain(
      'Workspace ready'
    );
    expect(screen.getByTestId('workspace-editor-workspace-name').textContent).toContain(
      'Workspace Alpha'
    );
    expect(screen.getByTestId('workspace-editor-project-context').textContent).toContain(
      'Project: Project Alpha'
    );
    expect(screen.getByTestId('workspace-editor-backlink-count').textContent).toContain(
      '2 backlinks'
    );
  });

  it('refreshes backlinks using workspace store action', async () => {
    setActiveDocumentPath();
    useWorkspaceStore.getState().setModel(createWorkspaceModel());
    mockWorkspaceApi.getBacklinks.mockResolvedValue({
      ok: true,
      value: [createBacklink()],
    });

    render(<WorkspaceEditorStatus />);

    fireEvent.click(screen.getByTestId('workspace-editor-refresh-backlinks'));

    await waitFor(() => {
      expect(mockWorkspaceApi.getBacklinks).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        documentId: ACTIVE_DOCUMENT_ID,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('workspace-editor-backlink-count').textContent).toContain(
        '1 backlink'
      );
    });
  });

  it('supports dismissing workspace errors from the editor status area', async () => {
    useWorkspaceStore.setState({
      error: {
        code: 'UNKNOWN',
        message: 'Workspace bridge unavailable',
      },
    });

    render(<WorkspaceEditorStatus />);
    expect(screen.getByTestId('workspace-editor-error').textContent).toContain(
      'Workspace bridge unavailable'
    );

    fireEvent.click(screen.getByTestId('workspace-editor-dismiss-error'));

    await waitFor(() => {
      expect(screen.queryByTestId('workspace-editor-status')).toBeNull();
    });
  });
});
