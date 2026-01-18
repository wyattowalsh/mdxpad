/**
 * Autosave & Recovery Zod Schemas
 *
 * Contract definitions for autosave and crash recovery functionality.
 * All types validated with zod per Constitution Article III.3.
 *
 * @module contracts/autosave-schemas
 */

import { z } from 'zod';

// ============================================================================
// Base Types
// ============================================================================

/**
 * Document identifier schema.
 * UUID v4 format with branded type for type safety.
 */
export const DocumentIdSchema = z.string().uuid().brand<'DocumentId'>();

/** Inferred DocumentId type */
export type DocumentId = z.infer<typeof DocumentIdSchema>;

// ============================================================================
// Autosave Settings
// ============================================================================

/**
 * Autosave configuration settings schema.
 * Per FR-009: interval range 5s to 10min.
 * Per FR-010: enable/disable support.
 * Per FR-011: settings persist across restarts.
 */
export const AutosaveSettingsSchema = z.object({
  /** Whether autosave is enabled (FR-010) */
  enabled: z.boolean(),
  /** Autosave interval in milliseconds (FR-009: 5000-600000) */
  intervalMs: z.number().int().min(5000).max(600000),
  /** Days to retain recovery files before auto-cleanup */
  retentionDays: z.number().int().min(1).max(365),
  /** Maximum number of recovery files to store */
  maxFiles: z.number().int().min(5).max(200),
  /** Maximum total storage in megabytes */
  maxStorageMB: z.number().min(10).max(1000),
});

/** Inferred AutosaveSettings type */
export type AutosaveSettings = z.infer<typeof AutosaveSettingsSchema>;

/**
 * Default autosave settings.
 * Per Constitution VII.3: minimum every 30 seconds if dirty.
 */
export const DEFAULT_AUTOSAVE_SETTINGS: AutosaveSettings = {
  enabled: true,
  intervalMs: 30_000, // 30 seconds
  retentionDays: 30,
  maxFiles: 50,
  maxStorageMB: 100,
};

// ============================================================================
// Recovery File
// ============================================================================

/**
 * Recovery file schema.
 * Represents a single autosaved document snapshot.
 * Per FR-001: content saved to recovery location.
 * Per FR-015: uses atomic write pattern.
 */
export const RecoveryFileSchema = z.object({
  /** Schema version for migration support */
  version: z.literal(1),
  /** Document identifier (links to DocumentState.fileId) */
  documentId: DocumentIdSchema,
  /** Original file path, null for untitled documents */
  filePath: z.string().nullable(),
  /** Display name for recovery dialog */
  fileName: z.string().min(1),
  /** Full document content at autosave time */
  content: z.string(),
  /** Unix timestamp (ms) when autosave occurred */
  savedAt: z.number().int().positive(),
  /** SHA-256 checksum of content for integrity verification */
  checksum: z.string().length(64),
});

/** Inferred RecoveryFile type */
export type RecoveryFile = z.infer<typeof RecoveryFileSchema>;

// ============================================================================
// Recovery Manifest
// ============================================================================

/**
 * Manifest entry schema.
 * Lightweight reference to a recovery file for fast enumeration.
 */
export const ManifestEntrySchema = z.object({
  /** Document identifier */
  documentId: DocumentIdSchema,
  /** Original file path, null for untitled */
  filePath: z.string().nullable(),
  /** Display name for recovery dialog */
  fileName: z.string().min(1),
  /** Unix timestamp (ms) when autosave occurred */
  savedAt: z.number().int().positive(),
  /** Relative path to recovery file (e.g., "{documentId}.json") */
  recoveryFilePath: z.string().min(1),
});

/** Inferred ManifestEntry type */
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

/**
 * Recovery manifest schema.
 * Index of all recoverable documents.
 * Per FR-003: detect on startup whether recovery data exists.
 */
export const RecoveryManifestSchema = z.object({
  /** Schema version for migration support */
  version: z.literal(1),
  /** Map of documentId to manifest entry */
  entries: z.record(z.string(), ManifestEntrySchema),
});

/** Inferred RecoveryManifest type */
export type RecoveryManifest = z.infer<typeof RecoveryManifestSchema>;

/**
 * Empty recovery manifest constant.
 */
