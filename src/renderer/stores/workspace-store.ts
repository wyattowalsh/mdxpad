import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { castDraft } from 'immer';
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
import type {
  LinkIndexEntry,
  LinkRecord,
  WorkspaceDocumentId,
  WorkspaceModel,
} from '@shared/types/workspace';
import { recordLocalTelemetryEvent } from '../lib/telemetry/local-telemetry';

let openWorkspaceRequestId = 0;
let saveWorkspaceRequestId = 0;

interface WorkspaceOperationsApi {
  openWorkspace(request: OpenWorkspaceRequest): Promise<OpenWorkspaceResponse>;
  saveWorkspace(request: SaveWorkspaceRequest): Promise<SaveWorkspaceResponse>;
  createProject(request: CreateProjectRequest): Promise<CreateProjectResponse>;
  addLink(request: AddLinkRequest): Promise<AddLinkResponse>;
  getBacklinks(request: GetBacklinksRequest): Promise<GetBacklinksResponse>;
}

interface WorkspaceWindowShape {
  api?: {
    workspace?: WorkspaceOperationsApi;
  };
  mdxpad?:
    | WorkspaceOperationsApi
    | {
        workspace?: WorkspaceOperationsApi;
      };
}

export interface WorkspaceState {
  model: WorkspaceModel | null;
  backlinksByDocumentId: Partial<Record<WorkspaceDocumentId, LinkRecord[]>>;
  linkSearchQuery: string;
  isLoading: boolean;
  isSaving: boolean;
  error: WorkspaceError | null;
}

