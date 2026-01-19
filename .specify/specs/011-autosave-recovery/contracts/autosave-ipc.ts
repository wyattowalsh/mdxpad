/**
 * Autosave & Recovery IPC Contracts
 *
 * IPC channel definitions for autosave and crash recovery.
 * Per Constitution Article III.3:
 * - Channel naming: mdxpad:<domain>:<action>
 * - invoke/handle pattern for request/response
 * - All payloads validated with zod on both ends
 *
 * @module contracts/autosave-ipc
 */

import { z } from 'zod';
import {
  DocumentIdSchema,
  AutosaveSettingsSchema,
  RecoveryDialogEntrySchema,
  RecoveryDecisionSchema,
  AutosaveStatusSchema,
  FileConflictSchema,
  ConflictResolutionSchema,
} from './autosave-schemas';

// ============================================================================
// IPC Channel Names
// ============================================================================

/**
 * Autosave IPC channels.
 * Per Constitution III.3: mdxpad:<domain>:<action>
 */
export const AutosaveChannels = {
  // Recovery operations
  RECOVERY_CHECK: 'mdxpad:recovery:check',
  RECOVERY_LIST: 'mdxpad:recovery:list',
  RECOVERY_RESTORE: 'mdxpad:recovery:restore',
  RECOVERY_DISCARD: 'mdxpad:recovery:discard',
  RECOVERY_PREVIEW: 'mdxpad:recovery:preview',

  // Autosave operations
  AUTOSAVE_TRIGGER: 'mdxpad:autosave:trigger',
  AUTOSAVE_STATUS: 'mdxpad:autosave:status',

  // Settings
  SETTINGS_GET: 'mdxpad:autosave:settings:get',
  SETTINGS_SET: 'mdxpad:autosave:settings:set',

  // Conflict resolution
  CONFLICT_RESOLVE: 'mdxpad:recovery:conflict:resolve',
} as const;

export type AutosaveChannel = (typeof AutosaveChannels)[keyof typeof AutosaveChannels];

// ============================================================================
// Recovery Check (FR-003)
// ============================================================================

/**
 * mdxpad:recovery:check request schema.
 * Called on app startup to detect recoverable documents.
 */
export const RecoveryCheckRequestSchema = z.void();

/**
 * mdxpad:recovery:check response schema.
 * Returns whether recovery data exists.
 */
export const RecoveryCheckResponseSchema = z.object({
  hasRecoveryData: z.boolean(),
  count: z.number().int().nonnegative(),
});

export type RecoveryCheckResponse = z.infer<typeof RecoveryCheckResponseSchema>;

// ============================================================================
// Recovery List (FR-004, FR-005)
// ============================================================================

/**
 * mdxpad:recovery:list request schema.
 * Retrieves list of recoverable documents for dialog.
 */
export const RecoveryListRequestSchema = z.void();

/**
 * mdxpad:recovery:list response schema.
 * Returns entries for recovery dialog (SC-003: within 2 seconds).
 */
export const RecoveryListResponseSchema = z.object({
  entries: z.array(RecoveryDialogEntrySchema),
});

export type RecoveryListResponse = z.infer<typeof RecoveryListResponseSchema>;

// ============================================================================
// Recovery Preview (FR-005)
// ============================================================================

/**
 * mdxpad:recovery:preview request schema.
 * Fetches full content for preview.
 */
export const RecoveryPreviewRequestSchema = z.object({
  documentId: DocumentIdSchema,
});

export type RecoveryPreviewRequest = z.infer<typeof RecoveryPreviewRequestSchema>;

/**
 * mdxpad:recovery:preview response schema.
 * Returns full content and conflict info if applicable.
 */
export const RecoveryPreviewResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    content: z.string(),
    conflict: FileConflictSchema.nullable(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.enum(['NOT_FOUND', 'CORRUPTED', 'READ_ERROR']),
  }),
]);

export type RecoveryPreviewResponse = z.infer<typeof RecoveryPreviewResponseSchema>;

// ============================================================================
// Recovery Restore (FR-006)
// ============================================================================

/**
 * mdxpad:recovery:restore request schema.
 * Restores selected documents.
 */
export const RecoveryRestoreRequestSchema = z.object({
  decision: RecoveryDecisionSchema,
});

export type RecoveryRestoreRequest = z.infer<typeof RecoveryRestoreRequestSchema>;

/**
 * Restored document info for renderer.
 */
export const RestoredDocumentSchema = z.object({
  documentId: DocumentIdSchema,
  filePath: z.string().nullable(),
  fileName: z.string(),
  content: z.string(),
});

export type RestoredDocument = z.infer<typeof RestoredDocumentSchema>;

/**
 * mdxpad:recovery:restore response schema.
 * Returns restored documents to open in editor.
 */
export const RecoveryRestoreResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    restored: z.array(RestoredDocumentSchema),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
]);

export type RecoveryRestoreResponse = z.infer<typeof RecoveryRestoreResponseSchema>;

// ============================================================================
// Recovery Discard (FR-007)
// ============================================================================

/**
 * mdxpad:recovery:discard request schema.
 * Called after explicit decline or successful manual save (FR-008).
 */
