import type { BrowserWindow, IpcMain } from 'electron';

import { WorkspaceService } from '@main/services/workspace-service';
import { createValidatedHandler } from '@shared/contracts/file-schemas';
// Re-export for backward compatibility with existing consumers
export { WorkspaceChannels } from '@shared/contracts/workspace-schemas';

import {
  WorkspaceChannels,
  AggregateMetadataCollectionRequestSchema,
  AggregateMetadataCollectionResponseSchema,
  CreateProjectRequestSchema,
  CreateProjectResponseSchema,
  OpenWorkspaceRequestSchema,
  OpenWorkspaceResponseSchema,
  QueryMetadataCollectionRequestSchema,
  QueryMetadataCollectionResponseSchema,
  SaveWorkspaceRequestSchema,
  SaveWorkspaceResponseSchema,
} from '@shared/contracts/workspace-schemas';
import { assertAuthorizedIpcSender } from './ipc-sender-authorization';

type WorkspaceHandlerService = Pick<
  WorkspaceService,
  | 'openWorkspace'
  | 'saveWorkspace'
  | 'createProject'
  | 'queryMetadataCollection'
  | 'aggregateMetadataCollection'
>;

function registerAuthorizedHandler(
  ipcMainInstance: IpcMain,
  window: BrowserWindow,
  channel: string,
  handler: (args: unknown) => Promise<unknown>
): void {
  ipcMainInstance.handle(channel, (event, args) => {
    assertAuthorizedIpcSender(event, window, channel);
    return handler(args);
  });
}

export function registerWorkspaceHandlers(
  ipcMainInstance: IpcMain,
  window: BrowserWindow,
  workspaceService: WorkspaceHandlerService = new WorkspaceService()
): void {
  const handleOpenWorkspace = createValidatedHandler(OpenWorkspaceRequestSchema, async (args) =>
    OpenWorkspaceResponseSchema.parse(await workspaceService.openWorkspace(args))
  );

  const handleSaveWorkspace = createValidatedHandler(SaveWorkspaceRequestSchema, async (args) =>
    SaveWorkspaceResponseSchema.parse(await workspaceService.saveWorkspace(args))
  );

  const handleCreateProject = createValidatedHandler(CreateProjectRequestSchema, async (args) =>
    CreateProjectResponseSchema.parse(await workspaceService.createProject(args))
  );

  const handleQueryMetadataCollection = createValidatedHandler(
    QueryMetadataCollectionRequestSchema,
    async (args) =>
      QueryMetadataCollectionResponseSchema.parse(
        await workspaceService.queryMetadataCollection(args)
      )
  );

  const handleAggregateMetadataCollection = createValidatedHandler(
    AggregateMetadataCollectionRequestSchema,
    async (args) =>
      AggregateMetadataCollectionResponseSchema.parse(
        await workspaceService.aggregateMetadataCollection(args)
      )
  );

  registerAuthorizedHandler(ipcMainInstance, window, WorkspaceChannels.OPEN, handleOpenWorkspace);
  registerAuthorizedHandler(ipcMainInstance, window, WorkspaceChannels.SAVE, handleSaveWorkspace);
  registerAuthorizedHandler(
    ipcMainInstance,
    window,
    WorkspaceChannels.CREATE_PROJECT,
    handleCreateProject
  );
  registerAuthorizedHandler(
    ipcMainInstance,
    window,
    WorkspaceChannels.QUERY_METADATA_COLLECTION,
    handleQueryMetadataCollection
  );
  registerAuthorizedHandler(
    ipcMainInstance,
    window,
    WorkspaceChannels.AGGREGATE_METADATA_COLLECTION,
    handleAggregateMetadataCollection
  );
}
