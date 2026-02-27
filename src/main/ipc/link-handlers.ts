import type { BrowserWindow, IpcMain } from 'electron';

import { createValidatedHandler } from '@shared/contracts/file-schemas';
import {
  AddLinkRequestSchema,
  AddLinkResponseSchema,
  GetBacklinksRequestSchema,
  GetBacklinksResponseSchema,
} from '@shared/contracts/workspace-schemas';
import { IPC_CHANNELS } from '@shared/lib/ipc';
import { WorkspaceService } from '@main/services/workspace-service';
import { assertAuthorizedIpcSender } from './ipc-sender-authorization';

export const WORKSPACE_LINK_CHANNELS = {
  addLink: IPC_CHANNELS.workspace.addLink,
  getBacklinks: IPC_CHANNELS.workspace.getBacklinks,
} as const;

type WorkspaceLinkHandlerService = Pick<WorkspaceService, 'addLink' | 'getBacklinks'>;

type InvokeHandler = (args: unknown) => Promise<unknown>;

function registerChannel(
  ipcMainInstance: IpcMain,
  window: BrowserWindow,
  channel: string,
  handler: InvokeHandler
): void {
  ipcMainInstance.handle(channel, (event, args) => {
    assertAuthorizedIpcSender(event, window, channel);
    return handler(args);
  });
}

export function registerLinkHandlers(
  ipcMainInstance: IpcMain,
  window: BrowserWindow,
  workspaceService: WorkspaceLinkHandlerService = new WorkspaceService()
): void {
  const handleAddLink = createValidatedHandler(AddLinkRequestSchema, async (args) =>
    AddLinkResponseSchema.parse(await workspaceService.addLink(args))
  );

  const handleGetBacklinks = createValidatedHandler(GetBacklinksRequestSchema, async (args) =>
    GetBacklinksResponseSchema.parse(await workspaceService.getBacklinks(args))
  );

  registerChannel(ipcMainInstance, window, WORKSPACE_LINK_CHANNELS.addLink, handleAddLink);
  registerChannel(
    ipcMainInstance,
    window,
    WORKSPACE_LINK_CHANNELS.getBacklinks,
    handleGetBacklinks
  );
}
