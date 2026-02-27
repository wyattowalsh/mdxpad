/**
 * Awareness Manager — Tracks user cursors, selections, and presence.
 * Provides an abstraction over the Yjs awareness protocol for collaboration.
 *
 * @module main/services/collab-awareness
 */

// ============================================================================
// Types
// ============================================================================

/** Local awareness state for a user */
export interface AwarenessLocalState {
  readonly username: string;
  readonly color: string;
  readonly cursorLine?: number | undefined;
  readonly cursorColumn?: number | undefined;
  readonly selectionFrom?: number | undefined;
  readonly selectionTo?: number | undefined;
  readonly isActive: boolean;
}

/** Remote awareness state from another user */
export interface AwarenessRemoteState {
  readonly clientId: number;
  readonly username: string;
  readonly color: string;
  readonly cursorLine?: number | undefined;
  readonly cursorColumn?: number | undefined;
  readonly selectionFrom?: number | undefined;
  readonly selectionTo?: number | undefined;
  readonly isActive: boolean;
  readonly lastUpdated: number;
}

/** Callback for awareness updates */
export type AwarenessUpdateCallback = (states: readonly AwarenessRemoteState[]) => void;

/** Options for awareness manager */
export interface AwarenessManagerOptions {
  readonly staleTimeout?: number;
  readonly maxTrackedUsers?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default timeout before a user is considered stale (30 seconds) */
const DEFAULT_STALE_TIMEOUT = 30_000;

/** Default maximum number of tracked users */
const DEFAULT_MAX_TRACKED_USERS = 50;

/** Pre-defined user colors for automatic assignment */
const USER_COLORS: readonly string[] = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#84cc16', // Lime
  '#0ea5e9', // Sky
  '#d946ef', // Fuchsia
];

// ============================================================================
// Awareness Manager
// ============================================================================

/**
 * Manages awareness state for collaboration sessions.
 * Tracks user cursors, selections, usernames, and colors.
 */
export class AwarenessManager {
  private localState: AwarenessLocalState | null = null;
  private readonly remoteStates = new Map<number, AwarenessRemoteState>();
  private readonly callbacks = new Set<AwarenessUpdateCallback>();
  private readonly staleTimeout: number;
  private readonly maxTrackedUsers: number;
  private staleCheckInterval: ReturnType<typeof setInterval> | null = null;
  private colorIndex = 0;

  constructor(options: AwarenessManagerOptions = {}) {
    this.staleTimeout = options.staleTimeout ?? DEFAULT_STALE_TIMEOUT;
    this.maxTrackedUsers = options.maxTrackedUsers ?? DEFAULT_MAX_TRACKED_USERS;
  }

  /**
   * Start periodic stale user cleanup.
   */
  start(): void {
    if (this.staleCheckInterval) {
      return;
    }

    this.staleCheckInterval = setInterval(() => {
      this.removeStaleStates();
    }, this.staleTimeout / 2);
  }

  /**
   * Stop the awareness manager and clean up.
   */
  stop(): void {
    if (this.staleCheckInterval) {
      clearInterval(this.staleCheckInterval);
      this.staleCheckInterval = null;
    }

    this.localState = null;
    this.remoteStates.clear();
    this.callbacks.clear();
  }

  /**
   * Set the local user's awareness state.
   * @param state - The local awareness state to broadcast
   */
  setLocalState(state: AwarenessLocalState): void {
    this.localState = state;
  }

  /**
   * Get the current local awareness state.
   */
  getLocalState(): AwarenessLocalState | null {
    return this.localState;
  }

  /**
   * Update a remote user's awareness state.
   * @param clientId - The client ID of the remote user
   * @param state - Partial state to merge with existing remote state
   */
  updateRemoteState(
    clientId: number,
    state: Omit<AwarenessLocalState, 'isActive'> & { readonly isActive?: boolean }
  ): void {
    if (this.remoteStates.size >= this.maxTrackedUsers && !this.remoteStates.has(clientId)) {
      return;
    }

    const existing = this.remoteStates.get(clientId);
    const remoteState: AwarenessRemoteState = {
      clientId,
      username: state.username,
      color: state.color,
      cursorLine: state.cursorLine,
      cursorColumn: state.cursorColumn,
      selectionFrom: state.selectionFrom,
      selectionTo: state.selectionTo,
      isActive: state.isActive ?? existing?.isActive ?? true,
      lastUpdated: Date.now(),
    };

    this.remoteStates.set(clientId, remoteState);
    this.notifyCallbacks();
  }

  /**
   * Remove a remote user's awareness state.
   * @param clientId - The client ID to remove
   */
  removeRemoteState(clientId: number): void {
    if (this.remoteStates.delete(clientId)) {
      this.notifyCallbacks();
    }
  }

  /**
   * Get all current awareness states (excluding local).
   * @returns Array of remote awareness states
   */
  getStates(): readonly AwarenessRemoteState[] {
    return Array.from(this.remoteStates.values());
  }

  /**
   * Get a specific remote user's state.
   * @param clientId - The client ID to look up
   * @returns The remote state or undefined
   */
  getState(clientId: number): AwarenessRemoteState | undefined {
    return this.remoteStates.get(clientId);
  }

  /**
   * Subscribe to awareness state updates.
   * @param callback - Called when any awareness state changes
   * @returns Unsubscribe function
   */
  onUpdate(callback: AwarenessUpdateCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Get the next available user color.
   * Cycles through the predefined palette.
   */
  getNextColor(): string {
    const color = USER_COLORS[this.colorIndex % USER_COLORS.length];
    this.colorIndex++;
    return color ?? '#6366f1';
  }

  /**
   * Get the count of active remote users.
   */
  getActiveCount(): number {
    let count = 0;
    for (const state of this.remoteStates.values()) {
      if (state.isActive) {
        count++;
      }
    }
    return count;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private removeStaleStates(): void {
    const now = Date.now();
    let removed = false;

    for (const [clientId, state] of this.remoteStates) {
      if (now - state.lastUpdated > this.staleTimeout) {
        this.remoteStates.delete(clientId);
        removed = true;
      }
    }

    if (removed) {
      this.notifyCallbacks();
    }
  }

  private notifyCallbacks(): void {
    const states = this.getStates();
    for (const callback of this.callbacks) {
      try {
        callback(states);
      } catch (error) {
        console.error('[AwarenessManager] Callback error:', error);
      }
    }
  }
}
