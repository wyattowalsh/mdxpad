/**
 * Tests for UI layout store.
 * Tests visibility toggles, zoom controls, selectors, and persistence.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useUILayoutStore,
  selectPreviewVisible,
  selectSidebarVisible,
  selectZoomLevel,
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
    // Reset store state to defaults
    useUILayoutStore.setState({
      previewVisible: true,
      sidebarVisible: true,
      zoomLevel: 100,
    });
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

  describe('persistence', () => {
    it('persist() should save to localStorage', () => {
      useUILayoutStore.setState({
        previewVisible: false,
        sidebarVisible: false,
        zoomLevel: 150,
      });
      useUILayoutStore.getState().persist();

      // Store uses separate keys per STORAGE_KEYS
      const previewStored = mockStorage.get('mdxpad:ui:preview-visible');
      const zoomStored = mockStorage.get('mdxpad:ui:zoom-level');

      expect(previewStored).toBeDefined();
      expect(zoomStored).toBeDefined();

      expect(JSON.parse(previewStored!)).toBe(false);
      expect(JSON.parse(zoomStored!)).toBe(150);
    });

    it('loadFromStorage() should load from localStorage', () => {
      // Store uses separate keys per STORAGE_KEYS
      mockStorage.set('mdxpad:ui:preview-visible', JSON.stringify(false));
      mockStorage.set('mdxpad:ui:zoom-level', JSON.stringify(175));

      useUILayoutStore.getState().loadFromStorage();
      const state = useUILayoutStore.getState();

      expect(state.previewVisible).toBe(false);
      expect(state.zoomLevel).toBe(175);
    });

    it('loadFromStorage() with invalid data should keep defaults', () => {
      mockStorage.set('mdxpad:ui:preview-visible', 'invalid json{{{');
      mockStorage.set('mdxpad:ui:zoom-level', 'invalid json{{{');

      // Reset to defaults first
      useUILayoutStore.setState({
        previewVisible: true,
        sidebarVisible: true,
        zoomLevel: 100,
      });

      useUILayoutStore.getState().loadFromStorage();
      const state = useUILayoutStore.getState();

      // Should remain at defaults
      expect(state.previewVisible).toBe(true);
      expect(state.sidebarVisible).toBe(true);
      expect(state.zoomLevel).toBe(100);
    });

    it('loadFromStorage() with partial data should use defaults for missing', () => {
      // Only set previewVisible, not zoomLevel
      mockStorage.set('mdxpad:ui:preview-visible', JSON.stringify(false));
      // zoomLevel missing

      useUILayoutStore.getState().loadFromStorage();
      const state = useUILayoutStore.getState();

      expect(state.previewVisible).toBe(false);
      expect(state.sidebarVisible).toBe(true); // default (not persisted)
      expect(state.zoomLevel).toBe(100); // default
    });

    it('loadFromStorage() with null/empty localStorage should keep defaults', () => {
      // mockStorage is already empty from beforeEach
      useUILayoutStore.getState().loadFromStorage();
      const state = useUILayoutStore.getState();

      expect(state.previewVisible).toBe(true);
      expect(state.sidebarVisible).toBe(true);
      expect(state.zoomLevel).toBe(100);
    });

    it('loadFromStorage() should clamp invalid zoom values', () => {
      mockStorage.set('mdxpad:ui:preview-visible', JSON.stringify(true));
      mockStorage.set('mdxpad:ui:zoom-level', JSON.stringify(500)); // way above max

      useUILayoutStore.getState().loadFromStorage();
      const state = useUILayoutStore.getState();

      expect(state.zoomLevel).toBe(200); // clamped to max
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    mockStorage.clear();
    useUILayoutStore.setState({
      previewVisible: true,
      sidebarVisible: true,
      zoomLevel: 100,
    });
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
});
