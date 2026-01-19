/**
 * Scroll Lock Module
 *
 * Feature: 008-bidirectional-sync
 *
 * Provides scroll lock functionality to prevent infinite feedback loops
 * during bidirectional scroll synchronization between editor and preview panes.
 *
 * When one pane initiates a scroll sync, it acquires a lock to prevent
 * the target pane's scroll handler from triggering a reverse sync.
 * The lock auto-releases after a configurable duration (default: SYNC_DEBOUNCE_MS).
 *
 * @module renderer/lib/sync/scroll-lock
 */

import type { SyncPane } from '@shared/types/sync';
import { SYNC_CONSTANTS } from './constants';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for configuring the scroll lock controller.
 */
export interface ScrollLockOptions {
  /**
   * Duration in milliseconds before the lock auto-releases.
   * @default SYNC_CONSTANTS.SYNC_DEBOUNCE_MS (50ms)
   */
  readonly lockDuration?: number;

  /**
   * Callback invoked when a lock is successfully acquired.
   * @param source - The pane that acquired the lock
   */
  readonly onLockAcquired?: (source: SyncPane) => void;

  /**
   * Callback invoked when the lock is released.
   */
  readonly onLockReleased?: () => void;
}

/**
 * Controller interface for managing scroll locks.
 *
 * Provides methods to acquire, release, and query lock state
 * to coordinate scroll synchronization between panes.
 */
export interface ScrollLockController {
  /**
   * Attempt to acquire the scroll lock for a source pane.
   *
   * Behavior:
   * - If unlocked: acquires lock, returns true
   * - If locked by same source: ignores (no re-acquire), returns false
   * - If locked by different source: breaks existing lock, acquires new lock, returns true
   *
   * @param source - The pane attempting to acquire the lock
   * @returns true if lock was acquired, false if ignored (already locked by same source)
   */
  readonly acquire: (source: SyncPane) => boolean;

  /**
   * Release the current lock immediately.
   * Cancels any pending auto-release timeout.
   */
  readonly release: () => void;

  /**
   * Check if the lock is currently held.
   *
   * @returns true if locked, false otherwise
   */
  readonly isLocked: () => boolean;

  /**
   * Get the pane that currently holds the lock.
   *
   * @returns The lock source pane, or null if unlocked
   */
  readonly getSource: () => SyncPane | null;

  /**
   * Check if a scroll event from the given source should be ignored.
   *
   * A scroll should be ignored if:
   * - Lock is active AND
   * - Lock is held by the same source (self-triggered scroll from sync)
   *
   * This prevents the synchronized pane from re-triggering a sync
   * back to the original source.
   *
   * @param source - The pane that generated the scroll event
   * @returns true if the scroll should be ignored
   */
  readonly shouldIgnore: (source: SyncPane) => boolean;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Creates a new scroll lock controller instance.
 *
 * The scroll lock prevents infinite feedback loops during bidirectional
 * scroll synchronization. When pane A scrolls and triggers sync to pane B,
 * the lock ensures that B's resulting scroll event doesn't trigger a
 * sync back to A.
 *
 * @example
 * ```typescript
 * const lock = createScrollLock({
 *   lockDuration: 100,
 *   onLockAcquired: (source) => console.log(`Lock acquired by ${source}`),
 *   onLockReleased: () => console.log('Lock released'),
 * });
 *
 * // Editor initiates scroll
 * if (lock.acquire('editor')) {
 *   // Sync preview...
 * }
 *
 * // When preview's scroll handler fires:
 * if (lock.shouldIgnore('preview')) {
 *   // Ignore - this scroll was triggered by sync, not user
 *   return;
 * }
 * ```
 *
 * @param options - Optional configuration for the lock controller
 * @returns A new ScrollLockController instance
 */
export function createScrollLock(options?: Partial<ScrollLockOptions>): ScrollLockController {
  const lockDuration = options?.lockDuration ?? SYNC_CONSTANTS.SYNC_DEBOUNCE_MS;

  // Internal state
  let isLocked = false;
  let lockSource: SyncPane | null = null;
  let lockTimestamp = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Release the lock and clean up state.
   */
  const release = (): void => {
    // Clear any pending auto-release timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    // Reset lock state
    isLocked = false;
    lockSource = null;
    lockTimestamp = 0;

    // Notify callback
    options?.onLockReleased?.();
  };

  /**
   * Attempt to acquire the lock for a source pane.
   */
  const acquire = (source: SyncPane): boolean => {
    if (isLocked) {
      // Same source trying to re-acquire - ignore to prevent redundant locks
      if (lockSource === source) {
        return false;
      }

      // Different source wants lock - break existing lock to prevent deadlock
      // This allows the most recent scroll initiator to take control
      release();
    }

    // Acquire the lock
    isLocked = true;
    lockSource = source;
    lockTimestamp = Date.now();

    // Notify callback
    options?.onLockAcquired?.(source);

    // Schedule auto-release after duration
    // This ensures locks don't persist indefinitely if release() isn't called
    timeoutId = setTimeout(release, lockDuration);

    return true;
  };

  // Return the controller interface
  return {
    acquire,
    release,
    isLocked: () => isLocked,
    getSource: () => lockSource,
    shouldIgnore: (source: SyncPane) => isLocked && lockSource === source,
  };
}
