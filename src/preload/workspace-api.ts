/**
 * Workspace API Module
 *
 * Provides workspace lifecycle and link graph operations for renderer process.
 * All methods use validated IPC invoke with Zod schemas on both ends.
 *
 * @module src/preload/workspace-api
 */

import {
  AggregateMetadataCollectionRequestSchema,
  AggregateMetadataCollectionResponseSchema,
  AddLinkRequestSchema,
  AddLinkResponseSchema,
  CreateProjectRequestSchema,
  CreateProjectResponseSchema,
  GetBacklinksRequestSchema,
  GetBacklinksResponseSchema,
  OpenWorkspaceRequestSchema,
  OpenWorkspaceResponseSchema,
  QueryMetadataCollectionRequestSchema,
  QueryMetadataCollectionResponseSchema,
  SaveWorkspaceRequestSchema,
  SaveWorkspaceResponseSchema,
  type AggregateMetadataCollectionRequest,
  type AggregateMetadataCollectionResponse,
  type AddLinkRequest,
  type AddLinkResponse,
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
} from '@shared/contracts/workspace-schemas';
import { IPC_CHANNELS } from '@shared/lib/ipc';

import { validatedInvoke } from './validated-invoke';

export interface WorkspaceApi {
  openWorkspace(request: OpenWorkspaceRequest): Promise<OpenWorkspaceResponse>;
  saveWorkspace(request: SaveWorkspaceRequest): Promise<SaveWorkspaceResponse>;
  createProject(request: CreateProjectRequest): Promise<CreateProjectResponse>;
  addLink(request: AddLinkRequest): Promise<AddLinkResponse>;
  getBacklinks(request: GetBacklinksRequest): Promise<GetBacklinksResponse>;
  queryMetadataCollection(
    request: QueryMetadataCollectionRequest
  ): Promise<QueryMetadataCollectionResponse>;
  aggregateMetadataCollection(
    request: AggregateMetadataCollectionRequest
  ): Promise<AggregateMetadataCollectionResponse>;
}

export const workspaceApi: WorkspaceApi = {
  openWorkspace: (request) =>
    validatedInvoke(
      IPC_CHANNELS.workspace.open,
      OpenWorkspaceRequestSchema,
      OpenWorkspaceResponseSchema,
      request
    ),
  saveWorkspace: (request) =>
    validatedInvoke(
      IPC_CHANNELS.workspace.save,
      SaveWorkspaceRequestSchema,
      SaveWorkspaceResponseSchema,
      request
    ),
  createProject: (request) =>
    validatedInvoke(
      IPC_CHANNELS.workspace.createProject,
      CreateProjectRequestSchema,
      CreateProjectResponseSchema,
      request
    ),
  addLink: (request) =>
    validatedInvoke(
      IPC_CHANNELS.workspace.addLink,
      AddLinkRequestSchema,
      AddLinkResponseSchema,
      request
    ),
  getBacklinks: (request) =>
    validatedInvoke(
      IPC_CHANNELS.workspace.getBacklinks,
      GetBacklinksRequestSchema,
      GetBacklinksResponseSchema,
      request
    ),
  queryMetadataCollection: (request) =>
    validatedInvoke(
      IPC_CHANNELS.workspace.queryMetadataCollection,
      QueryMetadataCollectionRequestSchema,
      QueryMetadataCollectionResponseSchema,
      request
    ),
  aggregateMetadataCollection: (request) =>
    validatedInvoke(
      IPC_CHANNELS.workspace.aggregateMetadataCollection,
      AggregateMetadataCollectionRequestSchema,
      AggregateMetadataCollectionResponseSchema,
      request
    ),
};
