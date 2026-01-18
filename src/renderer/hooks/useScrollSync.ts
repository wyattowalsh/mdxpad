/**
 * useScrollSync Hook
 *
 * Main orchestration hook for bidirectional scroll synchronization between
 * the editor and preview panes. Coordinates scroll events, position mapping,
 * and feedback loop prevention.
 *
 * Feature: 008-bidirectional-sync
 *
 * @module renderer/hooks/useScrollSync
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { EditorView } from '@codemirror/view';
import type { SyncMode } from '@shared/types/sync';
import {
  shouldSyncEditorToPreview,
  shouldSyncPreviewToEditor,
} from '@shared/types/sync';
import {
  useSyncStore,
  selectIsSyncEnabled,
} from '@renderer/stores/sync-store';
import {
  createScrollLock,
  createPositionCache,
  createPositionMapper,
  SYNC_CONSTANTS,
  type ScrollLockController,
  type PositionCache,
  type PositionMapper,
  type HeadingWithPosition,
} from '@renderer/lib/sync';

// =============================================================================
// Types
// =============================================================================

/** Options for the useScrollSync hook. */
export interface UseScrollSyncOptions {
  readonly editorRef: React.RefObject<EditorView | null>;
  readonly previewRef: React.RefObject<HTMLIFrameElement | null>;
  readonly isEnabled?: boolean;
  readonly mode?: SyncMode;
  readonly onSyncStateChange?: (isSyncing: boolean) => void;
  /**
   * Enable cursor position tracking for typing sync (T023).
   * When true, sync is triggered on cursor line changes during editing.
   * Default: true
   */
  readonly enableCursorTracking?: boolean;
}

/** Result from the useScrollSync hook. */
export interface UseScrollSyncResult {
  readonly isSyncing: boolean;
  readonly syncEditorToPreview: () => void;
  readonly syncPreviewToEditor: () => void;
  readonly pauseSync: () => void;
  readonly resumeSync: () => void;
  readonly updateAST: (headings: readonly HeadingWithPosition[]) => void;
  readonly updateEditorLines: (lines: number) => void;
  readonly updatePreviewHeight: (scrollHeight: number, clientHeight: number) => void;
}

interface PreviewScrollCommand {
  readonly type: 'scroll';
  readonly ratio: number;
  readonly animate: boolean;
}

interface PreviewScrollReport {
  readonly type: 'scroll-report';
  readonly ratio: number;
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

interface SyncRefs {
  readonly scrollLock: React.MutableRefObject<ScrollLockController | null>;
  readonly positionCache: React.MutableRefObject<PositionCache | null>;
  readonly positionMapper: React.MutableRefObject<PositionMapper | null>;
  readonly debounceTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  /** Last cursor line for threshold tracking (T024) */
  readonly lastCursorLine: React.MutableRefObject<number>;
  /** Last synced line for threshold comparison (T024) */
  readonly lastSyncedLine: React.MutableRefObject<number>;
}

// =============================================================================
// Helpers
// =============================================================================

function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getPreviewScrollMax(iframe: HTMLIFrameElement): number {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return 1;
    return Math.max(1, doc.documentElement.scrollHeight - doc.documentElement.clientHeight);
  } catch {
    return 1;
  }
}

function getEditorFirstVisibleLine(view: EditorView): number {
  return view.state.doc.lineAt(view.viewport.from).number;
}

function getEditorTotalLines(view: EditorView): number {
  return view.state.doc.lines;
}

/**
 * Get current cursor line number (1-based).
 * T023: Used for cursor position tracking during typing.
 */
function getEditorCursorLine(view: EditorView): number {
  const cursor = view.state.selection.main.head;
  return view.state.doc.lineAt(cursor).number;
}

function isScrollReport(data: unknown): data is PreviewScrollReport {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    d.type === 'scroll-report' &&
    typeof d.ratio === 'number' &&
    typeof d.scrollTop === 'number' &&
    typeof d.scrollHeight === 'number' &&
    typeof d.clientHeight === 'number'
  );
}

// =============================================================================
// Initialization Hooks
// =============================================================================

