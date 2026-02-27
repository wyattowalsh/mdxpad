/**
 * Version History IPC Zod Schemas
 *
 * Contract definitions for version history functionality.
 * All types validated with zod per Constitution Article III.3.
 *
 * @module contracts/history-schemas
 */

import { z } from 'zod';

// ============================================================================
// Channel Constants
// ============================================================================

/**
 * IPC channel constants for version history operations.
 */
export const HistoryChannels = {
  GET_HISTORY: 'mdxpad:history:get',
  GET_VERSION: 'mdxpad:history:get-version',
  RESTORE_VERSION: 'mdxpad:history:restore',
  CREATE_SNAPSHOT: 'mdxpad:history:create-snapshot',
} as const;

// ============================================================================
// Version Source Schema
// ============================================================================

/**
 * Source of a version entry.
 */
export const VersionSourceSchema = z.enum(['autosave', 'manual', 'git']);

/** Inferred VersionSource type */
export type VersionSource = z.infer<typeof VersionSourceSchema>;

// ============================================================================
// Version Entry Schema
// ============================================================================

/**
 * Schema for a single version history entry.
 */
export const VersionEntrySchema = z.object({
  /** Unique version identifier */
  id: z.string().min(1),
  /** Timestamp of when the version was created */
  timestamp: z.number().int().positive(),
  /** Source of this version */
  source: VersionSourceSchema,
  /** Optional user-provided label */
  label: z.string().optional(),
  /** Optional diff from previous version */
  diff: z.string().optional(),
});

/** Inferred VersionEntry type */
export type VersionEntry = z.infer<typeof VersionEntrySchema>;

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Schema for requesting version history of a file.
 */
export const VersionHistoryRequestSchema = z.object({
  /** Path to the file to get history for */
  filePath: z.string().min(1),
});

/** Inferred VersionHistoryRequest type */
export type VersionHistoryRequest = z.infer<typeof VersionHistoryRequestSchema>;

/**
 * Schema for requesting a specific version.
 */
export const GetVersionRequestSchema = z.object({
  /** Version identifier */
  id: z.string().min(1),
  /** File path for context */
  filePath: z.string().min(1),
});

/** Inferred GetVersionRequest type */
export type GetVersionRequest = z.infer<typeof GetVersionRequestSchema>;

/**
 * Schema for restoring a version.
 */
export const RestoreVersionRequestSchema = z.object({
  /** Version identifier to restore */
  id: z.string().min(1),
  /** File path to restore to */
  filePath: z.string().min(1),
  /** Whether to create a backup before restoring */
  createBackup: z.boolean().optional(),
});

/** Inferred RestoreVersionRequest type */
export type RestoreVersionRequest = z.infer<typeof RestoreVersionRequestSchema>;

/**
 * Schema for creating a manual snapshot.
 */
export const CreateSnapshotRequestSchema = z.object({
  /** File path to snapshot */
  filePath: z.string().min(1),
  /** Optional label for the snapshot */
  label: z.string().optional(),
});

/** Inferred CreateSnapshotRequest type */
export type CreateSnapshotRequest = z.infer<typeof CreateSnapshotRequestSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Schema for version history response.
 */
export const VersionHistoryResponseSchema = z.object({
  /** List of version entries */
  entries: z.array(VersionEntrySchema),
});

/** Inferred VersionHistoryResponse type */
export type VersionHistoryResponse = z.infer<typeof VersionHistoryResponseSchema>;

/**
 * Schema for get version response.
 */
export const GetVersionResponseSchema = z.object({
  /** The version content */
  content: z.string(),
  /** The version entry metadata */
  entry: VersionEntrySchema,
});

/** Inferred GetVersionResponse type */
export type GetVersionResponse = z.infer<typeof GetVersionResponseSchema>;

/**
 * Schema for restore version response.
 */
export const RestoreVersionResponseSchema = z.object({
  /** Whether the restore was successful */
  ok: z.boolean(),
  /** Restored content */
  content: z.string().optional(),
  /** Error message if restore failed */
  error: z.string().optional(),
});

/** Inferred RestoreVersionResponse type */
export type RestoreVersionResponse = z.infer<typeof RestoreVersionResponseSchema>;

/**
 * Schema for create snapshot response.
 */
export const CreateSnapshotResponseSchema = z.object({
  /** Whether the snapshot was created successfully */
  ok: z.boolean(),
  /** The created version entry */
  entry: VersionEntrySchema.optional(),
  /** Error message if creation failed */
  error: z.string().optional(),
});

/** Inferred CreateSnapshotResponse type */
export type CreateSnapshotResponse = z.infer<typeof CreateSnapshotResponseSchema>;
