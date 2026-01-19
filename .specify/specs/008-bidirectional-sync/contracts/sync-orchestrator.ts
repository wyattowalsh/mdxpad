/**
 * Sync Orchestrator Contracts
 *
 * Feature: 008-bidirectional-sync
 * Type definitions for scroll sync orchestration hooks.
 */

import type { RefObject } from 'react';
import type { EditorView } from '@codemirror/view';
import type {
  SyncMode,
  SyncPane,
  ScrollPosition,
  PositionMapping,
} from './sync-store';

// =============================================================================
// Hook Options & Results
// =============================================================================

/**
 * Options for useScrollSync hook.
 */
export interface UseScrollSyncOptions {
  /** Reference to CodeMirror EditorView */
  readonly editorRef: RefObject<EditorView | null>;

  /** Reference to preview iframe */
  readonly previewRef: RefObject<HTMLIFrameElement | null>;

  /** Whether sync is currently enabled (from store) */
  readonly isEnabled: boolean;

  /** Current sync mode */
  readonly mode: SyncMode;

  /** Callback when sync state changes */
  readonly onSyncStateChange?: (isSyncing: boolean) => void;
}

/**
 * Result from useScrollSync hook.
 */
export interface UseScrollSyncResult {
  /** Whether sync is currently in progress */
  readonly isSyncing: boolean;

  /** Manually trigger sync from editor to preview */
  readonly syncEditorToPreview: () => void;

  /** Manually trigger sync from preview to editor */
  readonly syncPreviewToEditor: () => void;

  /** Pause sync (temporary disable) */
  readonly pauseSync: () => void;

  /** Resume sync (after pause) */
  readonly resumeSync: () => void;
}

/**
 * Hook signature for useScrollSync.
 */
export type UseScrollSync = (options: UseScrollSyncOptions) => UseScrollSyncResult;

// =============================================================================
// Scroll Event Handlers
// =============================================================================

/**
 * A scroll event from either pane.
 */
export interface SyncEvent {
  /** Source pane of the scroll */
  readonly source: SyncPane;

  /** Position data from the scroll */
  readonly position: ScrollPosition;

  /** Whether this is a user-initiated scroll */
  readonly isUserScroll: boolean;
}

/**
 * Handler for editor scroll events.
 */
export type EditorScrollHandler = (event: SyncEvent) => void;

/**
 * Handler for preview scroll events.
 */
export type PreviewScrollHandler = (event: SyncEvent) => void;

// =============================================================================
// Scroll Lock
// =============================================================================

/**
 * Scroll lock controller interface.
 */
export interface ScrollLockController {
  /** Attempt to acquire lock for a source pane */
  readonly acquire: (source: SyncPane) => boolean;

  /** Release the current lock */
  readonly release: () => void;

  /** Check if locked */
  readonly isLocked: () => boolean;

  /** Get the current lock source */
  readonly getSource: () => SyncPane | null;

  /** Check if scroll from given pane should be ignored */
  readonly shouldIgnore: (source: SyncPane) => boolean;
}

/**
 * Options for creating scroll lock controller.
 */
export interface ScrollLockOptions {
  /** Lock duration in milliseconds */
  readonly lockDuration: number;

  /** Callback when lock is acquired */
  readonly onLockAcquired?: (source: SyncPane) => void;

  /** Callback when lock is released */
  readonly onLockReleased?: () => void;
}

// =============================================================================
// Debounce Controller
// =============================================================================

/**
 * Debounced scroll handler configuration.
 */
export interface DebouncedScrollConfig {
  /** Debounce delay in milliseconds */
  readonly delay: number;

  /** Maximum wait time before forcing execution */
  readonly maxWait?: number;

  /** Whether to execute on leading edge */
  readonly leading?: boolean;

  /** Whether to execute on trailing edge */
  readonly trailing?: boolean;
}

/**
 * Debounced scroll handler controller.
 */
export interface DebouncedScrollController {
  /** Schedule a scroll sync */
  readonly schedule: (event: SyncEvent) => void;

  /** Cancel pending sync */
  readonly cancel: () => void;

  /** Flush pending sync immediately */
  readonly flush: () => void;

  /** Check if there's a pending sync */
  readonly isPending: () => boolean;
}

// =============================================================================
// Sync Direction
// =============================================================================

/**
 * Direction of sync operation.
 */
export type SyncDirection = 'editorToPreview' | 'previewToEditor';

/**
 * Sync operation details.
 */
export interface SyncOperation {
  /** Direction of sync */
  readonly direction: SyncDirection;

  /** Source position */
  readonly sourcePosition: ScrollPosition;

  /** Target position (calculated) */
  readonly targetPosition: ScrollPosition;

  /** Mapping used for calculation */
  readonly mapping: PositionMapping | null;

  /** Timestamp of operation */
  readonly timestamp: number;
}

/**
 * Result of a sync operation.
 */
export interface SyncOperationResult {
  /** Whether sync was successful */
  readonly success: boolean;

  /** Error message if failed */
  readonly error?: string;

  /** The operation that was performed */
  readonly operation: SyncOperation;

  /** Duration of sync in milliseconds */
  readonly duration: number;
}

// =============================================================================
// Animation
// =============================================================================

/**
 * Scroll animation options.
 */
export interface ScrollAnimationOptions {
  /** Animation duration in milliseconds */
  readonly duration: number;

  /** Easing function name */
  readonly easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';

  /** Whether to respect prefers-reduced-motion */
  readonly respectReducedMotion: boolean;
}

/**
 * Default animation options.
 */
export const DEFAULT_SCROLL_ANIMATION: ScrollAnimationOptions = {
  duration: 150, // SCROLL_ANIMATION_MS from constants
  easing: 'ease-out',
  respectReducedMotion: true,
};

// =============================================================================
// Preview Communication
// =============================================================================

/**
 * Message sent to preview iframe for scroll.
 */
export interface PreviewScrollCommand {
  readonly type: 'scroll';
  readonly ratio: number;
  readonly animate: boolean;
}

/**
 * Message received from preview iframe reporting scroll.
 */
export interface PreviewScrollReport {
  readonly type: 'scroll-report';
  readonly ratio: number;
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

/**
 * Sender for preview scroll commands.
 */
export interface PreviewScrollSender {
  /** Send scroll command to preview */
  readonly sendScroll: (ratio: number, animate: boolean) => void;
}

/**
 * Receiver for preview scroll reports.
 */
export interface PreviewScrollReceiver {
  /** Subscribe to scroll reports */
  readonly subscribe: (handler: (report: PreviewScrollReport) => void) => () => void;
}

// =============================================================================
// Editor Scroll
// =============================================================================

/**
 * Editor scroll position data.
 */
export interface EditorScrollData {
  /** First visible line (1-indexed) */
  readonly firstLine: number;

  /** Last visible line (1-indexed) */
  readonly lastLine: number;

  /** Center visible line (1-indexed) */
  readonly centerLine: number;

  /** Scroll ratio (0-1) */
  readonly ratio: number;

  /** Total document lines */
  readonly totalLines: number;
}

/**
 * Get scroll data from editor view.
 */
export type GetEditorScrollData = (view: EditorView) => EditorScrollData;

/**
 * Scroll editor to specific line.
 */
export type ScrollEditorToLine = (
  view: EditorView,
  line: number,
  options?: { animate?: boolean; position?: 'start' | 'center' | 'end' }
) => void;
