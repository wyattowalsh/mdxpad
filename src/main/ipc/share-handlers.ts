/**
 * Share & Publish IPC handlers.
 * Handles all sharing and publishing IPC communication.
 * Per Constitution Article III.3: All payloads validated with zod on both ends.
 *
 * @module main/ipc/share-handlers
 */

import { dialog, shell, type IpcMain, type BrowserWindow } from 'electron';
import {
  ShareChannels,
  CreateShareLinkRequestSchema,
  RevokeShareLinkRequestSchema,
  GetShareLinksRequestSchema,
  MoveUntitledShareLinksRequestSchema,
  ReadShareRequestSchema,
  ReadShareResponseSchema,
  PublishRequestSchema,
  OpenDirectoryRequestSchema,
  OpenDirectoryResponseSchema,
  ChooseDirectoryResponseSchema,
  type CreateShareLinkResponse,
  type RevokeShareLinkResponse,
  type GetShareLinksResponse,
  type MoveUntitledShareLinksResponse,
  type ReadShareResponse,
  type PublishResponse,
} from '@shared/contracts/share-schemas';
import { createValidatedHandler } from '@shared/contracts/file-schemas';
import type { ShareLinkService } from '@main/services/share-link-service';
import { StaticSiteGenerator } from '@main/services/static-site-generator';
import {
  directoryWasChosen,
  publishScopeError,
  rememberChosenDirectory,
} from '@main/services/publish-scope';
import { registerAuthorizedIpcHandler } from './ipc-sender-authorization';

// ============================================================================
// Handler Factory
// ============================================================================

/**
 * Create the create share link handler.
 */
function createCreateLinkHandler(service: ShareLinkService) {
  return createValidatedHandler(
    CreateShareLinkRequestSchema,
    (args): Promise<CreateShareLinkResponse> => {
      const link = service.createLink({
        docId: args.docId,
        accessMode: args.accessMode,
        expiresInMs: args.expiresInMs,
        ...(args.content !== undefined ? { content: args.content } : {}),
      });

      return Promise.resolve({ success: true as const, link });
    }
  );
}

/**
 * Create the revoke share link handler.
 */
function createRevokeLinkHandler(service: ShareLinkService) {
  return createValidatedHandler(
    RevokeShareLinkRequestSchema,
    (args): Promise<RevokeShareLinkResponse> => {
      const revoked = service.revokeLink(args.id);
      if (!revoked) {
        return Promise.reject(new Error(`Share link ${args.id} not found`));
      }
      return Promise.resolve({ success: true as const });
    }
  );
}

/**
 * Create the get share links handler.
 */
function createGetLinksHandler(service: ShareLinkService) {
  return createValidatedHandler(
    GetShareLinksRequestSchema,
    (args): Promise<GetShareLinksResponse> => {
      const links = service.getLinks(args.docId);
      return Promise.resolve({ links: [...links] });
    }
  );
}

function createMoveUntitledHandler(service: ShareLinkService) {
  return createValidatedHandler(
    MoveUntitledShareLinksRequestSchema,
    (args): Promise<MoveUntitledShareLinksResponse> => {
      const links = service.moveUntitledDocument(args.fromDocId, args.toDocId);
      return Promise.resolve({ links: [...links] });
    }
  );
}

/**
 * Create the publish handler.
 */
function createPublishHandler(generator: StaticSiteGenerator, window: BrowserWindow) {
  return createValidatedHandler(PublishRequestSchema, async (args): Promise<PublishResponse> => {
    const scopeError = publishScopeError(args);
    if (scopeError !== null) {
      return {
        success: false,
        outputDir: args.outputDir,
        filesGenerated: 0,
        indexPath: null,
        errors: [scopeError],
      };
    }
    const result = await generator.generate(args, (progress) => {
      if (!window.isDestroyed()) {
        window.webContents.send(ShareChannels.PUBLISH_PROGRESS, progress);
      }
    });

    return result;
  });
}

// ============================================================================
// Registration
// ============================================================================

/**
 * Registers all share and publish IPC handlers.
 * Called during app initialization.
 *
 * @param ipcMainInstance - The Electron IpcMain instance
 * @param service - The share link service instance
 * @param window - The main BrowserWindow (for sending progress events)
 */
export function registerShareHandlers(
  ipcMainInstance: IpcMain,
  service: ShareLinkService,
  window: BrowserWindow
): void {
  const generator = new StaticSiteGenerator();

  const handleCreateLink = createCreateLinkHandler(service);
  const handleRevokeLink = createRevokeLinkHandler(service);
  const handleGetLinks = createGetLinksHandler(service);
  const handleMoveUntitled = createMoveUntitledHandler(service);
  const handlePublish = createPublishHandler(generator, window);
  const handleRead = createValidatedHandler(
    ReadShareRequestSchema,
    (args): Promise<ReadShareResponse> => {
      const result = service.readByToken(args.token);
      if (!result) {
        return Promise.resolve(ReadShareResponseSchema.parse({ ok: false }));
      }
      return Promise.resolve(ReadShareResponseSchema.parse({ ok: true, ...result }));
    }
  );

  registerAuthorizedIpcHandler(ipcMainInstance, window, ShareChannels.CREATE_LINK, (_event, args) =>
    handleCreateLink(args)
  );
  registerAuthorizedIpcHandler(ipcMainInstance, window, ShareChannels.REVOKE_LINK, (_event, args) =>
    handleRevokeLink(args)
  );
  registerAuthorizedIpcHandler(ipcMainInstance, window, ShareChannels.GET_LINKS, (_event, args) =>
    handleGetLinks(args)
  );
  registerAuthorizedIpcHandler(
    ipcMainInstance,
    window,
    ShareChannels.MOVE_UNTITLED,
    (_event, args) => handleMoveUntitled(args)
  );
  registerAuthorizedIpcHandler(ipcMainInstance, window, ShareChannels.READ, (_event, args) =>
    handleRead(args)
  );
  registerAuthorizedIpcHandler(ipcMainInstance, window, ShareChannels.PUBLISH, (_event, args) =>
    handlePublish(args)
  );
  registerDirectoryHandlers(ipcMainInstance, window);

  console.log('[ShareHandlers] All share and publish handlers registered');
}

function registerDirectoryHandlers(ipcMainInstance: IpcMain, window: BrowserWindow): void {
  registerAuthorizedIpcHandler(
    ipcMainInstance,
    window,
    ShareChannels.CHOOSE_DIRECTORY,
    async () => {
      const result = await dialog.showOpenDialog(window, {
        properties: ['openDirectory', 'createDirectory'],
      });
      const selected = result.canceled ? null : (result.filePaths[0] ?? null);
      if (selected !== null) {
        rememberChosenDirectory(selected);
      }
      return ChooseDirectoryResponseSchema.parse({
        canceled: result.canceled,
        path: selected,
      });
    }
  );
  registerAuthorizedIpcHandler(
    ipcMainInstance,
    window,
    ShareChannels.OPEN_DIRECTORY,
    async (_event, args) => {
      const request = OpenDirectoryRequestSchema.parse(args);
      if (!directoryWasChosen(request.path)) {
        return OpenDirectoryResponseSchema.parse({
          ok: false,
          error: 'Choose a folder before opening it',
        });
      }
      const error = await shell.openPath(request.path);
      return OpenDirectoryResponseSchema.parse(
        error.length === 0 ? { ok: true } : { ok: false, error }
      );
    }
  );
}
