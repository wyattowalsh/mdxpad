/**
 * Autosave & Recovery Contracts
 *
 * Re-exports all contract definitions for autosave and crash recovery.
 *
 * @module contracts
 */

// Schemas and types
export {
  // Base types
  DocumentIdSchema,
  type DocumentId,

  // Settings
  AutosaveSettingsSchema,
  type AutosaveSettings,
  DEFAULT_AUTOSAVE_SETTINGS,

  // Recovery file
  RecoveryFileSchema,
  type RecoveryFile,

  // Manifest
  ManifestEntrySchema,
  type ManifestEntry,
  RecoveryManifestSchema,
  type RecoveryManifest,
  EMPTY_RECOVERY_MANIFEST,

  // Recovery dialog
  RecoveryDialogEntrySchema,
  type RecoveryDialogEntry,
  RecoveryDecisionSchema,
  type RecoveryDecision,

  // Conflict resolution
  FileConflictSchema,
  type FileConflict,
  ConflictResolutionSchema,
  type ConflictResolution,

  // Status
  AutosaveStatusSchema,
  type AutosaveStatus,
  FAILURE_TOAST_THRESHOLD,
} from './autosave-schemas';

// IPC contracts
export {
  // Channel names
  AutosaveChannels,
  type AutosaveChannel,

  // Recovery check
  RecoveryCheckRequestSchema,
  RecoveryCheckResponseSchema,
  type RecoveryCheckResponse,

  // Recovery list
  RecoveryListRequestSchema,
  RecoveryListResponseSchema,
  type RecoveryListResponse,

  // Recovery preview
  RecoveryPreviewRequestSchema,
  type RecoveryPreviewRequest,
  RecoveryPreviewResponseSchema,
  type RecoveryPreviewResponse,

  // Recovery restore
  RecoveryRestoreRequestSchema,
  type RecoveryRestoreRequest,
  RestoredDocumentSchema,
  type RestoredDocument,
  RecoveryRestoreResponseSchema,
  type RecoveryRestoreResponse,

  // Recovery discard
  RecoveryDiscardRequestSchema,
  type RecoveryDiscardRequest,
  RecoveryDiscardResponseSchema,
  type RecoveryDiscardResponse,

  // Autosave trigger
  AutosaveTriggerRequestSchema,
  type AutosaveTriggerRequest,
  AutosaveTriggerResponseSchema,
  type AutosaveTriggerResponse,

  // Autosave status
  AutosaveStatusRequestSchema,
  AutosaveStatusResponseSchema,

  // Settings
  SettingsGetRequestSchema,
  SettingsGetResponseSchema,
  SettingsSetRequestSchema,
  type SettingsSetRequest,
  SettingsSetResponseSchema,

  // Conflict resolution
  ConflictResolveRequestSchema,
  type ConflictResolveRequest,
  ConflictResolveResponseSchema,
  type ConflictResolveResponse,

  // Schema registry
  AUTOSAVE_IPC_SCHEMAS,
  type AutosaveIpcSchemas,
} from './autosave-ipc';
