/**
 * Application Shell Contracts
 *
 * Zod schemas for document state, UI layout, and status bar types.
 * These contracts define the data shapes for Application Shell stores
 * and are used for validation at runtime boundaries.
 *
 * @module specs/006-application-shell/contracts/shell-schemas
 */

import { z } from 'zod';

// =============================================================================
// BRANDED TYPES
// =============================================================================

/**
 * Branded type for document identifiers.
 * Uses UUID v4 format.
 */
export const DocumentIdSchema = z
  .string()
  .uuid()
  .brand<'DocumentId'>();

export type DocumentId = z.infer<typeof DocumentIdSchema>;

// =============================================================================
// DOCUMENT STATE SCHEMAS
// =============================================================================

/**
 * File handle schema - returned from file operations.
 */
export const FileHandleSchema = z.object({
  fileId: DocumentIdSchema,
  filePath: z.string().min(1),
  mtime: z.number().positive(),
});

export type FileHandle = z.infer<typeof FileHandleSchema>;

/**
 * Document state schema - complete document state.
 */
export const DocumentStateSchema = z.object({
  fileId: DocumentIdSchema.nullable(),
  filePath: z.string().nullable(),
  fileName: z.string().min(1),
  content: z.string(),
  savedContent: z.string(),
  isDirty: z.boolean(),
  lastKnownMtime: z.number().positive().nullable(),
});

export type DocumentState = z.infer<typeof DocumentStateSchema>;

/**
 * Initial document state for new/untitled documents.
 */
export const INITIAL_DOCUMENT_STATE: DocumentState = {
  fileId: null,
  filePath: null,
  fileName: 'Untitled',
  content: '',
  savedContent: '',
  isDirty: false,
  lastKnownMtime: null,
};

// =============================================================================
// EXTERNAL MODIFICATION SCHEMAS
// =============================================================================

/**
 * External file modification check result.
 */
export const ExternalModificationCheckSchema = z.object({
  modified: z.boolean(),
  newMtime: z.number().positive().nullable(),
});

export type ExternalModificationCheck = z.infer<typeof ExternalModificationCheckSchema>;

/**
 * External file change event (from IPC).
 */
export const ExternalFileChangeEventSchema = z.object({
  path: z.string().min(1),
  newMtime: z.number().positive(),
});

export type ExternalFileChangeEvent = z.infer<typeof ExternalFileChangeEventSchema>;

// =============================================================================
// UI LAYOUT SCHEMAS
// =============================================================================

/**
 * Split ratio constraint: 0.1 to 0.9 (10% to 90%).
 * This ensures minimum 10% width for each pane.
 * At 1000px width, 10% = 100px = minimum required by FR-003.
 */
export const SplitRatioSchema = z.number().min(0.1).max(0.9);

export type SplitRatio = z.infer<typeof SplitRatioSchema>;

/**
 * Zoom level constraint: 50 to 200.
 */
export const ZoomLevelSchema = z.number().int().min(50).max(200);

export type ZoomLevel = z.infer<typeof ZoomLevelSchema>;

/**
 * UI layout persisted state schema.
 */
export const UILayoutPersistedSchema = z.object({
  previewVisible: z.boolean(),
  zoomLevel: ZoomLevelSchema,
  splitRatio: SplitRatioSchema,
});

export type UILayoutPersisted = z.infer<typeof UILayoutPersistedSchema>;

/**
 * Default UI layout values.
 */
export const DEFAULT_UI_LAYOUT: UILayoutPersisted = {
  previewVisible: true,
  zoomLevel: 100,
  splitRatio: 0.5,
};

// =============================================================================
// STATUS BAR SCHEMAS
// =============================================================================

/**
 * Cursor position schema (1-indexed).
 */
export const CursorPositionSchema = z.object({
  line: z.number().int().positive(),
  column: z.number().int().positive(),
});

export type CursorPosition = z.infer<typeof CursorPositionSchema>;

/**
 * Compilation error schema.
 */
export const CompilationErrorSchema = z.object({
  message: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
});

export type CompilationError = z.infer<typeof CompilationErrorSchema>;

/**
 * Array of compilation errors.
 */
export const CompilationErrorsSchema = z.array(CompilationErrorSchema);

export type CompilationErrors = z.infer<typeof CompilationErrorsSchema>;

// =============================================================================
// DIRTY CHECK SCHEMAS
// =============================================================================

/**
 * Dirty check action types.
 */
export const DirtyCheckActionSchema = z.enum(['close', 'open', 'new']);

export type DirtyCheckAction = z.infer<typeof DirtyCheckActionSchema>;

/**
 * Dirty check result types.
 */
export const DirtyCheckResultSchema = z.enum(['save', 'discard', 'cancel']);

export type DirtyCheckResult = z.infer<typeof DirtyCheckResultSchema>;

// =============================================================================
// LOCALSTORAGE KEYS
// =============================================================================

/**
 * localStorage keys for UI layout persistence.
 * Extends existing STORAGE_KEYS from command-schemas.
 */
export const SHELL_STORAGE_KEYS = {
  splitRatio: 'mdxpad:ui:split-ratio',
} as const;

// =============================================================================
// IPC CHANNELS
// =============================================================================

/**
 * IPC channels for Application Shell.
 * Following mdxpad:<domain>:<action> naming convention.
 */
export const SHELL_IPC_CHANNELS = {
  /** Check if file was modified externally */
  checkFileModification: 'mdxpad:file:check-modification',
  /** External file change notification (from main to renderer) */
  externalFileChange: 'mdxpad:file:external-change',
} as const;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Parse and validate a split ratio, clamping to valid range.
 * @param value - Raw value to validate
 * @returns Clamped split ratio between 0.1 and 0.9
 */
export function parseSplitRatio(value: unknown): SplitRatio {
  if (typeof value !== 'number' || isNaN(value)) {
    return DEFAULT_UI_LAYOUT.splitRatio;
  }
  return Math.max(0.1, Math.min(0.9, value)) as SplitRatio;
}

/**
 * Parse and validate zoom level, clamping to valid range.
 * @param value - Raw value to validate
 * @returns Clamped zoom level between 50 and 200
 */
export function parseZoomLevel(value: unknown): ZoomLevel {
  if (typeof value !== 'number' || isNaN(value)) {
    return DEFAULT_UI_LAYOUT.zoomLevel;
  }
  return Math.max(50, Math.min(200, Math.round(value))) as ZoomLevel;
}

/**
 * Safe parse for UILayoutPersisted from localStorage.
 * Returns default values for invalid data.
 * @param data - Raw data from localStorage
 * @returns Validated UI layout state
 */
export function parseUILayoutPersisted(data: unknown): UILayoutPersisted {
  const result = UILayoutPersistedSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  return DEFAULT_UI_LAYOUT;
}

/**
 * Validate a document state snapshot.
 * Throws if invalid.
 * @param state - State to validate
 * @returns Validated state
 */
export function validateDocumentState(state: unknown): DocumentState {
  return DocumentStateSchema.parse(state);
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Check if a document is untitled (not yet saved).
 * @param state - Document state
 */
export function isUntitled(state: DocumentState): boolean {
  return state.filePath === null;
}

/**
 * Check if a document has unsaved changes.
 * @param state - Document state
 */
export function isDirty(state: DocumentState): boolean {
  return state.content !== state.savedContent;
}
