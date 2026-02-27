import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  WorkspaceError,
} from '@shared/contracts/workspace-schemas';
import type { LinkRecord, WorkspaceDocumentId, WorkspaceModel } from '@shared/types/workspace';
import {
  selectBacklinksForDocument,
  selectFilteredBacklinksForDocument,
  selectWorkspaceProjects,
  useWorkspaceStore,
} from './workspace-store';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_DOCUMENT_ID = '22222222-2222-4222-8222-222222222222';
const TARGET_DOCUMENT_ID = '33333333-3333-4333-8333-333333333333';
const PROJECT_ID = '44444444-4444-4444-8444-444444444444';
const CREATED_AT = '2026-02-16T00:00:00.000Z';
const UPDATED_AT = '2026-02-16T00:00:00.000Z';

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
      name: 'Workspace',
      rootPath: '/workspace',
      documents: [],
      activeDocumentId: null,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    },
    projects: [],
    linkIndex: {},
  };
}

function createProjectResponseValue(workspaceId: string) {
  return {
    id: PROJECT_ID,
    workspaceId,
    name: 'Project Alpha',
    rootPath: '/workspace/projects/alpha',
    documentIds: [],
    activeDocumentId: null,
    createdAt: CREATED_AT,
    updatedAt: '2026-02-17T00:00:00.000Z',
  };
}

function createLinkRecord(overrides: Partial<LinkRecord> = {}): LinkRecord {
  return {
    sourceDocumentId: SOURCE_DOCUMENT_ID,
    sourcePath: '/workspace/docs/source.mdx',
    targetDocumentId: TARGET_DOCUMENT_ID,
    targetPath: '/workspace/docs/target.mdx',
    targetAnchor: null,
    relation: 'references',
    position: { line: 1, column: 2, offset: 3 },
    ...overrides,
  };
}

