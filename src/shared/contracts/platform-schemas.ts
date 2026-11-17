/**
 * Platform contracts for cloud sync, collaboration, extensions, and publishing.
 *
 * These schemas define IPC boundaries for fleet wave 3/4 capabilities.
 *
 * @module shared/contracts/platform-schemas
 */

import { z } from 'zod';

// ============================================================================
// Safe Document ID (path-traversal-safe, used where documentId becomes a filename)
// ============================================================================

/**
 * Document ID schema safe for use in filesystem paths.
 * Rejects path traversal sequences (..), null bytes, and path separators.
 * HR-3 audit (2026-03-01): Added because CollaborationService and CloudSyncService
 * use documentId in path.join() to construct filesystem paths.
 */
export const SafeDocumentIdSchema = z
  .string()
  .min(1)
  .refine((val) => !val.includes('..'), { message: 'documentId must not contain ".."' })
  .refine((val) => !val.includes('\0'), { message: 'documentId must not contain null bytes' })
  .refine((val) => !val.includes('/') && !val.includes('\\'), {
    message: 'documentId must not contain path separators',
  });

// ============================================================================
// Cloud Sync
// ============================================================================

export const CloudSyncProviderIdSchema = z.enum([
  'mock-cloud',
  'github',
  'dropbox',
  'onedrive',
  'git-remote',
  'custom',
]);
export type CloudSyncProviderId = z.infer<typeof CloudSyncProviderIdSchema>;

export const CloudSyncCapabilitiesSchema = z.object({
  deltaPull: z.boolean(),
  remoteLocking: z.boolean(),
  etag: z.boolean(),
  revisions: z.boolean(),
  webhooks: z.boolean(),
});
export type CloudSyncCapabilities = z.infer<typeof CloudSyncCapabilitiesSchema>;

export const CloudSyncProviderSchema = z.object({
  id: CloudSyncProviderIdSchema,
  label: z.string().min(1),
  connected: z.boolean(),
  capabilities: CloudSyncCapabilitiesSchema,
});
export type CloudSyncProvider = z.infer<typeof CloudSyncProviderSchema>;

export const CloudSyncStatusStateSchema = z.enum([
  'idle',
  'syncing',
  'offline',
  'error',
  'conflicted',
]);
export type CloudSyncStatusState = z.infer<typeof CloudSyncStatusStateSchema>;

export const CloudSyncStatusSchema = z.object({
  state: CloudSyncStatusStateSchema,
  lastSyncAt: z.number().int().nonnegative().nullable(),
  message: z.string().nullable(),
});
export type CloudSyncStatus = z.infer<typeof CloudSyncStatusSchema>;

export const CloudSyncListProvidersRequestSchema = z.void();
export const CloudSyncListProvidersResponseSchema = z.object({
  providers: z.array(CloudSyncProviderSchema),
});
export type CloudSyncListProvidersResponse = z.infer<typeof CloudSyncListProvidersResponseSchema>;

export const CloudSyncConnectRequestSchema = z.object({
  providerId: CloudSyncProviderIdSchema,
});
export type CloudSyncConnectRequest = z.infer<typeof CloudSyncConnectRequestSchema>;

export const CloudSyncConnectResponseSchema = z.object({
  ok: z.boolean(),
  status: CloudSyncStatusSchema,
});
export type CloudSyncConnectResponse = z.infer<typeof CloudSyncConnectResponseSchema>;

export const CloudSyncStatusRequestSchema = z.object({
  providerId: CloudSyncProviderIdSchema,
});
export type CloudSyncStatusRequest = z.infer<typeof CloudSyncStatusRequestSchema>;

export const CloudSyncStatusResponseSchema = CloudSyncStatusSchema;
export type CloudSyncStatusResponse = z.infer<typeof CloudSyncStatusResponseSchema>;

export const CloudSyncPushRequestSchema = z.object({
  providerId: CloudSyncProviderIdSchema,
  documentId: SafeDocumentIdSchema,
  filePath: z.string().min(1),
  content: z.string(),
  baseRevision: z.number().int().nonnegative().optional(),
});
export type CloudSyncPushRequest = z.infer<typeof CloudSyncPushRequestSchema>;

export const CloudSyncPushResponseSchema = z.object({
  ok: z.boolean(),
  revision: z.number().int().nonnegative(),
  checksum: z.string().min(1),
  conflicts: z.array(z.string()),
});
export type CloudSyncPushResponse = z.infer<typeof CloudSyncPushResponseSchema>;

export const CloudSyncPullRequestSchema = z.object({
  providerId: CloudSyncProviderIdSchema,
  documentId: SafeDocumentIdSchema,
});
export type CloudSyncPullRequest = z.infer<typeof CloudSyncPullRequestSchema>;

export const CloudSyncPullResponseSchema = z.object({
  ok: z.boolean(),
  content: z.string().nullable(),
  revision: z.number().int().nonnegative().nullable(),
  checksum: z.string().nullable(),
});
export type CloudSyncPullResponse = z.infer<typeof CloudSyncPullResponseSchema>;

// ============================================================================
// Collaboration Primitives
// ============================================================================