export const EMPTY_RECOVERY_MANIFEST: RecoveryManifest = {
  version: 1,
  entries: {},
};

// ============================================================================
// Recovery Dialog Types
// ============================================================================

/**
 * Recovery dialog entry for UI display.
 * Per FR-004: display recovery dialog.
 * Per FR-005: allow preview of recoverable content.
 * Per FR-016: display conflict indicator when source file modified.
 */
export const RecoveryDialogEntrySchema = z.object({
  /** Document identifier */
  documentId: DocumentIdSchema,
  /** Display name for the document */
  fileName: z.string().min(1),
  /** Original file path for context, null for untitled */
  filePath: z.string().nullable(),
  /** Timestamp when autosaved */
  savedAt: z.number(),
  /** Content preview (first N characters) for FR-005 */
  contentPreview: z.string(),
  /** Whether the recovery file passed integrity check */
  isValid: z.boolean(),
  /** Whether disk file was modified after recovery save (FR-016) */
  hasConflict: z.boolean(),
});

/** Inferred RecoveryDialogEntry type */
export type RecoveryDialogEntry = z.infer<typeof RecoveryDialogEntrySchema>;

/**
 * User's recovery decision.
 * Per FR-006: restore selected documents.
 * Per FR-007: explicit decline required to discard.
 */
export const RecoveryDecisionSchema = z.discriminatedUnion('action', [
  /** User accepted recovery for selected documents */
  z.object({
    action: z.literal('accept'),
    selectedIds: z.array(DocumentIdSchema),
  }),
  /** User explicitly declined all recovery */
  z.object({
    action: z.literal('decline'),
  }),
  /** User dismissed dialog without decision (preserve data) */
  z.object({
    action: z.literal('dismiss'),
  }),
]);

/** Inferred RecoveryDecision type */
export type RecoveryDecision = z.infer<typeof RecoveryDecisionSchema>;

// ============================================================================
// Conflict Resolution Types
// ============================================================================

/**
 * Conflict information for FR-016.
 * When source file was modified externally.
 */
export const FileConflictSchema = z.object({
  /** Document identifier */
  documentId: DocumentIdSchema,
  /** Path to the conflicting file */
  filePath: z.string(),
  /** Content from recovery file */
  recoveryContent: z.string(),
  /** Content currently on disk */
  diskContent: z.string(),
  /** When recovery content was saved */
  recoveryTimestamp: z.number(),
  /** When disk file was modified */
  diskModifiedAt: z.number(),
});

/** Inferred FileConflict type */
export type FileConflict = z.infer<typeof FileConflictSchema>;

/**
 * Conflict resolution choice.
 */
export const ConflictResolutionSchema = z.discriminatedUnion('choice', [
  /** Keep recovery version */
  z.object({
    choice: z.literal('recovery'),
    documentId: DocumentIdSchema,
  }),
  /** Keep disk version */
  z.object({
    choice: z.literal('disk'),
    documentId: DocumentIdSchema,
  }),
  /** Save recovery as new file */
  z.object({
    choice: z.literal('save-as'),
    documentId: DocumentIdSchema,
    newPath: z.string(),
  }),
]);

/** Inferred ConflictResolution type */
export type ConflictResolution = z.infer<typeof ConflictResolutionSchema>;

// ============================================================================
// Autosave Status Types
// ============================================================================

/**
 * Autosave status for UI indicator.
 * Per FR-013: failure notification strategy.
 */
export const AutosaveStatusSchema = z.discriminatedUnion('status', [
  /** Autosave idle, no pending saves */
  z.object({
    status: z.literal('idle'),
  }),
  /** Autosave in progress */
  z.object({
    status: z.literal('saving'),
  }),
  /** Last autosave succeeded */
  z.object({
    status: z.literal('saved'),
    savedAt: z.number(),
  }),
  /** Autosave failed (per FR-013: show indicator) */
  z.object({
    status: z.literal('failed'),
    consecutiveFailures: z.number().int().min(1),
    lastError: z.string(),
  }),
]);

/** Inferred AutosaveStatus type */
export type AutosaveStatus = z.infer<typeof AutosaveStatusSchema>;

/**
 * Threshold for showing toast notification.
 * Per FR-013: toast after 3 consecutive failures.
 */
export const FAILURE_TOAST_THRESHOLD = 3;