function useSyncRefs(): SyncRefs {
  return {
    scrollLock: useRef<ScrollLockController | null>(null),
    positionCache: useRef<PositionCache | null>(null),
    positionMapper: useRef<PositionMapper | null>(null),
    debounceTimer: useRef<ReturnType<typeof setTimeout> | null>(null),
    lastCursorLine: useRef<number>(1),
    lastSyncedLine: useRef<number>(1),
  };
}

function useScrollLockGetter(
  ref: React.MutableRefObject<ScrollLockController | null>,
  setIsSyncing: (syncing: boolean) => void
): () => ScrollLockController {
  return useCallback(() => {
    if (!ref.current) {
      ref.current = createScrollLock({
        lockDuration: SYNC_CONSTANTS.SYNC_DEBOUNCE_MS * 2,
        onLockReleased: () => setIsSyncing(false),
      });
    }
    return ref.current;
  }, [ref, setIsSyncing]);
}

function usePositionMapperGetter(
  cacheRef: React.MutableRefObject<PositionCache | null>,
  mapperRef: React.MutableRefObject<PositionMapper | null>
): () => PositionMapper {
  return useCallback(() => {
    if (!cacheRef.current) {
      cacheRef.current = createPositionCache({ ttl: SYNC_CONSTANTS.POSITION_CACHE_TTL_MS });
    }
    if (!mapperRef.current) {
      mapperRef.current = createPositionMapper({ cache: cacheRef.current });
    }
    return mapperRef.current;
  }, [cacheRef, mapperRef]);
}

// =============================================================================
// Sync Action Hooks
// =============================================================================

function useEditorToPreviewSync(
  editorRef: React.RefObject<EditorView | null>,
  previewRef: React.RefObject<HTMLIFrameElement | null>,
  isEnabled: boolean,
  isPaused: boolean,
  isEditorToPreviewEnabled: boolean,
  getScrollLock: () => ScrollLockController,
  getPositionMapper: () => PositionMapper,
  setIsSyncing: (syncing: boolean) => void
): () => void {
  return useCallback(() => {
    const view = editorRef.current;
    const iframe = previewRef.current;
    if (!view || !iframe?.contentWindow) return;
    if (!isEnabled || isPaused || !isEditorToPreviewEnabled) return;

    const lock = getScrollLock();
    if (lock.shouldIgnore('preview') || !lock.acquire('editor')) return;

    setIsSyncing(true);

    const firstLine = getEditorFirstVisibleLine(view);
    const mapping = getPositionMapper().editorToPreview(firstLine);
    const maxScroll = getPreviewScrollMax(iframe);
    const ratio = maxScroll > 0 ? mapping.previewScrollTop / maxScroll : 0;
    const prefersReducedMotion = getPrefersReducedMotion();

    const command: PreviewScrollCommand = {
      type: 'scroll',
      ratio: Math.max(0, Math.min(1, ratio)),
      animate: !prefersReducedMotion,
    };

    try {
      iframe.contentWindow.postMessage(command, '*');
    } catch { /* ignore */ }

    setTimeout(
      () => setIsSyncing(false),
      prefersReducedMotion ? 0 : SYNC_CONSTANTS.SCROLL_ANIMATION_MS
    );
  }, [editorRef, previewRef, isEnabled, isPaused, isEditorToPreviewEnabled, getScrollLock, getPositionMapper, setIsSyncing]);
}

