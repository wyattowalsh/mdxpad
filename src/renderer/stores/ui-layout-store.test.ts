/**
 * Tests for UI layout store.
 * Tests visibility toggles, zoom controls, split ratio, selectors, and persistence.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useUILayoutStore,
  selectPreviewVisible,
  selectSidebarVisible,
  selectZoomLevel,
  selectSplitRatio,
  cancelDebouncedPersistSplitRatio,
  flushDebouncedPersistSplitRatio,
} from './ui-layout-store';

// Mock localStorage
const mockStorage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
});

describe('useUILayoutStore', () => {
  beforeEach(() => {
    mockStorage.clear();
    // Cancel any pending debounced persistence
    cancelDebouncedPersistSplitRatio();
    // Reset store state to defaults
    useUILayoutStore.setState({
      previewVisible: true,
      sidebarVisible: true,
      zoomLevel: 100,
      splitRatio: 0.5,
    });
  });

  afterEach(() => {
    // Cleanup any pending timers
    cancelDebouncedPersistSplitRatio();
  });

  describe('initial state', () => {
    it('should start with previewVisible true', () => {
      const state = useUILayoutStore.getState();
      expect(state.previewVisible).toBe(true);
    });

    it('should start with sidebarVisible true', () => {
      const state = useUILayoutStore.getState();
      expect(state.sidebarVisible).toBe(true);
    });

    it('should start with zoomLevel 100', () => {
      const state = useUILayoutStore.getState();
      expect(state.zoomLevel).toBe(100);
    });

    it('should start with splitRatio 0.5', () => {
      const state = useUILayoutStore.getState();
      expect(state.splitRatio).toBe(0.5);
    });
  });

  describe('preview actions', () => {
    it('togglePreview should toggle previewVisible from true to false', () => {
      useUILayoutStore.getState().togglePreview();
      const state = useUILayoutStore.getState();
      expect(state.previewVisible).toBe(false);
    });

    it('togglePreview should toggle previewVisible from false to true', () => {
      useUILayoutStore.setState({ previewVisible: false });
      useUILayoutStore.getState().togglePreview();
      const state = useUILayoutStore.getState();
      expect(state.previewVisible).toBe(true);
    });

    it('setPreviewVisible(true) should set visible', () => {
      useUILayoutStore.setState({ previewVisible: false });
      useUILayoutStore.getState().setPreviewVisible(true);
      const state = useUILayoutStore.getState();
      expect(state.previewVisible).toBe(true);
    });

    it('setPreviewVisible(false) should set hidden', () => {
      useUILayoutStore.getState().setPreviewVisible(false);
      const state = useUILayoutStore.getState();
      expect(state.previewVisible).toBe(false);
    });
  });

  describe('sidebar actions', () => {
    it('toggleSidebar should toggle sidebarVisible from true to false', () => {
      useUILayoutStore.getState().toggleSidebar();
      const state = useUILayoutStore.getState();
      expect(state.sidebarVisible).toBe(false);
    });

    it('toggleSidebar should toggle sidebarVisible from false to true', () => {
      useUILayoutStore.setState({ sidebarVisible: false });
      useUILayoutStore.getState().toggleSidebar();
      const state = useUILayoutStore.getState();
      expect(state.sidebarVisible).toBe(true);
    });

    it('setSidebarVisible(true) should set visible', () => {
      useUILayoutStore.setState({ sidebarVisible: false });
      useUILayoutStore.getState().setSidebarVisible(true);
      const state = useUILayoutStore.getState();
      expect(state.sidebarVisible).toBe(true);
    });

    it('setSidebarVisible(false) should set hidden', () => {
      useUILayoutStore.getState().setSidebarVisible(false);
      const state = useUILayoutStore.getState();
      expect(state.sidebarVisible).toBe(false);
    });
  });

  describe('zoom actions', () => {
    it('setZoomLevel(150) should set zoom to 150', () => {
      useUILayoutStore.getState().setZoomLevel(150);
      const state = useUILayoutStore.getState();
      expect(state.zoomLevel).toBe(150);
    });

    it('setZoomLevel(30) should clamp to 50 (min)', () => {
      useUILayoutStore.getState().setZoomLevel(30);
      const state = useUILayoutStore.getState();
      expect(state.zoomLevel).toBe(50);
    });

    it('setZoomLevel(250) should clamp to 200 (max)', () => {
      useUILayoutStore.getState().setZoomLevel(250);
      const state = useUILayoutStore.getState();
      expect(state.zoomLevel).toBe(200);
    });

    it('zoomIn from 100 should go to 110', () => {
      useUILayoutStore.getState().zoomIn();
      const state = useUILayoutStore.getState();
      expect(state.zoomLevel).toBe(110);
    });

    it('zoomIn from 200 should stay at 200 (max)', () => {
      useUILayoutStore.setState({ zoomLevel: 200 });
      useUILayoutStore.getState().zoomIn();
      const state = useUILayoutStore.getState();
      expect(state.zoomLevel).toBe(200);
    });

    it('zoomOut from 100 should go to 90', () => {
      useUILayoutStore.getState().zoomOut();
      const state = useUILayoutStore.getState();
      expect(state.zoomLevel).toBe(90);
    });

    it('zoomOut from 50 should stay at 50 (min)', () => {
      useUILayoutStore.setState({ zoomLevel: 50 });
      useUILayoutStore.getState().zoomOut();
      const state = useUILayoutStore.getState();
      expect(state.zoomLevel).toBe(50);
    });

    it('resetZoom should set to 100', () => {
      useUILayoutStore.setState({ zoomLevel: 150 });
      useUILayoutStore.getState().resetZoom();
      const state = useUILayoutStore.getState();
      expect(state.zoomLevel).toBe(100);
    });
  });

  describe('split ratio actions', () => {
    it('setSplitRatio updates splitRatio', () => {
      useUILayoutStore.getState().setSplitRatio(0.7);
      const state = useUILayoutStore.getState();
      expect(state.splitRatio).toBe(0.7);
    });

    it('setSplitRatio clamps values below 0.1 to 0.1', () => {
      useUILayoutStore.getState().setSplitRatio(0.05);
      const state = useUILayoutStore.getState();
      expect(state.splitRatio).toBe(0.1);
    });

    it('setSplitRatio clamps values above 0.9 to 0.9', () => {
      useUILayoutStore.getState().setSplitRatio(0.95);
      const state = useUILayoutStore.getState();
      expect(state.splitRatio).toBe(0.9);
    });

    it('setSplitRatio clamps negative values to 0.1', () => {
      useUILayoutStore.getState().setSplitRatio(-0.5);
      const state = useUILayoutStore.getState();
      expect(state.splitRatio).toBe(0.1);
    });

    it('setSplitRatio clamps values greater than 1 to 0.9', () => {
      useUILayoutStore.getState().setSplitRatio(1.5);
      const state = useUILayoutStore.getState();
      expect(state.splitRatio).toBe(0.9);
    });

    it('resetSplitRatio sets ratio to 0.5', () => {
      useUILayoutStore.setState({ splitRatio: 0.8 });
      useUILayoutStore.getState().resetSplitRatio();
      const state = useUILayoutStore.getState();
      expect(state.splitRatio).toBe(0.5);
    });
  });

  describe('persistence', () => {
    it('persist() should save to localStorage', () => {
      useUILayoutStore.setState({
        previewVisible: false,
        sidebarVisible: false,
        zoomLevel: 150,
        splitRatio: 0.7,
      });
      useUILayoutStore.getState().persist();

      // Store uses separate keys per STORAGE_KEYS
      const previewStored = mockStorage.get('mdxpad:ui:preview-visible');
      const zoomStored = mockStorage.get('mdxpad:ui:zoom-level');
      const splitRatioStored = mockStorage.get('mdxpad:ui:split-ratio');

      expect(previewStored).toBeDefined();
      expect(zoomStored).toBeDefined();
      expect(splitRatioStored).toBeDefined();

      expect(JSON.parse(previewStored!)).toBe(false);
      expect(JSON.parse(zoomStored!)).toBe(150);
      expect(JSON.parse(splitRatioStored!)).toBe(0.7);
    });

    it('loadFromStorage() should load from localStorage', () => {
      // Store uses separate keys per STORAGE_KEYS
      mockStorage.set('mdxpad:ui:preview-visible', JSON.stringify(false));
      mockStorage.set('mdxpad:ui:zoom-level', JSON.stringify(175));
      mockStorage.set('mdxpad:ui:split-ratio', JSON.stringify(0.3));

      useUILayoutStore.getState().loadFromStorage();
      const state = useUILayoutStore.getState();

      expect(state.previewVisible).toBe(false);
      expect(state.zoomLevel).toBe(175);
      expect(state.splitRatio).toBe(0.3);
    });

    it('loadFromStorage() with invalid data should keep defaults', () => {
      mockStorage.set('mdxpad:ui:preview-visible', 'invalid json{{{');
      mockStorage.set('mdxpad:ui:zoom-level', 'invalid json{{{');
      mockStorage.set('mdxpad:ui:split-ratio', 'invalid json{{{');

      // Reset to defaults first
      useUILayoutStore.setState({
        previewVisible: true,
        sidebarVisible: true,
        zoomLevel: 100,
        splitRatio: 0.5,
      });

      useUILayoutStore.getState().loadFromStorage();
      const state = useUILayoutStore.getState();

      // Should remain at defaults
      expect(state.previewVisible).toBe(true);
      expect(state.sidebarVisible).toBe(true);
      expect(state.zoomLevel).toBe(100);
      expect(state.splitRatio).toBe(0.5);
    });

    it('loadFromStorage() with partial data should use defaults for missing', () => {
      // Only set previewVisible, not zoomLevel or splitRatio
      mockStorage.set('mdxpad:ui:preview-visible', JSON.stringify(false));
      // zoomLevel missing
      // splitRatio missing

      useUILayoutStore.getState().loadFromStorage();
      const state = useUILayoutStore.getState();

      expect(state.previewVisible).toBe(false);
      expect(state.sidebarVisible).toBe(true); // default (not persisted)
      expect(state.zoomLevel).toBe(100); // default
      expect(state.splitRatio).toBe(0.5); // default
    });

    it('loadFromStorage() with null/empty localStorage should keep defaults', () => {
      // mockStorage is already empty from beforeEach
      useUILayoutStore.getState().loadFromStorage();
      const state = useUILayoutStore.getState();

      expect(state.previewVisible).toBe(true);
      expect(state.sidebarVisible).toBe(true);
      expect(state.zoomLevel).toBe(100);
      expect(state.splitRatio).toBe(0.5);
    });

    it('loadFromStorage() should clamp invalid zoom values', () => {
      mockStorage.set('mdxpad:ui:preview-visible', JSON.stringify(true));
      mockStorage.set('mdxpad:ui:zoom-level', JSON.stringify(500)); // way above max

      useUILayoutStore.getState().loadFromStorage();
      const state = useUILayoutStore.getState();

      expect(state.zoomLevel).toBe(200); // clamped to max
    });

    it('loadFromStorage() should clamp invalid splitRatio values', () => {
      mockStorage.set('mdxpad:ui:split-ratio', JSON.stringify(1.5)); // way above max

      useUILayoutStore.getState().loadFromStorage();
      const state = useUILayoutStore.getState();

      expect(state.splitRatio).toBe(0.9); // clamped to max
    });

    it('loadFromStorage() should clamp splitRatio below min', () => {
      mockStorage.set('mdxpad:ui:split-ratio', JSON.stringify(0.01)); // below min

      useUILayoutStore.getState().loadFromStorage();
      const state = useUILayoutStore.getState();

      expect(state.splitRatio).toBe(0.1); // clamped to min
    });

    it('splitRatio persists to localStorage with debounce', async () => {
      // Use fake timers for this test
      vi.useFakeTimers();

      useUILayoutStore.getState().setSplitRatio(0.6);

      // Immediately after setSplitRatio, localStorage should NOT be updated yet (debounced)
      expect(mockStorage.get('mdxpad:ui:split-ratio')).toBeUndefined();

      // Advance timer by 500ms (the debounce delay)
      vi.advanceTimersByTime(500);

      // Now localStorage should be updated
      const stored = mockStorage.get('mdxpad:ui:split-ratio');
      expect(stored).toBeDefined();
      expect(JSON.parse(stored!)).toBe(0.6);

      vi.useRealTimers();
    });

    it('splitRatio debounce cancels previous pending write', async () => {
      vi.useFakeTimers();

      // Set ratio multiple times in quick succession
      useUILayoutStore.getState().setSplitRatio(0.6);
      vi.advanceTimersByTime(200); // Not yet 500ms
      useUILayoutStore.getState().setSplitRatio(0.7);
      vi.advanceTimersByTime(200); // Still not 500ms from second call
      useUILayoutStore.getState().setSplitRatio(0.8);

      // No writes yet
      expect(mockStorage.get('mdxpad:ui:split-ratio')).toBeUndefined();

      // Advance to complete the final debounce
      vi.advanceTimersByTime(500);

      // Only the final value should be stored
      const stored = mockStorage.get('mdxpad:ui:split-ratio');
      expect(JSON.parse(stored!)).toBe(0.8);

      vi.useRealTimers();
    });

    it('splitRatio immediate update via state even with debounced persistence', () => {
      // State should update immediately
      useUILayoutStore.getState().setSplitRatio(0.75);
      const state = useUILayoutStore.getState();
      expect(state.splitRatio).toBe(0.75);
      // Note: localStorage will be updated after debounce (tested separately)
    });

    it('flushDebouncedPersistSplitRatio bypasses debounce', () => {
      // Use the flush helper to immediately persist
      flushDebouncedPersistSplitRatio(0.65);

      const stored = mockStorage.get('mdxpad:ui:split-ratio');
      expect(stored).toBeDefined();
      expect(JSON.parse(stored!)).toBe(0.65);
    });

    it('previewVisible state persisted and restored on app launch', () => {
      // Simulate app saving state
      useUILayoutStore.setState({ previewVisible: false });
      useUILayoutStore.getState().persist();

      // Verify it was saved
      expect(JSON.parse(mockStorage.get('mdxpad:ui:preview-visible')!)).toBe(false);

      // Simulate app restart - reset state to defaults
      useUILayoutStore.setState({ previewVisible: true });

      // Load from storage (simulates app launch)
      useUILayoutStore.getState().loadFromStorage();

      // Should restore the persisted value
      expect(useUILayoutStore.getState().previewVisible).toBe(false);
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    mockStorage.clear();
    cancelDebouncedPersistSplitRatio();
    useUILayoutStore.setState({
      previewVisible: true,
      sidebarVisible: true,
      zoomLevel: 100,
      splitRatio: 0.5,
    });
  });

  afterEach(() => {
    cancelDebouncedPersistSplitRatio();
  });

  describe('selectPreviewVisible', () => {
    it('should return previewVisible when true', () => {
      expect(selectPreviewVisible(useUILayoutStore.getState())).toBe(true);
    });

    it('should return previewVisible when false', () => {
      useUILayoutStore.setState({ previewVisible: false });
      expect(selectPreviewVisible(useUILayoutStore.getState())).toBe(false);
    });
  });

  describe('selectSidebarVisible', () => {
    it('should return sidebarVisible when true', () => {
      expect(selectSidebarVisible(useUILayoutStore.getState())).toBe(true);
    });

    it('should return sidebarVisible when false', () => {
      useUILayoutStore.setState({ sidebarVisible: false });
      expect(selectSidebarVisible(useUILayoutStore.getState())).toBe(false);
    });
  });

  describe('selectZoomLevel', () => {
    it('should return zoomLevel at default', () => {
      expect(selectZoomLevel(useUILayoutStore.getState())).toBe(100);
    });

    it('should return zoomLevel after change', () => {
      useUILayoutStore.getState().setZoomLevel(175);
      expect(selectZoomLevel(useUILayoutStore.getState())).toBe(175);
    });
  });

  describe('selectSplitRatio', () => {
    it('should return splitRatio at default', () => {
      expect(selectSplitRatio(useUILayoutStore.getState())).toBe(0.5);
    });

    it('should return splitRatio after change', () => {
      useUILayoutStore.getState().setSplitRatio(0.7);
      expect(selectSplitRatio(useUILayoutStore.getState())).toBe(0.7);
    });
  });
});
