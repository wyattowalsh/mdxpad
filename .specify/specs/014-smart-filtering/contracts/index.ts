/**
 * Smart Filtering Contracts
 *
 * Barrel export for all Smart Filtering contract definitions.
 *
 * Feature: 014-smart-filtering
 * @module contracts
 */

// =============================================================================
// FILTER SCHEMAS
// =============================================================================

export {
  // Constants
  FILTER_QUERY_MAX_LENGTH,
  FILTER_STORAGE_KEY_PREFIX,
  FILTER_DEBOUNCE_MS,

  // Schemas
  FilterQuerySchema,
  MatchPositionsSchema,
  MatchScoreSchema,
  MatchResultSchema,
  FilterStateSchema,
  PersistedFilterDataSchema,
  FilterHighlightSegmentSchema,

  // Types
  type FilterQuery,
  type MatchPositions,
  type MatchScore,
  type MatchResult,
  type FilterState,
  type PersistedFilterData,
  type FilterHighlightSegment,

  // Default values
  DEFAULT_FILTER_STATE,

  // Utility functions
  fnv1aHash,
  getFilterStorageKey,
  parseFilterQuery,
  parsePersistedFilterData,
  parseFilterState,
  positionsToSegments,
} from './filter-schemas';

// =============================================================================
// FILTER COMMANDS
// =============================================================================

export {
  // Command IDs
  FILTER_COMMAND_IDS,

  // Shortcuts
  FILTER_FOCUS_SHORTCUT,
  FILTER_CLEAR_SHORTCUT,

  // Events
  FILTER_EVENTS,
  type FilterFocusEvent,
  type FilterClearEvent,

  // Command definitions
  focusFilterCommand,
  clearFilterCommand,
  FILTER_COMMANDS,

  // Registration helpers
  type RegisterFunction,
  type UnregisterFunction,
  registerFilterCommands,

  // Event listener helpers
  onFilterFocus,
  onFilterClear,
} from './filter-commands';