function usePreviewToEditorSync(
  editorRef: React.RefObject<EditorView | null>,
  isEnabled: boolean,
  isPaused: boolean,
  isPreviewToEditorEnabled: boolean,
  getScrollLock: () => ScrollLockController,
  getPositionMapper: () => PositionMapper,
  setIsSyncing: (syncing: boolean) => void
): (report: PreviewScrollReport) => void {
  return useCallback((report: PreviewScrollReport) => {
    const view = editorRef.current;
    if (!view) return;
    if (!isEnabled || isPaused || !isPreviewToEditorEnabled) return;

    const lock = getScrollLock();
    if (lock.shouldIgnore('editor') || !lock.acquire('preview')) return;

    setIsSyncing(true);

    const mapper = getPositionMapper();
    mapper.updatePreviewHeight(report.scrollHeight, report.clientHeight);

    const mapping = mapper.previewToEditor(report.scrollTop);
    const totalLines = getEditorTotalLines(view);
    const targetLine = Math.max(1, Math.min(mapping.editorLine, totalLines));
    const lineInfo = view.state.doc.line(targetLine);
    const prefersReducedMotion = getPrefersReducedMotion();

    view.dispatch({ selection: { anchor: lineInfo.from }, scrollIntoView: true });

    useSyncStore.getState().handlePreviewScroll({
      pane: 'preview',
      line: null,
      scrollTop: report.scrollTop,
      ratio: report.ratio,
      timestamp: Date.now(),
    });

    setTimeout(
      () => setIsSyncing(false),
      prefersReducedMotion ? 0 : SYNC_CONSTANTS.SCROLL_ANIMATION_MS
    );
  }, [editorRef, isEnabled, isPaused, isPreviewToEditorEnabled, getScrollLock, getPositionMapper, setIsSyncing]);
}

// =============================================================================
// Event Listener Hooks
// =============================================================================

function usePreviewMessageListener(handleScrollReport: (report: PreviewScrollReport) => void): void {
  useEffect(() => {
    const handler = (event: MessageEvent): void => {
      if (isScrollReport(event.data)) handleScrollReport(event.data);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleScrollReport]);
}

function useEditorScrollListener(
  editorRef: React.RefObject<EditorView | null>,
  isEnabled: boolean,
  isPaused: boolean,
  isEditorToPreviewEnabled: boolean,
  syncEditorToPreview: () => void,
  debounceTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
): void {
  useEffect(() => {
    const view = editorRef.current;
    if (!view) return;

    const scrollElement = view.scrollDOM;

    const handler = (): void => {
      if (!isEnabled || isPaused || !isEditorToPreviewEnabled) return;

      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        syncEditorToPreview();
      }, SYNC_CONSTANTS.SYNC_DEBOUNCE_MS);
    };

    scrollElement.addEventListener('scroll', handler, { passive: true });

    return () => {
      scrollElement.removeEventListener('scroll', handler);
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [editorRef, isEnabled, isPaused, isEditorToPreviewEnabled, syncEditorToPreview, debounceTimerRef]);
}

/**
 * T023, T024, T025: Cursor tracking hook for typing sync.
 *
 * Tracks cursor position changes during editing and triggers sync
 * only when the cursor moves beyond SYNC_THRESHOLD_LINES from the
 * last synced position. Uses debouncing to maintain <16ms keystroke latency.
 */
function useCursorTrackingListener(
  editorRef: React.RefObject<EditorView | null>,
  isEnabled: boolean,
  isPaused: boolean,
  isEditorToPreviewEnabled: boolean,
  enableCursorTracking: boolean,
  syncEditorToPreview: () => void,
  lastCursorLineRef: React.MutableRefObject<number>,
  lastSyncedLineRef: React.MutableRefObject<number>,
  debounceTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
): void {
  useEffect(() => {
    const view = editorRef.current;
    if (!view || !enableCursorTracking) return;

    // Track document changes and cursor movements
    // We use a MutationObserver-like approach via EditorView's update listener
    // but since we're in React, we poll on selection changes instead

    let lastCheckTime = 0;

    const checkCursorChange = (): void => {
      const now = Date.now();
      // T025: Rate limit checks to maintain <16ms keystroke latency
      if (now - lastCheckTime < 16) return;
      lastCheckTime = now;

      if (!isEnabled || isPaused || !isEditorToPreviewEnabled) return;

      const currentView = editorRef.current;
      if (!currentView) return;

      const currentLine = getEditorCursorLine(currentView);
      lastCursorLineRef.current = currentLine;

      // T024: Only sync if cursor moved beyond threshold
      const lineDelta = Math.abs(currentLine - lastSyncedLineRef.current);
      if (lineDelta >= SYNC_CONSTANTS.SYNC_THRESHOLD_LINES) {
        // Clear any pending debounce
        if (debounceTimerRef.current !== null) {
          clearTimeout(debounceTimerRef.current);
        }

        // T025: Debounce to prevent sync flood during rapid typing
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          lastSyncedLineRef.current = currentLine;
          syncEditorToPreview();
        }, SYNC_CONSTANTS.SYNC_DEBOUNCE_MS);
      }
    };

    // Listen to document changes (typing) via the DOM
    // This approach has minimal overhead
    const scrollElement = view.scrollDOM;

    // Use keyup event for typing detection - fires after keystroke completes
    const keyHandler = (event: KeyboardEvent): void => {
      // Ignore modifier keys
      if (event.key === 'Shift' || event.key === 'Control' ||
          event.key === 'Alt' || event.key === 'Meta') return;
      checkCursorChange();
    };

    // Also check on mouse clicks (cursor repositioning)
    const clickHandler = (): void => {
      checkCursorChange();
    };

    scrollElement.addEventListener('keyup', keyHandler);
    scrollElement.addEventListener('click', clickHandler);

    return () => {
      scrollElement.removeEventListener('keyup', keyHandler);
      scrollElement.removeEventListener('click', clickHandler);
    };
  }, [
    editorRef,
    isEnabled,
    isPaused,
    isEditorToPreviewEnabled,
    enableCursorTracking,
    syncEditorToPreview,
    lastCursorLineRef,
    lastSyncedLineRef,
    debounceTimerRef,
  ]);
}

