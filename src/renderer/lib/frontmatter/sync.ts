/**
 * Frontmatter Sync Module
 *
 * Utilities for bidirectional synchronization between editor content
 * and frontmatter panel. Uses debouncing and source tracking to prevent
 * infinite loops and excessive updates.
 *
 * @module renderer/lib/frontmatter/sync
 */

import type { ChangeSource } from '@shared/types/frontmatter';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default debounce delay in milliseconds.
 * Per research.md: 150ms debounce + 100ms render budget = ~250ms total latency
 */
export const DEFAULT_DEBOUNCE_MS = 150;

// =============================================================================
// DEBOUNCE
// =============================================================================

/**
 * Debounced function interface with cancel and flush methods.
 */
export interface DebouncedFunction<TArgs extends unknown[]> {
  /** The debounced function */
  (...args: TArgs): void;
  /** Cancel any pending invocation */
  cancel: () => void;
  /** Immediately invoke any pending function */
  flush: () => void;
}

/**
 * Creates a debounced function that delays invoking func until after
 * wait milliseconds have elapsed since the last time the debounced
 * function was invoked.
 *
 * @param func - The function to debounce
 * @param waitMs - The number of milliseconds to delay
 * @returns A debounced version of the function
 */
export function debounce<TArgs extends unknown[]>(
  func: (...args: TArgs) => void,
  waitMs: number
): DebouncedFunction<TArgs> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: TArgs | null = null;

  const debouncedFn = (...args: TArgs): void => {
    lastArgs = args;

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (lastArgs !== null) {
        func(...lastArgs);
        lastArgs = null;
      }
    }, waitMs);
  };

  debouncedFn.cancel = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
  };

  debouncedFn.flush = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (lastArgs !== null) {
      func(...lastArgs);
      lastArgs = null;
    }
  };

  return debouncedFn;
}

// =============================================================================
// SOURCE TRACKING
// =============================================================================

/**
 * Creates a source-aware sync handler that prevents infinite loops
 * by checking the last change source before processing updates.
 *
 * @param processUpdate - Function to call when update should be processed
 * @param getLastSource - Function to get the current change source from store
 * @param ignoreSource - The source to ignore (to prevent feedback loops)
 * @returns A wrapped function that only calls processUpdate when appropriate
 *
 * @example
 * ```tsx
 * const handleEditorChange = createSourceAwareHandler(
 *   (content) => parseFromDocument(content),
 *   () => getLastChangeSource(),
 *   'panel' // Ignore changes that originated from panel
 * );
 * ```
 */
export function createSourceAwareHandler<T>(
  processUpdate: (value: T) => void,
  getLastSource: () => ChangeSource,
  ignoreSource: ChangeSource
): (value: T) => void {
  return (value: T): void => {
    const lastSource = getLastSource();
    if (lastSource !== ignoreSource) {
      processUpdate(value);
    }
  };
}

// =============================================================================
// SYNC MANAGER
// =============================================================================

/**
 * Options for creating a sync manager.
 */
export interface SyncManagerOptions {
  /** Debounce delay for editor-to-panel sync in milliseconds */
  readonly debounceMs?: number;

  /** Function to get the current change source */
  readonly getLastSource: () => ChangeSource;

  /** Function to parse frontmatter from document content */
  readonly parseFromDocument: (content: string) => void;

  /** Function to serialize frontmatter and update editor */
  readonly updateEditor: (yaml: string) => void;

  /** Function to serialize current frontmatter state to YAML */
  readonly serializeToYaml: () => string;

  /** Function to set the change source before updates */
  readonly setChangeSource: (source: ChangeSource) => void;
}

/**
 * Sync manager interface for coordinating bidirectional updates.
 */
export interface SyncManager {
  /**
   * Handle content changes from the editor.
   * Debounced and source-aware to prevent infinite loops.
   */
  readonly handleEditorChange: (content: string) => void;

  /**
   * Handle field changes from the panel.
   * Immediately updates the editor with new frontmatter.
   */
  readonly handlePanelChange: () => void;

  /**
   * Cancel any pending debounced updates.
   */
  readonly cancel: () => void;

  /**
   * Flush any pending debounced updates immediately.
   */
  readonly flush: () => void;

  /**
   * Clean up resources (call on unmount).
   */
  readonly dispose: () => void;
}

/**
 * Creates a sync manager for coordinating bidirectional updates
 * between the editor and frontmatter panel.
 *
 * @param options - Configuration options
 * @returns A sync manager instance
 *
 * @example
 * ```tsx
 * const syncManager = createSyncManager({
 *   getLastSource: () => useFrontmatterStore.getState().lastChangeSource,
 *   parseFromDocument: (content) => useFrontmatterStore.getState().parseFromDocument(content),
 *   updateEditor: (yaml) => editorStore.getState().updateFrontmatter(yaml),
 *   serializeToYaml: () => useFrontmatterStore.getState().serializeToYaml(),
 *   setChangeSource: (source) => useFrontmatterStore.getState().setChangeSource(source),
 * });
 *
 * // In editor subscription
 * syncManager.handleEditorChange(newContent);
 *
 * // In form field onChange
 * syncManager.handlePanelChange();
 *
 * // On cleanup
 * syncManager.dispose();
 * ```
 */
export function createSyncManager(options: SyncManagerOptions): SyncManager {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    getLastSource,
    parseFromDocument,
    updateEditor,
    serializeToYaml,
    setChangeSource,
  } = options;

  // Debounced handler for editor changes
  const debouncedParseFromDocument = debounce((content: string) => {
    // Check source before processing to prevent feedback loops
    const lastSource = getLastSource();
    if (lastSource !== 'panel') {
      parseFromDocument(content);
    }
  }, debounceMs);

  // Handler for editor content changes
  const handleEditorChange = (content: string): void => {
    debouncedParseFromDocument(content);
  };

  // Handler for panel field changes (immediate, no debounce needed)
  const handlePanelChange = (): void => {
    // Set source to prevent editor-to-panel sync from triggering
    setChangeSource('panel');

    // Serialize and update editor
    const yaml = serializeToYaml();
    updateEditor(yaml);
  };

  return {
    handleEditorChange,
    handlePanelChange,
    cancel: () => debouncedParseFromDocument.cancel(),
    flush: () => debouncedParseFromDocument.flush(),
    dispose: () => debouncedParseFromDocument.cancel(),
  };
}

// =============================================================================
// SUBSCRIPTION HELPERS
// =============================================================================

/**
 * Creates a Zustand selector subscription for tracking specific state changes.
 * Returns an unsubscribe function.
 *
 * @param subscribe - The store's subscribe function
 * @param selector - Function to select the relevant state slice
 * @param callback - Function to call when selected state changes
 * @returns Unsubscribe function
 *
 * @example
 * ```tsx
 * const unsubscribe = createSubscription(
 *   editorStore.subscribe,
 *   (state) => state.content,
 *   (content) => syncManager.handleEditorChange(content)
 * );
 *
 * // Later:
 * unsubscribe();
 * ```
 */
export function createSubscription<TStore, TSlice>(
  subscribe: (listener: (state: TStore) => void) => () => void,
  selector: (state: TStore) => TSlice,
  callback: (slice: TSlice) => void
): () => void {
  let previousSlice: TSlice | undefined;

  return subscribe((state) => {
    const currentSlice = selector(state);
    if (currentSlice !== previousSlice) {
      previousSlice = currentSlice;
      callback(currentSlice);
    }
  });
}
