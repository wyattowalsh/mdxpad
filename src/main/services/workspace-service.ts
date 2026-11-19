import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { normalizeCapabilityPath } from '@main/ipc/document-capability';
import { readFileWithoutFollowingLinks } from '@main/services/file-service';
import { atomicWrite } from '@shared/lib/atomic-write';
import {
  type AggregateMetadataCollectionRequest,
  type AggregateMetadataCollectionResponse,
  WorkspaceModelSchema,
  type AddLinkRequest,
  type AddLinkResponse,
  type MetadataCollectionDocument,
  type CreateProjectRequest,
  type CreateProjectResponse,
  type GetBacklinksRequest,
  type GetBacklinksResponse,
  type OpenWorkspaceRequest,
  type OpenWorkspaceResponse,
  type QueryMetadataCollectionRequest,
  type QueryMetadataCollectionResponse,
  type SaveWorkspaceRequest,
  type SaveWorkspaceResponse,
  type WorkspaceError,
} from '@shared/contracts/workspace-schemas';
import type {
  LinkIndex,
  LinkIndexEntry,
  LinkRecord,
  WorkspaceModel,
} from '@shared/types/workspace';

import { ensureRealDirectory } from './ensure-real-directory';
import {
  FileIndexService,
  type FileIndexCollectionFilter,
  type FileIndexDocumentInput,
} from './file-index-service';

export const WORKSPACE_MODEL_RELATIVE_PATH = path.join('.mdxpad', 'workspace.json');

/** Cache entry for collection index with TTL */
interface CollectionCacheEntry {
  readonly data: FileIndexService;
  readonly timestamp: number;
}

const COLLECTION_CACHE_TTL_MS = 30_000;
const collectionCache = new Map<string, CollectionCacheEntry>();

/** Cache entry for parsed workspace model with TTL */
interface WorkspaceModelCacheEntry {
  readonly model: WorkspaceModel;
  readonly timestamp: number;
}

const WORKSPACE_MODEL_CACHE_TTL_MS = 10_000;
const workspaceModelCache = new Map<string, WorkspaceModelCacheEntry>();

function fileIsInsideWorkspace(rootPath: string, filePath: string): boolean {
  const root = normalizeCapabilityPath(rootPath);
  const file = normalizeCapabilityPath(filePath);
  if (root === null || file === null) {
    return false;
  }
  const relative = path.relative(root, file);
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function createWorkspaceError(code: WorkspaceError['code'], message: string): WorkspaceError {
  return { code, message };
}

function mapWorkspaceError(error: unknown, fallbackMessage: string): WorkspaceError {
  if (error instanceof Error && 'code' in error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return createWorkspaceError('WORKSPACE_NOT_FOUND', fallbackMessage);
    }
    if (code === 'EACCES' || code === 'EPERM') {
      return createWorkspaceError('WORKSPACE_ACCESS_DENIED', fallbackMessage);
    }
    return createWorkspaceError('UNKNOWN', error.message);
  }

  return createWorkspaceError('UNKNOWN', error instanceof Error ? error.message : String(error));
}

