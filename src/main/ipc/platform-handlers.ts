import type { BrowserWindow, IpcMain } from 'electron';

import { IPC_CHANNELS } from '@shared/lib/ipc';
import { createValidatedHandler } from '@shared/contracts/file-schemas';
import {
  CloudSyncConnectRequestSchema,
  CloudSyncConnectResponseSchema,
  CloudSyncListProvidersRequestSchema,
  CloudSyncListProvidersResponseSchema,
  CloudSyncPullRequestSchema,
  CloudSyncPullResponseSchema,
  CloudSyncPushRequestSchema,
  CloudSyncPushResponseSchema,
  CloudSyncStatusRequestSchema,
  CloudSyncStatusResponseSchema,
  CollaborationAddCommentRequestSchema,
  CollaborationAddCommentResponseSchema,
  CollaborationAddSuggestionRequestSchema,
  CollaborationAddSuggestionResponseSchema,
  CollaborationApplySuggestionRequestSchema,
  CollaborationApplySuggestionResponseSchema,
  CollaborationListRequestSchema,
  CollaborationListResponseSchema,
  CollaborationResolveThreadRequestSchema,
  CollaborationResolveThreadResponseSchema,
  ExtensionInstallRequestSchema,
  ExtensionInstallResponseSchema,
  ExtensionListRequestSchema,
  ExtensionListResponseSchema,
  ExtensionSetPermissionRequestSchema,
  ExtensionSetPermissionResponseSchema,
  PublishBacklinksRequestSchema,
  PublishBacklinksResponseSchema,
  PublishListProvenanceRequestSchema,
  PublishListProvenanceResponseSchema,
  PublishRequestSchema,
  PublishResponseSchema,
} from '@shared/contracts/platform-schemas';
import { assertAuthorizedIpcSender } from './ipc-sender-authorization';
import { CloudSyncService } from '@main/services/cloud-sync-service';
import { CollaborationService } from '@main/services/collaboration-service';
import { ExtensionPlatformService } from '@main/services/extension-platform-service';
import { PublishProvenanceService } from '@main/services/publish-provenance-service';

let cloudSyncService: CloudSyncService | null = null;
let collaborationService: CollaborationService | null = null;
let extensionPlatformService: ExtensionPlatformService | null = null;
let publishProvenanceService: PublishProvenanceService | null = null;

function getCloudSyncService(): CloudSyncService {
  cloudSyncService ??= new CloudSyncService();
  return cloudSyncService;
}

function getCollaborationService(): CollaborationService {
  collaborationService ??= new CollaborationService();
  return collaborationService;
}

function getExtensionPlatformService(): ExtensionPlatformService {
  extensionPlatformService ??= new ExtensionPlatformService();
  return extensionPlatformService;
}

function getPublishProvenanceService(): PublishProvenanceService {
  publishProvenanceService ??= new PublishProvenanceService();
  return publishProvenanceService;
}

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

function registerVoidChannel(
  ipcMainInstance: IpcMain,
  window: BrowserWindow,
  channel: string,
  handler: InvokeHandler
): void {
  ipcMainInstance.handle(channel, (event) => {
    assertAuthorizedIpcSender(event, window, channel);
    return handler(undefined);
  });
}

const handleSyncListProviders = createValidatedHandler(
  CloudSyncListProvidersRequestSchema,
  async () =>
    CloudSyncListProvidersResponseSchema.parse({
      providers: await getCloudSyncService().listProviders(),
    })
);

const handleSyncConnect = createValidatedHandler(CloudSyncConnectRequestSchema, async (args) =>
  CloudSyncConnectResponseSchema.parse(await getCloudSyncService().connectProvider(args.providerId))
);

const handleSyncStatus = createValidatedHandler(CloudSyncStatusRequestSchema, async (args) =>
  CloudSyncStatusResponseSchema.parse(await getCloudSyncService().getStatus(args.providerId))
);

const handleSyncPush = createValidatedHandler(CloudSyncPushRequestSchema, async (args) =>
  CloudSyncPushResponseSchema.parse(await getCloudSyncService().pushDocument(args))
);

const handleSyncPull = createValidatedHandler(CloudSyncPullRequestSchema, async (args) =>
  CloudSyncPullResponseSchema.parse(await getCloudSyncService().pullDocument(args))
);

const handleCollaborationList = createValidatedHandler(
  CollaborationListRequestSchema,
  async (args) =>
    CollaborationListResponseSchema.parse(await getCollaborationService().list(args.documentId))
);

const handleCollaborationAddComment = createValidatedHandler(
  CollaborationAddCommentRequestSchema,
  async (args) =>
    CollaborationAddCommentResponseSchema.parse(await getCollaborationService().addComment(args))
);

const handleCollaborationResolveThread = createValidatedHandler(
  CollaborationResolveThreadRequestSchema,
  async (args) =>
    CollaborationResolveThreadResponseSchema.parse(
      await getCollaborationService().resolveThread(args)
    )
);