export const RecoveryDiscardRequestSchema = z.object({
  documentIds: z.array(DocumentIdSchema),
});

export type RecoveryDiscardRequest = z.infer<typeof RecoveryDiscardRequestSchema>;

/**
 * mdxpad:recovery:discard response schema.
 */
export const RecoveryDiscardResponseSchema = z.object({
  discardedCount: z.number().int().nonnegative(),
});

export type RecoveryDiscardResponse = z.infer<typeof RecoveryDiscardResponseSchema>;

// ============================================================================
// Autosave Trigger (FR-001)
// ============================================================================

/**
 * mdxpad:autosave:trigger request schema.
 * Renderer requests autosave when dirty.
 */
export const AutosaveTriggerRequestSchema = z.object({
  documentId: DocumentIdSchema,
  filePath: z.string().nullable(),
  fileName: z.string(),
  content: z.string(),
});

export type AutosaveTriggerRequest = z.infer<typeof AutosaveTriggerRequestSchema>;

/**
 * mdxpad:autosave:trigger response schema.
 * Per FR-015: uses atomic write pattern.
 */
export const AutosaveTriggerResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    savedAt: z.number(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.enum(['DISK_FULL', 'PERMISSION_DENIED', 'WRITE_ERROR']),
    message: z.string(),
  }),
]);

export type AutosaveTriggerResponse = z.infer<typeof AutosaveTriggerResponseSchema>;

// ============================================================================
// Autosave Status (FR-013)
// ============================================================================

/**
 * mdxpad:autosave:status request schema.
 * Gets current autosave status for UI indicator.
 */
export const AutosaveStatusRequestSchema = z.void();

/**
 * mdxpad:autosave:status response schema.
 */
export const AutosaveStatusResponseSchema = AutosaveStatusSchema;

// ============================================================================
// Settings Get/Set (FR-009, FR-010, FR-011)
// ============================================================================

/**
 * mdxpad:autosave:settings:get request schema.
 */
export const SettingsGetRequestSchema = z.void();

/**
 * mdxpad:autosave:settings:get response schema.
 */
export const SettingsGetResponseSchema = AutosaveSettingsSchema;

/**
 * mdxpad:autosave:settings:set request schema.
 * Partial update - only provided fields are changed.
 */
export const SettingsSetRequestSchema = AutosaveSettingsSchema.partial();

export type SettingsSetRequest = z.infer<typeof SettingsSetRequestSchema>;

/**
 * mdxpad:autosave:settings:set response schema.
 * Returns updated settings (SC-005: takes effect immediately).
 */
export const SettingsSetResponseSchema = AutosaveSettingsSchema;

// ============================================================================
// Conflict Resolution (FR-016)
// ============================================================================

/**
 * mdxpad:recovery:conflict:resolve request schema.
 */
export const ConflictResolveRequestSchema = z.object({
  resolution: ConflictResolutionSchema,
});

export type ConflictResolveRequest = z.infer<typeof ConflictResolveRequestSchema>;

/**
 * mdxpad:recovery:conflict:resolve response schema.
 */
export const ConflictResolveResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
]);

export type ConflictResolveResponse = z.infer<typeof ConflictResolveResponseSchema>;

// ============================================================================
// IPC Schema Registry
// ============================================================================

/**
 * Type-safe schema registry for all autosave IPC channels.
 */
export const AUTOSAVE_IPC_SCHEMAS = {
  [AutosaveChannels.RECOVERY_CHECK]: {
    request: RecoveryCheckRequestSchema,
    response: RecoveryCheckResponseSchema,
  },
  [AutosaveChannels.RECOVERY_LIST]: {
    request: RecoveryListRequestSchema,
    response: RecoveryListResponseSchema,
  },
  [AutosaveChannels.RECOVERY_PREVIEW]: {
    request: RecoveryPreviewRequestSchema,
    response: RecoveryPreviewResponseSchema,
  },
  [AutosaveChannels.RECOVERY_RESTORE]: {
    request: RecoveryRestoreRequestSchema,
    response: RecoveryRestoreResponseSchema,
  },
  [AutosaveChannels.RECOVERY_DISCARD]: {
    request: RecoveryDiscardRequestSchema,
    response: RecoveryDiscardResponseSchema,
  },
  [AutosaveChannels.AUTOSAVE_TRIGGER]: {
    request: AutosaveTriggerRequestSchema,
    response: AutosaveTriggerResponseSchema,
  },
  [AutosaveChannels.AUTOSAVE_STATUS]: {
    request: AutosaveStatusRequestSchema,
    response: AutosaveStatusResponseSchema,
  },
  [AutosaveChannels.SETTINGS_GET]: {
    request: SettingsGetRequestSchema,
    response: SettingsGetResponseSchema,
  },
  [AutosaveChannels.SETTINGS_SET]: {
    request: SettingsSetRequestSchema,
    response: SettingsSetResponseSchema,
  },
  [AutosaveChannels.CONFLICT_RESOLVE]: {
    request: ConflictResolveRequestSchema,
    response: ConflictResolveResponseSchema,
  },
} as const;

export type AutosaveIpcSchemas = typeof AUTOSAVE_IPC_SCHEMAS;