export interface WorkspaceStoreActions {
  setModel: (model: WorkspaceModel | null) => void;
  openWorkspace: (request: OpenWorkspaceRequest) => Promise<OpenWorkspaceResponse>;
  saveWorkspace: (request?: SaveWorkspaceRequest) => Promise<SaveWorkspaceResponse>;
  createProject: (request: CreateProjectRequest) => Promise<CreateProjectResponse>;
  addLink: (request: AddLinkRequest) => Promise<AddLinkResponse>;
  getBacklinks: (request: GetBacklinksRequest) => Promise<GetBacklinksResponse>;
  setLinkSearchQuery: (query: string) => void;
  clearLinkSearchQuery: () => void;
  clearError: () => void;
  reset: () => void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceStoreActions;

const INITIAL_WORKSPACE_STATE: WorkspaceState = {
  model: null,
  backlinksByDocumentId: {},
  linkSearchQuery: '',
  isLoading: false,
  isSaving: false,
  error: null,
};

function toWorkspaceError(error: unknown, fallbackMessage: string): WorkspaceError {
  return {
    code: 'UNKNOWN',
    message: error instanceof Error ? error.message : fallbackMessage,
  };
}

function isWorkspaceOperationsApi(value: unknown): value is WorkspaceOperationsApi {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<WorkspaceOperationsApi>;
  return (
    typeof candidate.openWorkspace === 'function' &&
    typeof candidate.saveWorkspace === 'function' &&
    typeof candidate.createProject === 'function' &&
    typeof candidate.addLink === 'function' &&
    typeof candidate.getBacklinks === 'function'
  );
}

function getWorkspaceApi(): WorkspaceOperationsApi {
  const bridge = window as unknown as WorkspaceWindowShape;
  const directApi = bridge.mdxpad;
  if (isWorkspaceOperationsApi(directApi)) {
    return directApi;
  }

  const apiNamespace = bridge.api?.workspace;
  if (isWorkspaceOperationsApi(apiNamespace)) {
    return apiNamespace;
  }

  if (directApi && typeof directApi === 'object' && 'workspace' in directApi) {
    const mdxpadWorkspaceApi = directApi.workspace;
    if (isWorkspaceOperationsApi(mdxpadWorkspaceApi)) {
      return mdxpadWorkspaceApi;
    }
  }

  throw new Error('Workspace API is not available in preload bridge');
}

function createLinkIndexEntry(documentId: WorkspaceDocumentId, updatedAt: string): LinkIndexEntry {
  return {
    documentId,
    outgoing: [],
    incoming: [],
    updatedAt,
  };
}

function matchesBacklinkQuery(link: LinkRecord, query: string): boolean {
  if (query.length === 0) {
    return true;
  }

  const candidateValues = [
    link.sourcePath,
    link.targetPath,
    link.targetAnchor ?? '',
    link.relation,
  ];
  return candidateValues.some((value) => value.toLowerCase().includes(query));
}

export function filterBacklinksForQuery(
  backlinks: readonly LinkRecord[],
  query: string
): LinkRecord[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return backlinks as LinkRecord[];
  }
  return backlinks.filter((link) => matchesBacklinkQuery(link, normalizedQuery));
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  immer((set, get) => ({
    ...INITIAL_WORKSPACE_STATE,

    setModel: (model) =>
      set((draft) => {
        draft.model = castDraft(model);
      }),

    openWorkspace: async (request) => {
      const requestId = ++openWorkspaceRequestId;
      set((draft) => {
        draft.isLoading = true;
        draft.error = null;
      });
      recordLocalTelemetryEvent('workspace', 'open-workspace', 'started');

      try {
        const response = await getWorkspaceApi().openWorkspace(request);
        if (requestId !== openWorkspaceRequestId) {
          return response;
        }
        set((draft) => {
          draft.isLoading = false;
          if (response.ok) {
            draft.model = castDraft(response.value);
          } else {
            draft.error = response.error;
          }
        });
        if (response.ok) {
          recordLocalTelemetryEvent('workspace', 'open-workspace', 'succeeded', {
            details: {
              projectCount: response.value.projects.length,
              documentCount: response.value.workspace.documents.length,
            },
          });
        } else {
          recordLocalTelemetryEvent('workspace', 'open-workspace', 'failed', {
            details: { code: response.error.code },
          });
        }
        return response;
      } catch (error) {
        const workspaceError = toWorkspaceError(error, 'Failed to open workspace');
        if (requestId !== openWorkspaceRequestId) {
          return { ok: false, error: workspaceError };
        }
        set((draft) => {
          draft.isLoading = false;
          draft.error = workspaceError;
        });
        recordLocalTelemetryEvent('workspace', 'open-workspace', 'failed', {
          details: { code: workspaceError.code },
        });
        return { ok: false, error: workspaceError };
      }
    },

    saveWorkspace: async (request) => {
      const modelToSave = request?.model ?? get().model;
      if (!modelToSave) {
        const error: WorkspaceError = {
          code: 'WORKSPACE_INVALID_STATE',
          message: 'No workspace model is loaded',
        };
        set((draft) => {
          draft.error = error;
        });
        recordLocalTelemetryEvent('workspace', 'save-workspace', 'failed', {
          details: { code: error.code },
        });
        return { ok: false, error };
      }

      const requestId = ++saveWorkspaceRequestId;
      const savedWorkspaceId = modelToSave.workspace.id;
      set((draft) => {
        draft.isSaving = true;
        draft.error = null;
      });
      recordLocalTelemetryEvent('workspace', 'save-workspace', 'started');

      try {
        const payload: SaveWorkspaceRequest = { model: modelToSave };
        const response = await getWorkspaceApi().saveWorkspace(payload);
        if (requestId !== saveWorkspaceRequestId) {
          return response;
        }
        set((draft) => {
          draft.isSaving = false;
          if (draft.model !== null && draft.model.workspace.id !== savedWorkspaceId) {
            return;
          }
          if (response.ok) {
            draft.model = castDraft(modelToSave);
          } else {
            draft.error = response.error;
          }
        });
        if (response.ok) {
          recordLocalTelemetryEvent('workspace', 'save-workspace', 'succeeded');
        } else {
          recordLocalTelemetryEvent('workspace', 'save-workspace', 'failed', {
            details: { code: response.error.code },
          });
        }
        return response;
      } catch (error) {
        const workspaceError = toWorkspaceError(error, 'Failed to save workspace');
        if (requestId !== saveWorkspaceRequestId) {
          return { ok: false, error: workspaceError };
        }
        set((draft) => {
          draft.isSaving = false;
          if (draft.model !== null && draft.model.workspace.id !== savedWorkspaceId) {
            return;
          }
          draft.error = workspaceError;
        });
        recordLocalTelemetryEvent('workspace', 'save-workspace', 'failed', {
          details: { code: workspaceError.code },
        });
        return { ok: false, error: workspaceError };
      }
    },

    createProject: async (request) => {
      set((draft) => {
        draft.isSaving = true;
        draft.error = null;
      });
      recordLocalTelemetryEvent('workspace', 'create-project', 'started');

      try {
        const response = await getWorkspaceApi().createProject(request);
        set((draft) => {
          draft.isSaving = false;
          if (response.ok) {
            if (draft.model?.workspace.id === request.workspaceId) {
              draft.model = castDraft({
                ...draft.model,
                workspace: {
                  ...draft.model.workspace,
                  updatedAt: response.value.updatedAt,
                },
                projects: [...draft.model.projects, response.value],
              });
            }
          } else {
            draft.error = response.error;
          }
        });
        if (response.ok) {
          recordLocalTelemetryEvent('workspace', 'create-project', 'succeeded');
        } else {
          recordLocalTelemetryEvent('workspace', 'create-project', 'failed', {
            details: { code: response.error.code },
          });
        }
        return response;
      } catch (error) {
        const workspaceError = toWorkspaceError(error, 'Failed to create project');
        set((draft) => {
          draft.isSaving = false;
          draft.error = workspaceError;
        });
        recordLocalTelemetryEvent('workspace', 'create-project', 'failed', {
          details: { code: workspaceError.code },
        });
        return { ok: false, error: workspaceError };
      }
    },

    addLink: async (request) => {
      set((draft) => {
        draft.isSaving = true;
        draft.error = null;
      });
      recordLocalTelemetryEvent('workspace', 'add-link', 'started');

      try {
        const response = await getWorkspaceApi().addLink(request);
        set((draft) => {
          draft.isSaving = false;
          if (response.ok) {
            if (draft.model?.workspace.id !== request.workspaceId) {
              return;
            }

            const timestamp = new Date().toISOString();
            const link = response.value;
            const nextLinkIndex = { ...draft.model.linkIndex };
            const sourceEntry =
              nextLinkIndex[link.sourceDocumentId] ??
              createLinkIndexEntry(link.sourceDocumentId, timestamp);
            nextLinkIndex[link.sourceDocumentId] = castDraft({
              ...sourceEntry,
              outgoing: [...sourceEntry.outgoing, link],
              updatedAt: timestamp,
            });

            if (link.targetDocumentId !== null) {
              const targetEntry =
                nextLinkIndex[link.targetDocumentId] ??
                createLinkIndexEntry(link.targetDocumentId, timestamp);
              nextLinkIndex[link.targetDocumentId] = castDraft({
                ...targetEntry,
                incoming: [...targetEntry.incoming, link],
                updatedAt: timestamp,
              });
            }

            draft.model = castDraft({
              ...draft.model,
              workspace: {
                ...draft.model.workspace,
                updatedAt: timestamp,
              },
              linkIndex: nextLinkIndex,
            });
          } else {
            draft.error = response.error;
          }
        });
        if (response.ok) {
          recordLocalTelemetryEvent('workspace', 'add-link', 'succeeded', {
            details: { hasTarget: response.value.targetDocumentId !== null },
          });
        } else {
          recordLocalTelemetryEvent('workspace', 'add-link', 'failed', {
            details: { code: response.error.code },
          });
        }
        return response;
      } catch (error) {
        const workspaceError = toWorkspaceError(error, 'Failed to add workspace link');
        set((draft) => {
          draft.isSaving = false;
          draft.error = workspaceError;
        });
        recordLocalTelemetryEvent('workspace', 'add-link', 'failed', {
          details: { code: workspaceError.code },
        });
        return { ok: false, error: workspaceError };
      }
    },

    getBacklinks: async (request) => {
      // Cache-hit guard: skip IPC if backlinks are already loaded for this document
      const existing = get().backlinksByDocumentId[request.documentId];
      if (existing !== undefined) {
        return { ok: true, value: existing } as GetBacklinksResponse;
      }

      set((draft) => {
        draft.isLoading = true;
        draft.error = null;
      });
      recordLocalTelemetryEvent('workspace', 'get-backlinks', 'started');

      try {
        const response = await getWorkspaceApi().getBacklinks(request);
        set((draft) => {
          draft.isLoading = false;
          if (response.ok) {
            draft.backlinksByDocumentId[request.documentId] = response.value;
          } else {
            draft.error = response.error;
          }
        });
        if (response.ok) {
          recordLocalTelemetryEvent('workspace', 'get-backlinks', 'succeeded', {
            details: { count: response.value.length },
          });
        } else {
          recordLocalTelemetryEvent('workspace', 'get-backlinks', 'failed', {
            details: { code: response.error.code },
          });
        }
        return response;
      } catch (error) {
        const workspaceError = toWorkspaceError(error, 'Failed to load backlinks');
        set((draft) => {
          draft.isLoading = false;
          draft.error = workspaceError;
        });
        recordLocalTelemetryEvent('workspace', 'get-backlinks', 'failed', {
          details: { code: workspaceError.code },
        });
        return { ok: false, error: workspaceError };
      }
    },

    setLinkSearchQuery: (query) =>
      set((draft) => {
        draft.linkSearchQuery = query;
      }),

    clearLinkSearchQuery: () =>
      set((draft) => {
        draft.linkSearchQuery = '';
      }),

    clearError: () =>
      set((draft) => {
        draft.error = null;
      }),

    reset: () => {
      openWorkspaceRequestId += 1;
      saveWorkspaceRequestId += 1;
      set((draft) => {
        draft.model = null;
        draft.backlinksByDocumentId = {};
        draft.linkSearchQuery = '';
        draft.isLoading = false;
        draft.isSaving = false;
        draft.error = null;
      });
    },
  }))
);