const handleCollaborationAddSuggestion = createValidatedHandler(
  CollaborationAddSuggestionRequestSchema,
  async (args) =>
    CollaborationAddSuggestionResponseSchema.parse(
      await getCollaborationService().addSuggestion(args)
    )
);

const handleCollaborationApplySuggestion = createValidatedHandler(
  CollaborationApplySuggestionRequestSchema,
  async (args) =>
    CollaborationApplySuggestionResponseSchema.parse(
      await getCollaborationService().applySuggestion(args)
    )
);

const handleExtensionList = createValidatedHandler(ExtensionListRequestSchema, async () =>
  ExtensionListResponseSchema.parse({
    extensions: await getExtensionPlatformService().listExtensions(),
  })
);

const handleExtensionInstall = createValidatedHandler(ExtensionInstallRequestSchema, async (args) =>
  ExtensionInstallResponseSchema.parse(await getExtensionPlatformService().installExtension(args))
);

const handleExtensionSetPermission = createValidatedHandler(
  ExtensionSetPermissionRequestSchema,
  async (args) =>
    ExtensionSetPermissionResponseSchema.parse(
      await getExtensionPlatformService().setPermission(args)
    )
);

const handlePublishRun = createValidatedHandler(PublishRequestSchema, async (args) =>
  PublishResponseSchema.parse(await getPublishProvenanceService().publish(args))
);

const handlePublishListProvenance = createValidatedHandler(
  PublishListProvenanceRequestSchema,
  async (args) =>
    PublishListProvenanceResponseSchema.parse({
      records: await getPublishProvenanceService().listProvenance(args.sourcePath),
    })
);

const handlePublishGetBacklinks = createValidatedHandler(
  PublishBacklinksRequestSchema,
  async (args) =>
    PublishBacklinksResponseSchema.parse({
      records: await getPublishProvenanceService().getBacklinks(args.canonicalUrl),
    })
);

function registerSyncHandlers(ipcMainInstance: IpcMain, window: BrowserWindow): void {
  registerVoidChannel(
    ipcMainInstance,
    window,
    IPC_CHANNELS.sync.listProviders,
    handleSyncListProviders
  );
  registerChannel(ipcMainInstance, window, IPC_CHANNELS.sync.connectProvider, handleSyncConnect);
  registerChannel(ipcMainInstance, window, IPC_CHANNELS.sync.status, handleSyncStatus);
  registerChannel(ipcMainInstance, window, IPC_CHANNELS.sync.pushDocument, handleSyncPush);
  registerChannel(ipcMainInstance, window, IPC_CHANNELS.sync.pullDocument, handleSyncPull);
}

function registerCollaborationHandlers(ipcMainInstance: IpcMain, window: BrowserWindow): void {
  registerChannel(
    ipcMainInstance,
    window,
    IPC_CHANNELS.collaboration.list,
    handleCollaborationList
  );
  registerChannel(
    ipcMainInstance,
    window,
    IPC_CHANNELS.collaboration.addComment,
    handleCollaborationAddComment
  );
  registerChannel(
    ipcMainInstance,
    window,
    IPC_CHANNELS.collaboration.resolveThread,
    handleCollaborationResolveThread
  );
  registerChannel(
    ipcMainInstance,
    window,
    IPC_CHANNELS.collaboration.addSuggestion,
    handleCollaborationAddSuggestion
  );
  registerChannel(
    ipcMainInstance,
    window,
    IPC_CHANNELS.collaboration.applySuggestion,
    handleCollaborationApplySuggestion
  );
}

function registerExtensionHandlers(ipcMainInstance: IpcMain, window: BrowserWindow): void {
  registerVoidChannel(ipcMainInstance, window, IPC_CHANNELS.extension.list, handleExtensionList);
  registerChannel(ipcMainInstance, window, IPC_CHANNELS.extension.install, handleExtensionInstall);
  registerChannel(
    ipcMainInstance,
    window,
    IPC_CHANNELS.extension.setPermission,
    handleExtensionSetPermission
  );
}

function registerPublishHandlers(ipcMainInstance: IpcMain, window: BrowserWindow): void {
  registerChannel(ipcMainInstance, window, IPC_CHANNELS.publish.run, handlePublishRun);
  registerChannel(
    ipcMainInstance,
    window,
    IPC_CHANNELS.publish.listProvenance,
    handlePublishListProvenance
  );
  registerChannel(
    ipcMainInstance,
    window,
    IPC_CHANNELS.publish.getBacklinks,
    handlePublishGetBacklinks
  );
}

export function registerPlatformHandlers(ipcMainInstance: IpcMain, window: BrowserWindow): void {
  registerSyncHandlers(ipcMainInstance, window);
  registerCollaborationHandlers(ipcMainInstance, window);
  registerExtensionHandlers(ipcMainInstance, window);
  registerPublishHandlers(ipcMainInstance, window);
}