/**
 * T029, T030: Cache invalidation on document content change.
 *
 * Subscribes to editor document changes and clears the position cache
 * when content changes to prevent stale mappings.
 */
function useContentChangeListener(
  editorRef: React.RefObject<EditorView | null>,
  cacheRef: React.MutableRefObject<PositionCache | null>
): void {
  // Track last document version to detect changes
  const lastDocVersionRef = useRef<number | null>(null);

  useEffect(() => {
    const view = editorRef.current;
    if (!view) return;

    // Initialize version
    lastDocVersionRef.current = view.state.doc.length;

    // Listen for input events which indicate content changes
    const scrollElement = view.scrollDOM;

    const checkContentChange = (): void => {
      const currentView = editorRef.current;
      if (!currentView) return;

      const currentVersion = currentView.state.doc.length;
      if (lastDocVersionRef.current !== null && currentVersion !== lastDocVersionRef.current) {
        // Content changed - invalidate cache
        cacheRef.current?.clear();
        lastDocVersionRef.current = currentVersion;
      }
    };

    // Listen to input events for content changes
    const inputHandler = (): void => {
      checkContentChange();
    };

    scrollElement.addEventListener('input', inputHandler);

    return () => {
      scrollElement.removeEventListener('input', inputHandler);
    };
  }, [editorRef, cacheRef]);
}

// =============================================================================
// Cleanup Hook
// =============================================================================

function useSyncCleanup(refs: SyncRefs): void {
  useEffect(() => () => {
    if (refs.debounceTimer.current !== null) clearTimeout(refs.debounceTimer.current);
    refs.scrollLock.current?.release();
  }, [refs.debounceTimer, refs.scrollLock]);
}

// =============================================================================
// Control Functions Hook
// =============================================================================

interface ControlFunctions {
  pauseSync: () => void;
  resumeSync: () => void;
  updateAST: (headings: readonly HeadingWithPosition[]) => void;
  updateEditorLines: (lines: number) => void;
  updatePreviewHeight: (scrollHeight: number, clientHeight: number) => void;
}

function useControlFunctions(
  setIsPaused: (paused: boolean) => void,
  getPositionMapper: () => PositionMapper
): ControlFunctions {
  const pauseSync = useCallback(() => setIsPaused(true), [setIsPaused]);
  const resumeSync = useCallback(() => setIsPaused(false), [setIsPaused]);
  const updateAST = useCallback(
    (headings: readonly HeadingWithPosition[]) => getPositionMapper().updateAST(headings),
    [getPositionMapper]
  );
  const updateEditorLines = useCallback(
    (lines: number) => getPositionMapper().updateEditorLines(lines),
    [getPositionMapper]
  );
  const updatePreviewHeight = useCallback(
    (scrollHeight: number, clientHeight: number) => getPositionMapper().updatePreviewHeight(scrollHeight, clientHeight),
    [getPositionMapper]
  );
  return { pauseSync, resumeSync, updateAST, updateEditorLines, updatePreviewHeight };
}

