/**
 * Workspace API Module
 *
 * Provides workspace lifecycle and link graph operations for renderer process.
 * All methods use validated IPC invoke with Zod schemas on both ends.
 *
 * @module src/preload/workspace-api
 */

import {
  WorkspaceChannels,
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
      WorkspaceChannels.OPEN,
      OpenWorkspaceRequestSchema,
      OpenWorkspaceResponseSchema,
      request
    ),
  saveWorkspace: (request) =>
    validatedInvoke(
      WorkspaceChannels.SAVE,
      SaveWorkspaceRequestSchema,
      SaveWorkspaceResponseSchema,
      request
    ),
  createProject: (request) =>
    validatedInvoke(
      WorkspaceChannels.CREATE_PROJECT,
      CreateProjectRequestSchema,
      CreateProjectResponseSchema,
      request
    ),
  addLink: (request) =>
    validatedInvoke(
      WorkspaceChannels.ADD_LINK,
      AddLinkRequestSchema,
      AddLinkResponseSchema,
      request
    ),
  getBacklinks: (request) =>
    validatedInvoke(
      WorkspaceChannels.GET_BACKLINKS,
      GetBacklinksRequestSchema,
      GetBacklinksResponseSchema,
      request
    ),
  queryMetadataCollection: (request) =>
    validatedInvoke(
      WorkspaceChannels.QUERY_METADATA_COLLECTION,
      QueryMetadataCollectionRequestSchema,
      QueryMetadataCollectionResponseSchema,
      request
    ),
  aggregateMetadataCollection: (request) =>
    validatedInvoke(
      WorkspaceChannels.AGGREGATE_METADATA_COLLECTION,
      AggregateMetadataCollectionRequestSchema,
      AggregateMetadataCollectionResponseSchema,
      request
    ),
};