describe('useWorkspaceStore', () => {
  let previousMdxpad: unknown;
  let previousApi: unknown;
  let mockWorkspaceApi: WorkspaceBridgeMock;

  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.getState().reset();

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

  it('starts with initial state', () => {
    const state = useWorkspaceStore.getState();
    expect(state.model).toBeNull();
    expect(state.error).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.isSaving).toBe(false);
  });

  it('loads workspace model from openWorkspace', async () => {
    const model = createWorkspaceModel();
    mockWorkspaceApi.openWorkspace.mockResolvedValue({ ok: true, value: model });

    const response = await useWorkspaceStore.getState().openWorkspace({ rootPath: '/workspace' });

    expect(response).toEqual({ ok: true, value: model });
    expect(mockWorkspaceApi.openWorkspace).toHaveBeenCalledWith({ rootPath: '/workspace' });
    expect(useWorkspaceStore.getState().model).toEqual(model);
    expect(useWorkspaceStore.getState().error).toBeNull();
    expect(useWorkspaceStore.getState().isLoading).toBe(false);
  });

  it('supports window.api.workspace bridge shape', async () => {
    const model = createWorkspaceModel();
    mockWorkspaceApi.openWorkspace.mockResolvedValue({ ok: true, value: model });

    const windowWithBridge = window as unknown as {
      mdxpad?: unknown;
      api?: { workspace?: WorkspaceBridgeMock };
    };
    Reflect.deleteProperty(windowWithBridge, 'mdxpad');
    windowWithBridge.api = { workspace: mockWorkspaceApi };

    const response = await useWorkspaceStore.getState().openWorkspace({ rootPath: '/workspace' });

    expect(response.ok).toBe(true);
    expect(useWorkspaceStore.getState().model).toEqual(model);
  });

  it('stores workspace errors when openWorkspace fails', async () => {
    const error: WorkspaceError = {
      code: 'WORKSPACE_NOT_FOUND',
      message: 'Workspace root does not exist',
    };
    mockWorkspaceApi.openWorkspace.mockResolvedValue({ ok: false, error });

    const response = await useWorkspaceStore.getState().openWorkspace({ rootPath: '/missing' });

    expect(response).toEqual({ ok: false, error });
    expect(useWorkspaceStore.getState().model).toBeNull();
    expect(useWorkspaceStore.getState().error).toEqual(error);
    expect(useWorkspaceStore.getState().isLoading).toBe(false);
  });

  it('saves loaded workspace model when no request is provided', async () => {
    const model = createWorkspaceModel();
    useWorkspaceStore.getState().setModel(model);
    mockWorkspaceApi.saveWorkspace.mockResolvedValue({ ok: true, value: undefined });

    const response = await useWorkspaceStore.getState().saveWorkspace();

    expect(response.ok).toBe(true);
    expect(mockWorkspaceApi.saveWorkspace).toHaveBeenCalledWith({ model });
    expect(useWorkspaceStore.getState().isSaving).toBe(false);
    expect(useWorkspaceStore.getState().error).toBeNull();
  });

  it('returns invalid state error when save is called without a model', async () => {
    const response = await useWorkspaceStore.getState().saveWorkspace();

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('WORKSPACE_INVALID_STATE');
    }
    expect(mockWorkspaceApi.saveWorkspace).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().isSaving).toBe(false);
  });

  it('updates local model when createProject succeeds', async () => {
    useWorkspaceStore.getState().setModel(createWorkspaceModel());
    const project = createProjectResponseValue(WORKSPACE_ID);
    mockWorkspaceApi.createProject.mockResolvedValue({ ok: true, value: project });

    const request: CreateProjectRequest = {
      workspaceId: WORKSPACE_ID,
      name: project.name,
      rootPath: project.rootPath,
      documentIds: [],
      activeDocumentId: null,
    };
    await useWorkspaceStore.getState().createProject(request);

    const state = useWorkspaceStore.getState();
    expect(selectWorkspaceProjects(state)).toHaveLength(1);
    expect(selectWorkspaceProjects(state)[0]).toEqual(project);
    expect(state.model?.workspace.updatedAt).toBe(project.updatedAt);
    expect(state.isSaving).toBe(false);
  });

  it('updates link index when addLink succeeds', async () => {
    useWorkspaceStore.getState().setModel(createWorkspaceModel());
    const link = createLinkRecord();
    mockWorkspaceApi.addLink.mockResolvedValue({ ok: true, value: link });

    await useWorkspaceStore.getState().addLink({
      workspaceId: WORKSPACE_ID,
      link,
    });

    const state = useWorkspaceStore.getState();
    const sourceOutgoing = state.model?.linkIndex[SOURCE_DOCUMENT_ID]?.outgoing ?? [];
    const targetIncoming = state.model?.linkIndex[TARGET_DOCUMENT_ID]?.incoming ?? [];

    expect(sourceOutgoing).toHaveLength(1);
    expect(sourceOutgoing[0]).toEqual(link);
    expect(targetIncoming).toHaveLength(1);
    expect(targetIncoming[0]).toEqual(link);
    expect(state.isSaving).toBe(false);
  });

  it('stores backlinks by document id when getBacklinks succeeds', async () => {
    const documentId: WorkspaceDocumentId = TARGET_DOCUMENT_ID;
    const backlinks = [createLinkRecord({ targetDocumentId: documentId })];
    mockWorkspaceApi.getBacklinks.mockResolvedValue({ ok: true, value: backlinks });

    await useWorkspaceStore.getState().getBacklinks({
      workspaceId: WORKSPACE_ID,
      documentId,
    });

    const state = useWorkspaceStore.getState();
    expect(selectBacklinksForDocument(documentId)(state)).toEqual(backlinks);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('filters backlinks by link search query', async () => {
    const documentId: WorkspaceDocumentId = TARGET_DOCUMENT_ID;
    const backlinks = [
      createLinkRecord({
        targetDocumentId: documentId,
        sourcePath: '/workspace/docs/overview.mdx',
      }),
      createLinkRecord({
        sourceDocumentId: '55555555-5555-4555-8555-555555555555',
        targetDocumentId: documentId,
        sourcePath: '/workspace/docs/reference.mdx',
        relation: 'derived-from',
      }),
    ];
    mockWorkspaceApi.getBacklinks.mockResolvedValue({ ok: true, value: backlinks });

    await useWorkspaceStore.getState().getBacklinks({
      workspaceId: WORKSPACE_ID,
      documentId,
    });

    useWorkspaceStore.getState().setLinkSearchQuery('derived');

    const state = useWorkspaceStore.getState();
    expect(selectFilteredBacklinksForDocument(documentId)(state)).toEqual([backlinks[1]]);
  });

  it('resets store state', async () => {
    useWorkspaceStore.getState().setModel(createWorkspaceModel());
    useWorkspaceStore.setState({
      backlinksByDocumentId: {
        [TARGET_DOCUMENT_ID]: [createLinkRecord()],
      },
      isLoading: true,
      isSaving: true,
      error: {
        code: 'UNKNOWN',
        message: 'Failure',
      },
    });

    useWorkspaceStore.getState().reset();

    const state = useWorkspaceStore.getState();
    expect(state.model).toBeNull();
    expect(state.backlinksByDocumentId).toEqual({});
    expect(state.isLoading).toBe(false);
    expect(state.isSaving).toBe(false);
    expect(state.error).toBeNull();
  });

  afterEach(() => {
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
});