export const selectWorkspaceModel = (state: WorkspaceStore): WorkspaceModel | null => state.model;

export const selectWorkspaceProjects = (state: WorkspaceStore) => state.model?.projects ?? [];

export const selectWorkspaceError = (state: WorkspaceStore): WorkspaceError | null => state.error;

export const selectWorkspaceIsLoading = (state: WorkspaceStore): boolean => state.isLoading;

export const selectWorkspaceIsSaving = (state: WorkspaceStore): boolean => state.isSaving;
export const selectWorkspaceLinkSearchQuery = (state: WorkspaceStore): string =>
  state.linkSearchQuery;

const EMPTY_BACKLINKS: LinkRecord[] = [];

export const selectBacklinksForDocument =
  (documentId: WorkspaceDocumentId) =>
  (state: WorkspaceStore): LinkRecord[] =>
    state.backlinksByDocumentId[documentId] ?? EMPTY_BACKLINKS;

const filteredBacklinksCache = new Map<
  WorkspaceDocumentId,
  (state: WorkspaceStore) => LinkRecord[]
>();

/**
 * Returns a stable selector reference per documentId so React components
 * can use it without breaking memoization on every render.
 */
export function selectFilteredBacklinksForDocument(
  documentId: WorkspaceDocumentId
): (state: WorkspaceStore) => LinkRecord[] {
  const cached = filteredBacklinksCache.get(documentId);
  if (cached !== undefined) {
    return cached;
  }

  const selector = (state: WorkspaceStore): LinkRecord[] =>
    filterBacklinksForQuery(selectBacklinksForDocument(documentId)(state), state.linkSearchQuery);

  filteredBacklinksCache.set(documentId, selector);
  return selector;
}
