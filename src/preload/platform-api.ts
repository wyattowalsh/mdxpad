import { IPC_CHANNELS } from '@shared/lib/ipc';
import {
  CloudSyncListProvidersResponseSchema,
  CloudSyncConnectRequestSchema,
  CloudSyncConnectResponseSchema,
  CloudSyncStatusRequestSchema,
  CloudSyncStatusResponseSchema,
  CloudSyncPushRequestSchema,
  CloudSyncPushResponseSchema,
  CloudSyncPullRequestSchema,
  CloudSyncPullResponseSchema,
  CollaborationListRequestSchema,
  CollaborationListResponseSchema,
  CollaborationAddCommentRequestSchema,
  CollaborationAddCommentResponseSchema,
  CollaborationResolveThreadRequestSchema,
  CollaborationResolveThreadResponseSchema,
  CollaborationAddSuggestionRequestSchema,
  CollaborationAddSuggestionResponseSchema,
  CollaborationApplySuggestionRequestSchema,
  CollaborationApplySuggestionResponseSchema,
  ExtensionListResponseSchema,
  ExtensionInstallRequestSchema,
  ExtensionInstallResponseSchema,
  ExtensionSetPermissionRequestSchema,
  ExtensionSetPermissionResponseSchema,
  PublishRequestSchema,
  PublishResponseSchema,
  PublishListProvenanceRequestSchema,
  PublishListProvenanceResponseSchema,
  PublishBacklinksRequestSchema,
  PublishBacklinksResponseSchema,
} from '@shared/contracts/platform-schemas';
import { validatedInvoke } from './validated-invoke';

export const syncApi = {
  listProviders: () =>
    validatedInvoke(IPC_CHANNELS.sync.listProviders, null, CloudSyncListProvidersResponseSchema),
  connectProvider: (providerId: string) =>
    validatedInvoke(
      IPC_CHANNELS.sync.connectProvider,
      CloudSyncConnectRequestSchema,
      CloudSyncConnectResponseSchema,
      { providerId }
    ),
  status: (providerId: string) =>
    validatedInvoke(
      IPC_CHANNELS.sync.status,
      CloudSyncStatusRequestSchema,
      CloudSyncStatusResponseSchema,
      { providerId }
    ),
  pushDocument: (request: unknown) =>
    validatedInvoke(
      IPC_CHANNELS.sync.pushDocument,
      CloudSyncPushRequestSchema,
      CloudSyncPushResponseSchema,
      request
    ),
  pullDocument: (request: unknown) =>
    validatedInvoke(
      IPC_CHANNELS.sync.pullDocument,
      CloudSyncPullRequestSchema,
      CloudSyncPullResponseSchema,
      request
    ),
};

export const collaborationApi = {
  list: (request: unknown) =>
    validatedInvoke(
      IPC_CHANNELS.collaboration.list,
      CollaborationListRequestSchema,
      CollaborationListResponseSchema,
      request
    ),
  addComment: (request: unknown) =>
    validatedInvoke(
      IPC_CHANNELS.collaboration.addComment,
      CollaborationAddCommentRequestSchema,
      CollaborationAddCommentResponseSchema,
      request
    ),
  resolveThread: (request: unknown) =>
    validatedInvoke(
      IPC_CHANNELS.collaboration.resolveThread,
      CollaborationResolveThreadRequestSchema,
      CollaborationResolveThreadResponseSchema,
      request
    ),
  addSuggestion: (request: unknown) =>
    validatedInvoke(
      IPC_CHANNELS.collaboration.addSuggestion,
      CollaborationAddSuggestionRequestSchema,
      CollaborationAddSuggestionResponseSchema,
      request
    ),
  // Records accepted or outdated. Does not change document bytes.
  applySuggestion: (request: unknown) =>
    validatedInvoke(
      IPC_CHANNELS.collaboration.applySuggestion,
      CollaborationApplySuggestionRequestSchema,
      CollaborationApplySuggestionResponseSchema,
      request
    ),
};

export const extensionPlatformApi = {
  list: () => validatedInvoke(IPC_CHANNELS.extension.list, null, ExtensionListResponseSchema),
  install: (request: unknown) =>
    validatedInvoke(
      IPC_CHANNELS.extension.install,
      ExtensionInstallRequestSchema,
      ExtensionInstallResponseSchema,
      request
    ),
  setPermission: (request: unknown) =>
    validatedInvoke(
      IPC_CHANNELS.extension.setPermission,
      ExtensionSetPermissionRequestSchema,
      ExtensionSetPermissionResponseSchema,
      request
    ),
};

export const publishApi = {
  run: (request: unknown) =>
    validatedInvoke(IPC_CHANNELS.publish.run, PublishRequestSchema, PublishResponseSchema, request),
  listProvenance: (request: unknown = {}) =>
    validatedInvoke(
      IPC_CHANNELS.publish.listProvenance,
      PublishListProvenanceRequestSchema,
      PublishListProvenanceResponseSchema,
      request
    ),
  getBacklinks: (canonicalUrl: string) =>
    validatedInvoke(
      IPC_CHANNELS.publish.getBacklinks,
      PublishBacklinksRequestSchema,
      PublishBacklinksResponseSchema,
      { canonicalUrl }
    ),
};