export const CollaborationStateSchema = z.enum(['open', 'resolved', 'outdated']);
export type CollaborationState = z.infer<typeof CollaborationStateSchema>;

export const CollaborationAnchorSchema = z.object({
  blockId: z.string().min(1),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  headingPath: z.array(z.string()),
  fingerprint: z.string().optional(),
});
export type CollaborationAnchor = z.infer<typeof CollaborationAnchorSchema>;

export const CollaborationMessageSchema = z.object({
  id: z.string().min(1),
  author: z.string().min(1),
  message: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
});
export type CollaborationMessage = z.infer<typeof CollaborationMessageSchema>;

export const CollaborationThreadSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
  anchor: CollaborationAnchorSchema,
  state: CollaborationStateSchema,
  messages: z.array(CollaborationMessageSchema),
  updatedAt: z.number().int().nonnegative(),
});
export type CollaborationThread = z.infer<typeof CollaborationThreadSchema>;

export const SuggestionStateSchema = z.enum(['open', 'accepted', 'rejected', 'outdated']);
export type SuggestionState = z.infer<typeof SuggestionStateSchema>;

export const CollaborationSuggestionSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
  anchor: CollaborationAnchorSchema,
  patch: z.string().min(1),
  rationale: z.string().min(1),
  author: z.string().min(1),
  baseChecksum: z.string().min(1),
  state: SuggestionStateSchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type CollaborationSuggestion = z.infer<typeof CollaborationSuggestionSchema>;

export const CollaborationListRequestSchema = z.object({
  documentId: SafeDocumentIdSchema,
});
export type CollaborationListRequest = z.infer<typeof CollaborationListRequestSchema>;

export const CollaborationListResponseSchema = z.object({
  threads: z.array(CollaborationThreadSchema),
  suggestions: z.array(CollaborationSuggestionSchema),
});
export type CollaborationListResponse = z.infer<typeof CollaborationListResponseSchema>;

export const CollaborationAddCommentRequestSchema = z.object({
  documentId: SafeDocumentIdSchema,
  threadId: z.string().min(1).optional(),
  anchor: CollaborationAnchorSchema,
  author: z.string().min(1),
  message: z.string().min(1),
});
export type CollaborationAddCommentRequest = z.infer<typeof CollaborationAddCommentRequestSchema>;

export const CollaborationAddCommentResponseSchema = z.object({
  thread: CollaborationThreadSchema,
});
export type CollaborationAddCommentResponse = z.infer<typeof CollaborationAddCommentResponseSchema>;

export const CollaborationResolveThreadRequestSchema = z.object({
  documentId: SafeDocumentIdSchema,
  threadId: z.string().min(1),
  resolved: z.boolean(),
});
export type CollaborationResolveThreadRequest = z.infer<
  typeof CollaborationResolveThreadRequestSchema
>;

export const CollaborationResolveThreadResponseSchema = z.object({
  thread: CollaborationThreadSchema,
});
export type CollaborationResolveThreadResponse = z.infer<
  typeof CollaborationResolveThreadResponseSchema
>;

export const CollaborationAddSuggestionRequestSchema = z.object({
  documentId: SafeDocumentIdSchema,
  anchor: CollaborationAnchorSchema,
  patch: z.string().min(1),
  rationale: z.string().min(1),
  author: z.string().min(1),
  baseChecksum: z.string().min(1),
});
export type CollaborationAddSuggestionRequest = z.infer<
  typeof CollaborationAddSuggestionRequestSchema
>;

export const CollaborationAddSuggestionResponseSchema = z.object({
  suggestion: CollaborationSuggestionSchema,
});
export type CollaborationAddSuggestionResponse = z.infer<
  typeof CollaborationAddSuggestionResponseSchema
>;

export const CollaborationApplySuggestionRequestSchema = z.object({
  documentId: SafeDocumentIdSchema,
  suggestionId: z.string().min(1),
  currentChecksum: z.string().min(1),
});
export type CollaborationApplySuggestionRequest = z.infer<
  typeof CollaborationApplySuggestionRequestSchema
>;

export const CollaborationApplySuggestionResponseSchema = z.object({
  ok: z.boolean(),
  outdated: z.boolean(),
  applied: z.literal(false),
  suggestion: CollaborationSuggestionSchema,
});
export type CollaborationApplySuggestionResponse = z.infer<
  typeof CollaborationApplySuggestionResponseSchema
>;

// ============================================================================
// Extension Platform
// ============================================================================

export const ExtensionPermissionStateSchema = z.enum(['granted', 'prompt', 'denied']);
export type ExtensionPermissionState = z.infer<typeof ExtensionPermissionStateSchema>;

export const ExtensionCapabilityValueSchema = z.union([z.boolean(), z.array(z.string().min(1))]);
export type ExtensionCapabilityValue = z.infer<typeof ExtensionCapabilityValueSchema>;

export const ExtensionManifestSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9._-]+$/),
  name: z.string().min(1),
  version: z.string().min(1),
  entrypoint: z.string().min(1),
  capabilities: z.record(ExtensionCapabilityValueSchema),
});
export type ExtensionManifest = z.infer<typeof ExtensionManifestSchema>;

