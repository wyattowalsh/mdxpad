/**
 * Sync Feature Contracts
 *
 * Feature: 008-bidirectional-sync
 * Re-exports all contract types for the bidirectional sync feature.
 */

// =============================================================================
// Store Types
// =============================================================================

export type {
  SyncMode,
  SyncPane,
  MappingConfidence,
  ScrollLockState,
  ScrollPosition,
  PositionMapping,
  SyncStoreState,
  SyncStoreActions,
  SyncStore,
  SyncStoreApi,
} from './sync-store';

export {
  // Schemas
  SyncModeSchema,
  SyncPaneSchema,
  MappingConfidenceSchema,
  ScrollLockStateSchema,
  // Constants
  SYNC_CONSTANTS,
  SYNC_STORAGE_KEYS,
  SYNC_MODE_LABELS,
  // Initial state
  INITIAL_SCROLL_LOCK,
  INITIAL_SYNC_STATE,
  // Selectors
  selectSyncMode,
  selectIsSyncEnabled,
  selectIsEditorToPreviewEnabled,
  selectIsPreviewToEditorEnabled,
  selectIsLocked,
  selectLockSource,
  selectIsSyncing,
  // Type guards
  isSyncMode,
  shouldSyncEditorToPreview,
  shouldSyncPreviewToEditor,
  isSyncEnabled,
  // Validators
  parseSyncMode,
  parseLastActiveMode,
} from './sync-store';

// =============================================================================
// Orchestrator Types
// =============================================================================

export type {
  UseScrollSyncOptions,
  UseScrollSyncResult,
  UseScrollSync,
  SyncEvent,
  EditorScrollHandler,
  PreviewScrollHandler,
  ScrollLockController,
  ScrollLockOptions,
  DebouncedScrollConfig,
  DebouncedScrollController,
  SyncDirection,
  SyncOperation,
  SyncOperationResult,
  ScrollAnimationOptions,
  PreviewScrollCommand,
  PreviewScrollReport,
  PreviewScrollSender,
  PreviewScrollReceiver,
  EditorScrollData,
  GetEditorScrollData,
  ScrollEditorToLine,
} from './sync-orchestrator';

export { DEFAULT_SCROLL_ANIMATION } from './sync-orchestrator';

// =============================================================================
// Position Mapping Types
// =============================================================================

export type {
  ASTSourcePosition,
  HeadingWithPosition,
  ComponentWithPosition,
  ASTLineMapping,
  CacheEntry,
  PositionCache,
  PositionCacheOptions,
  PositionMapper,
  PositionMapperOptions,
  MappingStrategy,
  MappingStrategyResult,
  ASTMappingStrategy,
  DOMMappingStrategy,
  ProportionalMappingStrategy,
  CalculateRatio,
  CalculateLine,
  ClampValue,
  BuildLineMap,
  FindNearestHeading,
  EstimatePreviewPosition,
  CalculateProportionalPosition,
} from './position-mapping';

export {
  // Schemas
  ASTSourcePositionSchema,
  HeadingWithPositionSchema,
  ComponentWithPositionSchema,
  // Constants
  DEFAULT_POSITION_TOLERANCE,
} from './position-mapping';
