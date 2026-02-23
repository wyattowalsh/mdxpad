/**
 * Tests for sync-store.ts
 *
 * Tests sync mode management, lock operations, scroll position handling,
 * cache operations, persistence, and reset.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ScrollPosition, PositionMapping } from '@shared/types/sync';

// ============================================================================
// localStorage Mock
// ============================================================================

const localStorageStore = new Map<string, string>();

const localStorageMock: Storage = {
  getItem: vi.fn((key: string) => localStorageStore.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    localStorageStore.delete(key);
  }),
  clear: vi.fn(() => {
    localStorageStore.clear();
  }),
  get length() {
    return localStorageStore.size;
  },
  key: vi.fn((index: number) => {
    const keys = Array.from(localStorageStore.keys());
    return keys[index] ?? null;
  }),
};

vi.stubGlobal('localStorage', localStorageMock);

// Import after localStorage mock is in place
import { useSyncStore, clearSyncLockTimer } from '../sync-store';

describe('useSyncStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearSyncLockTimer();
    useSyncStore.getState().reset();
    localStorageStore.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearSyncLockTimer();
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start with bidirectional mode', () => {
      const state = useSyncStore.getState();
      expect(state.mode).toBe('bidirectional');
    });

    it('should start with bidirectional as lastActiveMode', () => {
      const state = useSyncStore.getState();
      expect(state.lastActiveMode).toBe('bidirectional');
    });

    it('should start unlocked', () => {
      const state = useSyncStore.getState();
      expect(state.lock.isLocked).toBe(false);
      expect(state.lock.lockSource).toBeNull();
    });

    it('should start not syncing', () => {
      const state = useSyncStore.getState();
      expect(state.isSyncing).toBe(false);
    });

    it('should start with null positions', () => {
      const state = useSyncStore.getState();
      expect(state.editorPosition).toBeNull();
      expect(state.previewPosition).toBeNull();
    });
  });

  describe('setMode', () => {
    it('should set mode', () => {
      useSyncStore.getState().setMode('editorToPreview');
      expect(useSyncStore.getState().mode).toBe('editorToPreview');
    });

    it('should update lastActiveMode for non-disabled modes', () => {
      useSyncStore.getState().setMode('previewToEditor');
      expect(useSyncStore.getState().lastActiveMode).toBe('previewToEditor');
    });

    it('should not update lastActiveMode when setting to disabled', () => {
      useSyncStore.getState().setMode('editorToPreview');
      useSyncStore.getState().setMode('disabled');
      expect(useSyncStore.getState().lastActiveMode).toBe('editorToPreview');
    });
  });

  describe('toggleSync', () => {
    it('should disable sync when currently enabled', () => {
      useSyncStore.getState().toggleSync();
      expect(useSyncStore.getState().mode).toBe('disabled');
    });

    it('should restore last active mode when re-enabling', () => {
      useSyncStore.getState().setMode('editorToPreview');
      useSyncStore.getState().toggleSync(); // disable
      useSyncStore.getState().toggleSync(); // re-enable

      expect(useSyncStore.getState().mode).toBe('editorToPreview');
    });
  });

  describe('acquireLock / releaseLock', () => {
    it('should acquire lock', () => {
      const acquired = useSyncStore.getState().acquireLock('editor');

      expect(acquired).toBe(true);
      expect(useSyncStore.getState().lock.isLocked).toBe(true);
      expect(useSyncStore.getState().lock.lockSource).toBe('editor');
      expect(useSyncStore.getState().isSyncing).toBe(true);
    });

    it('should not re-acquire for same source', () => {
      useSyncStore.getState().acquireLock('editor');
      const reacquired = useSyncStore.getState().acquireLock('editor');

      expect(reacquired).toBe(false);
    });

    it('should release lock', () => {
      useSyncStore.getState().acquireLock('editor');
      useSyncStore.getState().releaseLock();

      expect(useSyncStore.getState().lock.isLocked).toBe(false);
      expect(useSyncStore.getState().isSyncing).toBe(false);
    });

    it('should auto-release lock after debounce time', () => {
      useSyncStore.getState().acquireLock('editor');

      vi.advanceTimersByTime(50); // SYNC_DEBOUNCE_MS

      expect(useSyncStore.getState().lock.isLocked).toBe(false);
    });
  });

  describe('handleEditorScroll / handlePreviewScroll', () => {
    it('should update editor position', () => {
      const position: ScrollPosition = {
        pane: 'editor',
        line: 42,
        scrollTop: null,
        ratio: 0.42,
        timestamp: Date.now(),
      };

      useSyncStore.getState().handleEditorScroll(position);

      expect(useSyncStore.getState().editorPosition).toEqual(position);
      expect(useSyncStore.getState().lastSyncTimestamp).toBe(position.timestamp);
    });

    it('should update preview position', () => {
      const position: ScrollPosition = {
        pane: 'preview',
        line: null,
        scrollTop: 500,
        ratio: 0.5,
        timestamp: Date.now(),
      };

      useSyncStore.getState().handlePreviewScroll(position);

      expect(useSyncStore.getState().previewPosition).toEqual(position);
    });
  });

  describe('updateCache / invalidateCache', () => {
    it('should add mapping to cache', () => {
      const mapping: PositionMapping = {
        editorLine: 10,
        previewScrollTop: 500,
        confidence: 'high',
        timestamp: Date.now(),
      };

      useSyncStore.getState().updateCache(mapping);

      expect(useSyncStore.getState().positionCache.get(10)).toEqual(mapping);
    });

    it('should clear all cache entries', () => {
      useSyncStore.getState().updateCache({
        editorLine: 1,
        previewScrollTop: 0,
        confidence: 'high',
        timestamp: Date.now(),
      });

      useSyncStore.getState().invalidateCache();

      expect(useSyncStore.getState().positionCache.size).toBe(0);
    });
  });

  describe('persistence', () => {
    it('should persist mode to localStorage', () => {
      useSyncStore.getState().setMode('editorToPreview');
      useSyncStore.getState().persist();

      expect(localStorageStore.get('mdxpad:sync:mode')).toBe('"editorToPreview"');
    });

    it('should persist lastActiveMode to localStorage', () => {
      useSyncStore.getState().setMode('previewToEditor');
      useSyncStore.getState().persist();

      expect(localStorageStore.get('mdxpad:sync:last-active-mode')).toBe('"previewToEditor"');
    });

    it('should load mode from localStorage', () => {
      localStorageStore.set('mdxpad:sync:mode', '"editorToPreview"');
      localStorageStore.set('mdxpad:sync:last-active-mode', '"editorToPreview"');

      useSyncStore.getState().loadFromStorage();

      expect(useSyncStore.getState().mode).toBe('editorToPreview');
      expect(useSyncStore.getState().lastActiveMode).toBe('editorToPreview');
    });

    it('should handle invalid JSON in localStorage gracefully', () => {
      localStorageStore.set('mdxpad:sync:mode', 'not-json{');

      useSyncStore.getState().loadFromStorage();

      // Should not crash, keeps current mode
      expect(useSyncStore.getState().mode).toBeDefined();
    });

    it('should handle invalid mode values gracefully', () => {
      localStorageStore.set('mdxpad:sync:mode', '"invalidMode"');

      useSyncStore.getState().loadFromStorage();

      // Should keep default mode since 'invalidMode' is not valid
      expect(useSyncStore.getState().mode).toBe('bidirectional');
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      useSyncStore.getState().setMode('editorToPreview');
      useSyncStore.getState().acquireLock('editor');
      useSyncStore.getState().updateCache({
        editorLine: 1,
        previewScrollTop: 0,
        confidence: 'high',
        timestamp: Date.now(),
      });

      useSyncStore.getState().reset();

      const state = useSyncStore.getState();
      expect(state.mode).toBe('bidirectional');
      expect(state.lock.isLocked).toBe(false);
      expect(state.positionCache.size).toBe(0);
      expect(state.isSyncing).toBe(false);
      expect(state.editorPosition).toBeNull();
      expect(state.previewPosition).toBeNull();
    });
  });
});