export const ExtensionRuntimeStateSchema = z.enum([
  'discovered',
  'validated',
  'installed',
  'loaded',
  'activated',
  'running',
  'deactivated',
  'unloaded',
  'removed',
  'disabled',
]);
export type ExtensionRuntimeState = z.infer<typeof ExtensionRuntimeStateSchema>;

export const ExtensionRecordSchema = z.object({
  manifest: ExtensionManifestSchema,
  checksum: z.string().min(1),
  state: ExtensionRuntimeStateSchema,
  installedAt: z.number().int().nonnegative(),
  permissions: z.record(ExtensionPermissionStateSchema),
});
export type ExtensionRecord = z.infer<typeof ExtensionRecordSchema>;

export const ExtensionListRequestSchema = z.void();
export const ExtensionListResponseSchema = z.object({
  extensions: z.array(ExtensionRecordSchema),
});
export type ExtensionListResponse = z.infer<typeof ExtensionListResponseSchema>;

export const ExtensionInstallRequestSchema = z.object({
  manifest: ExtensionManifestSchema,
  checksum: z.string().min(1).optional(),
});
export type ExtensionInstallRequest = z.infer<typeof ExtensionInstallRequestSchema>;

export const ExtensionInstallResponseSchema = z.object({
  ok: z.boolean(),
  extension: ExtensionRecordSchema.optional(),
  error: z.string().optional(),
});
export type ExtensionInstallResponse = z.infer<typeof ExtensionInstallResponseSchema>;

export const ExtensionSetPermissionRequestSchema = z.object({
  extensionId: z.string().min(1),
  capability: z.string().min(1),
  state: ExtensionPermissionStateSchema,
});
export type ExtensionSetPermissionRequest = z.infer<typeof ExtensionSetPermissionRequestSchema>;

export const ExtensionSetPermissionResponseSchema = z.object({
  ok: z.boolean(),
  extension: ExtensionRecordSchema.optional(),
  error: z.string().optional(),
});
export type ExtensionSetPermissionResponse = z.infer<typeof ExtensionSetPermissionResponseSchema>;

// ============================================================================
// Publishing + Provenance
// ============================================================================

export const PublishProviderIdSchema = z.enum(['filesystem-export']);
export type PublishProviderId = z.infer<typeof PublishProviderIdSchema>;

export const BacklinkRecordSchema = z.object({
  sourceUrl: z.string().min(1),
  targetUrl: z.string().min(1),
  relation: z.enum(['references', 'derived-from']),
});
export type BacklinkRecord = z.infer<typeof BacklinkRecordSchema>;

export const ProvenanceRecordSchema = z.object({
  eventId: z.string().min(1),
  timestamp: z.string().min(1),
  actor: z.object({
    type: z.enum(['user', 'extension', 'system']),
    id: z.string().min(1),
  }),
  sourceDocument: z.object({
    path: z.string().min(1),
    checksum: z.string().min(1),
  }),
  transformationChain: z.array(
    z.object({
      step: z.string().min(1),
      actorId: z.string().min(1),
      inputChecksum: z.string().min(1),
      outputChecksum: z.string().min(1),
    })
  ),
  publishTarget: z.object({
    providerId: PublishProviderIdSchema,
    artifactId: z.string().min(1),
    canonicalUrl: z.string().min(1),
  }),
  backlinks: z.array(BacklinkRecordSchema),
});
export type ProvenanceRecord = z.infer<typeof ProvenanceRecordSchema>;

export const PublishRequestSchema = z.object({
  providerId: PublishProviderIdSchema.default('filesystem-export'),
  sourcePath: z.string().nullable().optional(),
  content: z.string(),
  frontmatter: z.record(z.unknown()).optional(),
});
export type PublishRequest = z.infer<typeof PublishRequestSchema>;

export const PublishResponseSchema = z.object({
  ok: z.boolean(),
  canonicalUrl: z.string().min(1),
  artifactId: z.string().min(1),
  checksum: z.string().min(1),
  provenanceEventId: z.string().min(1),
  backlinks: z.array(BacklinkRecordSchema),
});
export type PublishResponse = z.infer<typeof PublishResponseSchema>;

export const PublishListProvenanceRequestSchema = z.object({
  sourcePath: z.string().optional(),
});
export type PublishListProvenanceRequest = z.infer<typeof PublishListProvenanceRequestSchema>;

export const PublishListProvenanceResponseSchema = z.object({
  records: z.array(ProvenanceRecordSchema),
});
export type PublishListProvenanceResponse = z.infer<typeof PublishListProvenanceResponseSchema>;

export const PublishBacklinksRequestSchema = z.object({
  canonicalUrl: z.string().min(1),
});
export type PublishBacklinksRequest = z.infer<typeof PublishBacklinksRequestSchema>;

export const PublishBacklinksResponseSchema = z.object({
  records: z.array(BacklinkRecordSchema),
});
export type PublishBacklinksResponse = z.infer<typeof PublishBacklinksResponseSchema>;