function createDefaultWorkspaceModel(rootPath: string): WorkspaceModel {
  const timestamp = new Date().toISOString();
  const name = path.basename(rootPath) || 'Workspace';
  return {
    version: 1,
    workspace: {
      id: randomUUID(),
      name,
      rootPath,
      documents: [],
      activeDocumentId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    projects: [],
    linkIndex: {},
  };
}

function createLinkIndexEntry(documentId: string, updatedAt: string): LinkIndexEntry {
  return {
    documentId,
    outgoing: [],
    incoming: [],
    updatedAt,
  };
}

function buildUpdatedLinkIndex(
  existing: LinkIndex,
  link: LinkRecord,
  timestamp: string
): LinkIndex {
  const linkIndex: LinkIndex = { ...existing };
  const sourceEntry =
    linkIndex[link.sourceDocumentId] ?? createLinkIndexEntry(link.sourceDocumentId, timestamp);
  linkIndex[link.sourceDocumentId] = {
    ...sourceEntry,
    outgoing: [...sourceEntry.outgoing, link],
    updatedAt: timestamp,
  };
  if (link.targetDocumentId !== null) {
    const targetId = link.targetDocumentId;
    const targetEntry = linkIndex[targetId] ?? createLinkIndexEntry(targetId, timestamp);
    linkIndex[targetId] = {
      ...targetEntry,
      incoming: [...targetEntry.incoming, link],
      updatedAt: timestamp,
    };
  }
  return linkIndex;
}

export class WorkspaceService {
  private readonly workspaceRootById = new Map<string, string>();

  private async buildCollectionIndex(
    model: WorkspaceModel,
    documentIds: readonly string[]
  ): Promise<FileIndexService> {
    const cacheKey = `${model.workspace.id}:${[...documentIds].sort().join(',')}`;
    const cached = collectionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < COLLECTION_CACHE_TTL_MS) {
      return cached.data;
    }

    const filterByDocumentId = documentIds.length > 0 ? new Set(documentIds) : null;
    const collectionDocuments = model.workspace.documents.filter(
      (document) => !filterByDocumentId || filterByDocumentId.has(document.id)
    );

    const indexedDocuments = await Promise.all(
      collectionDocuments.map(async (document): Promise<FileIndexDocumentInput | null> => {
        try {
          if (!fileIsInsideWorkspace(model.workspace.rootPath, document.filePath)) {
            return null;
          }
          const read = await readFileWithoutFollowingLinks(document.filePath);
          if (!read.ok) {
            return null;
          }
          return {
            id: document.id,
            filePath: document.filePath,
            content: read.value,
            indexedAt: document.updatedAt,
          };
        } catch {
          return null;
        }
      })
    );

    const index = new FileIndexService();
    index.indexDocuments(
      indexedDocuments.filter((document): document is FileIndexDocumentInput => document !== null)
    );

    collectionCache.set(cacheKey, { data: index, timestamp: Date.now() });
    return index;
  }

  private async readModelText(modelPath: string): Promise<string> {
    await ensureRealDirectory(path.dirname(modelPath));
    const read = await readFileWithoutFollowingLinks(modelPath);
    if (read.ok) {
      return read.value;
    }
    if (read.error.code === 'NOT_FOUND') {
      const missing = new Error('Workspace model is missing') as NodeJS.ErrnoException;
      missing.code = 'ENOENT';
      throw missing;
    }
    const info = await fs.lstat(modelPath).catch(() => null);
    if (info === null || info.isSymbolicLink()) {
      const link = new Error('Workspace model is a link') as NodeJS.ErrnoException;
      link.code = 'ENOENT';
      throw link;
    }
    const denied = new Error('Workspace model is unavailable') as NodeJS.ErrnoException;
    denied.code = 'EACCES';
    throw denied;
  }

  private getWorkspaceModelPath(rootPath: string): string {
    return path.join(rootPath, WORKSPACE_MODEL_RELATIVE_PATH);
  }

  private async persistWorkspaceModel(model: WorkspaceModel): Promise<void> {
    const modelPath = this.getWorkspaceModelPath(model.workspace.rootPath);
    await ensureRealDirectory(path.dirname(modelPath));
    await atomicWrite(modelPath, JSON.stringify(model, null, 2));
    this.workspaceRootById.set(model.workspace.id, model.workspace.rootPath);

    // Invalidate caches on write
    workspaceModelCache.delete(model.workspace.rootPath);
    for (const key of collectionCache.keys()) {
      if (key.startsWith(`${model.workspace.id}:`)) {
        collectionCache.delete(key);
      }
    }
  }

  private async readWorkspaceModel(rootPath: string): Promise<OpenWorkspaceResponse> {
    const cachedModel = workspaceModelCache.get(rootPath);
    if (cachedModel && Date.now() - cachedModel.timestamp < WORKSPACE_MODEL_CACHE_TTL_MS) {
      this.workspaceRootById.set(cachedModel.model.workspace.id, rootPath);
      return { ok: true, value: cachedModel.model };
    }

    const modelPath = this.getWorkspaceModelPath(rootPath);
    try {
      const rawContent = await this.readModelText(modelPath);
      const parsedJson = JSON.parse(rawContent) as unknown;
      const parsedModel = WorkspaceModelSchema.safeParse(parsedJson);
      if (!parsedModel.success) {
        return {
          ok: false,
          error: createWorkspaceError(
            'WORKSPACE_INVALID_STATE',
            `Workspace model is invalid at ${modelPath}`
          ),
        };
      }

      this.workspaceRootById.set(parsedModel.data.workspace.id, rootPath);
      workspaceModelCache.set(rootPath, { model: parsedModel.data, timestamp: Date.now() });
      return {
        ok: true,
        value: parsedModel.data,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        const model = createDefaultWorkspaceModel(rootPath);
        await this.persistWorkspaceModel(model);
        return { ok: true, value: model };
      }

      if (error instanceof SyntaxError) {
        return {
          ok: false,
          error: createWorkspaceError(
            'WORKSPACE_INVALID_STATE',
            `Workspace model contains malformed JSON at ${modelPath}`
          ),
        };
      }

      return {
        ok: false,
        error: mapWorkspaceError(error, `Unable to read workspace at ${rootPath}`),
      };
    }
  }

  private async loadByWorkspaceId(workspaceId: string): Promise<OpenWorkspaceResponse> {
    const rootPath = this.workspaceRootById.get(workspaceId);
    if (!rootPath) {
      return {
        ok: false,
        error: createWorkspaceError(
          'WORKSPACE_NOT_FOUND',
          `Workspace ${workspaceId} is not loaded`
        ),
      };
    }

    const loaded = await this.readWorkspaceModel(rootPath);
    if (!loaded.ok) {
      return loaded;
    }

    if (loaded.value.workspace.id !== workspaceId) {
      return {
        ok: false,
        error: createWorkspaceError(
          'WORKSPACE_INVALID_STATE',
          `Workspace id mismatch for ${workspaceId}`
        ),
      };
    }

    return loaded;
  }

  public async openWorkspace(request: OpenWorkspaceRequest): Promise<OpenWorkspaceResponse> {
    try {
      const stats = await fs.stat(request.rootPath);
      if (!stats.isDirectory()) {
        return {
          ok: false,
          error: createWorkspaceError(
            'WORKSPACE_NOT_FOUND',
            `Workspace root is not a directory: ${request.rootPath}`
          ),
        };
      }
    } catch (error) {
      return {
        ok: false,
        error: mapWorkspaceError(error, `Workspace root does not exist: ${request.rootPath}`),
      };
    }

    return this.readWorkspaceModel(request.rootPath);
  }

  public async saveWorkspace(request: SaveWorkspaceRequest): Promise<SaveWorkspaceResponse> {
    const parsed = WorkspaceModelSchema.safeParse(request.model);
    if (!parsed.success) {
      return {
        ok: false,
        error: createWorkspaceError('WORKSPACE_INVALID_STATE', 'Workspace model failed validation'),
      };
    }

    try {
      await this.persistWorkspaceModel(parsed.data);
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: mapWorkspaceError(error, 'Unable to save workspace model') };
    }
  }

  public async createProject(request: CreateProjectRequest): Promise<CreateProjectResponse> {
    const loaded = await this.loadByWorkspaceId(request.workspaceId);
    if (!loaded.ok) {
      return { ok: false, error: loaded.error };
    }

    const timestamp = new Date().toISOString();
    const project = {
      id: randomUUID(),
      workspaceId: request.workspaceId,
      name: request.name,
      rootPath: request.rootPath,
      documentIds: request.documentIds,
      activeDocumentId: request.activeDocumentId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const updatedModel: WorkspaceModel = {
      ...loaded.value,
      workspace: {
        ...loaded.value.workspace,
        updatedAt: timestamp,
      },
      projects: [...loaded.value.projects, project],
    };

    try {
      await this.persistWorkspaceModel(updatedModel);
      return { ok: true, value: project };
    } catch (error) {
      return { ok: false, error: mapWorkspaceError(error, 'Unable to persist project') };
    }
  }

  public async addLink(request: AddLinkRequest): Promise<AddLinkResponse> {
    const loaded = await this.loadByWorkspaceId(request.workspaceId);
    if (!loaded.ok) {
      return { ok: false, error: loaded.error };
    }

    const link = request.link;

    // Verify the target document exists in the workspace before adding the link
    if (link.targetDocumentId !== null) {
      const targetExists = loaded.value.workspace.documents.some(
        (document) => document.id === link.targetDocumentId
      );
      if (!targetExists) {
        return {
          ok: false,
          error: createWorkspaceError(
            'WORKSPACE_INVALID_STATE',
            `Target document not found: ${link.targetDocumentId}`
          ),
        };
      }
    }

    const timestamp = new Date().toISOString();
    const linkIndex = buildUpdatedLinkIndex(loaded.value.linkIndex, link, timestamp);
    const updatedModel: WorkspaceModel = {
      ...loaded.value,
      workspace: { ...loaded.value.workspace, updatedAt: timestamp },
      linkIndex,
    };

    try {
      await this.persistWorkspaceModel(updatedModel);
      return { ok: true, value: link };
    } catch (error) {
      return { ok: false, error: mapWorkspaceError(error, 'Unable to persist workspace link') };
    }
  }

  public async getBacklinks(request: GetBacklinksRequest): Promise<GetBacklinksResponse> {
    const loaded = await this.loadByWorkspaceId(request.workspaceId);
    if (!loaded.ok) {
      return { ok: false, error: loaded.error };
    }

    const backlinks: LinkRecord[] = [
      ...(loaded.value.linkIndex[request.documentId]?.incoming ?? []),
    ];
    return {
      ok: true,
      value: backlinks,
    };
  }

  public async queryMetadataCollection(
    request: QueryMetadataCollectionRequest
  ): Promise<QueryMetadataCollectionResponse> {
    const loaded = await this.loadByWorkspaceId(request.workspaceId);
    if (!loaded.ok) {
      return { ok: false, error: loaded.error };
    }

    try {
      const index = await this.buildCollectionIndex(loaded.value, request.documentIds);
      const documents = index.queryCollection({
        filters: request.filters as readonly FileIndexCollectionFilter[],
        ...(request.limit !== undefined ? { limit: request.limit } : {}),
      });
      const results: MetadataCollectionDocument[] = documents.map((document) => ({
        id: document.id,
        filePath: document.filePath,
        title: document.title,
        slug: document.slug,
        tags: [...document.tags],
        snippet: document.snippet,
        frontmatter: { ...document.frontmatter },
        indexedAt: document.indexedAt,
      }));
      return { ok: true, value: results };
    } catch (error) {
      return { ok: false, error: mapWorkspaceError(error, 'Unable to query metadata collection') };
    }
  }

  public async aggregateMetadataCollection(
    request: AggregateMetadataCollectionRequest
  ): Promise<AggregateMetadataCollectionResponse> {
    const loaded = await this.loadByWorkspaceId(request.workspaceId);
    if (!loaded.ok) {
      return { ok: false, error: loaded.error };
    }

    try {
      const index = await this.buildCollectionIndex(loaded.value, request.documentIds);
      const aggregate = index.aggregateCollection({
        field: request.field,
        operation: request.operation,
        filters: request.filters as readonly FileIndexCollectionFilter[],
        ...(request.histogramBinSize !== undefined
          ? { histogramBinSize: request.histogramBinSize }
          : {}),
      });
      return { ok: true, value: aggregate };
    } catch (error) {
      return {
        ok: false,
        error: mapWorkspaceError(error, 'Unable to aggregate metadata collection'),
      };
    }
  }
}
