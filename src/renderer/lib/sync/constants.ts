/**
 * Sync Constants
 *
 * Feature: 008-bidirectional-sync
 * Centralized constants for bidirectional preview sync functionality.
 */

// =============================================================================
// Performance Constants
// =============================================================================

/**
 * Performance constants for sync operations.
 * Centralized for consistency across implementation.
 */
export const SYNC_CONSTANTS = {
  /** Debounce delay before triggering synchronized scroll (ms) */
  SYNC_DEBOUNCE_MS: 50,

  /** Duration of smooth scroll animation (ms) */
  SCROLL_ANIMATION_MS: 150,

  /** Time-to-live for cached position mappings (ms) */
  POSITION_CACHE_TTL_MS: 1000,

  /** Minimum line change to trigger sync (prevents micro-syncs) */
  SYNC_THRESHOLD_LINES: 3,

  /** Percentage of viewport height for scroll margin */
  SCROLL_MARGIN_PERCENT: 10,

  /** Duration for sync toggle notification (ms) */
  NOTIFICATION_DURATION_MS: 2000,
} as const;

// =============================================================================
// Storage Keys
// =============================================================================

/**
 * localStorage keys for sync settings persistence.
 */
export const SYNC_STORAGE_KEYS = {
  /** Key for persisting current sync mode */
  mode: 'mdxpad:sync:mode',

  /** Key for persisting last active (non-disabled) mode */
  lastActiveMode: 'mdxpad:sync:last-active-mode',
} as const;

// =============================================================================
// Display Labels
// =============================================================================

/**
 * Human-readable display labels for sync modes.
 * Used in UI components like the command palette and status indicators.
 */
export const SYNC_MODE_LABELS = {
  /** Label for disabled sync mode */
  disabled: 'Disabled',

  /** Label for editor-to-preview sync mode */
  editorToPreview: 'Editor → Preview',

  /** Label for preview-to-editor sync mode */
  previewToEditor: 'Preview → Editor',

  /** Label for bidirectional sync mode */
  bidirectional: 'Bidirectional',
} as const;