// =============================================================================
// Sync State Hook
// =============================================================================

interface SyncState {
  isEnabled: boolean;
  mode: SyncMode;
  isEditorToPreviewEnabled: boolean;
  isPreviewToEditorEnabled: boolean;
}

function useSyncState(options: UseScrollSyncOptions): SyncState {
  const storeIsEnabled = useSyncStore(selectIsSyncEnabled);
  const storeMode = useSyncStore((s) => s.mode);
  const isEnabled = options.isEnabled ?? storeIsEnabled;
  const mode = options.mode ?? storeMode;
  const isEditorToPreviewEnabled = useMemo(() => shouldSyncEditorToPreview(mode), [mode]);
  const isPreviewToEditorEnabled = useMemo(() => shouldSyncPreviewToEditor(mode), [mode]);
  return { isEnabled, mode, isEditorToPreviewEnabled, isPreviewToEditorEnabled };
}

// =============================================================================
// Main Hook
// =============================================================================

/**
 * Hook for managing bidirectional scroll synchronization between editor and preview.
 *
 * @param options - Configuration options including refs and mode
 * @returns Sync state and control functions
 */
export function useScrollSync(options: UseScrollSyncOptions): UseScrollSyncResult {
  const { editorRef, previewRef, onSyncStateChange, enableCursorTracking = true } = options;
  const { isEnabled, isEditorToPreviewEnabled, isPreviewToEditorEnabled } = useSyncState(options);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const refs = useSyncRefs();
  const getScrollLock = useScrollLockGetter(refs.scrollLock, setIsSyncing);
  const getPositionMapper = usePositionMapperGetter(refs.positionCache, refs.positionMapper);

  useEffect(() => { onSyncStateChange?.(isSyncing); }, [isSyncing, onSyncStateChange]);

  const syncEditorToPreview = useEditorToPreviewSync(
    editorRef, previewRef, isEnabled, isPaused, isEditorToPreviewEnabled,
    getScrollLock, getPositionMapper, setIsSyncing
  );

  const handlePreviewScrollReport = usePreviewToEditorSync(
    editorRef, isEnabled, isPaused, isPreviewToEditorEnabled,
    getScrollLock, getPositionMapper, setIsSyncing
  );

  usePreviewMessageListener(handlePreviewScrollReport);
  useEditorScrollListener(
    editorRef, isEnabled, isPaused, isEditorToPreviewEnabled,
    syncEditorToPreview, refs.debounceTimer
  );

  // T023, T024, T025: Cursor tracking for typing sync
  useCursorTrackingListener(
    editorRef, isEnabled, isPaused, isEditorToPreviewEnabled,
    enableCursorTracking, syncEditorToPreview,
    refs.lastCursorLine, refs.lastSyncedLine, refs.debounceTimer
  );

  // T029, T030: Cache invalidation on content change
  useContentChangeListener(editorRef, refs.positionCache);

  const { pauseSync, resumeSync, updateAST, updateEditorLines, updatePreviewHeight } =
    useControlFunctions(setIsPaused, getPositionMapper);

  useSyncCleanup(refs);

  const syncPreviewToEditor = useCallback(() => {
    const pos = useSyncStore.getState().previewPosition;
    if (pos?.scrollTop != null) {
      handlePreviewScrollReport({
        type: 'scroll-report', ratio: pos.ratio, scrollTop: pos.scrollTop,
        scrollHeight: 0, clientHeight: 0,
      });
    }
  }, [handlePreviewScrollReport]);

  return {
    isSyncing, syncEditorToPreview, syncPreviewToEditor,
    pauseSync, resumeSync, updateAST, updateEditorLines, updatePreviewHeight,
  };
}

export default useScrollSync;
