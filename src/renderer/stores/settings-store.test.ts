/**
 * Tests for Settings Store.
 *
 * Tests settings panel visibility state management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore, selectSettingsOpen } from './settings-store';

// =============================================================================
// TEST HELPERS
// =============================================================================

const INITIAL_STATE = {
  isOpen: false,
};

// =============================================================================
// TESTS
// =============================================================================

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState(INITIAL_STATE);
  });

  describe('initial state', () => {
    it('should start with settings panel closed', () => {
      const state = useSettingsStore.getState();
      expect(state.isOpen).toBe(false);
    });
  });

  describe('open', () => {
    it('should open settings panel', () => {
      useSettingsStore.getState().open();
      const state = useSettingsStore.getState();

      expect(state.isOpen).toBe(true);
    });

    it('should remain open when called multiple times', () => {
      useSettingsStore.getState().open();
      useSettingsStore.getState().open();

      expect(useSettingsStore.getState().isOpen).toBe(true);
    });
  });

  describe('close', () => {
    it('should close settings panel', () => {
      useSettingsStore.setState({ isOpen: true });

      useSettingsStore.getState().close();
      const state = useSettingsStore.getState();

      expect(state.isOpen).toBe(false);
    });

    it('should remain closed when called multiple times', () => {
      useSettingsStore.getState().close();
      useSettingsStore.getState().close();

      expect(useSettingsStore.getState().isOpen).toBe(false);
    });
  });

  describe('toggle', () => {
    it('should toggle from closed to open', () => {
      useSettingsStore.getState().toggle();

      expect(useSettingsStore.getState().isOpen).toBe(true);
    });

    it('should toggle from open to closed', () => {
      useSettingsStore.setState({ isOpen: true });

      useSettingsStore.getState().toggle();

      expect(useSettingsStore.getState().isOpen).toBe(false);
    });

    it('should toggle multiple times correctly', () => {
      useSettingsStore.getState().toggle();
      expect(useSettingsStore.getState().isOpen).toBe(true);

      useSettingsStore.getState().toggle();
      expect(useSettingsStore.getState().isOpen).toBe(false);

      useSettingsStore.getState().toggle();
      expect(useSettingsStore.getState().isOpen).toBe(true);
    });
  });

  describe('interaction workflow', () => {
    it('should handle open -> close flow', () => {
      useSettingsStore.getState().open();
      expect(useSettingsStore.getState().isOpen).toBe(true);

      useSettingsStore.getState().close();
      expect(useSettingsStore.getState().isOpen).toBe(false);
    });

    it('should handle toggle workflow', () => {
      // Start closed
      expect(useSettingsStore.getState().isOpen).toBe(false);

      // Toggle open
      useSettingsStore.getState().toggle();
      expect(useSettingsStore.getState().isOpen).toBe(true);

      // Toggle closed
      useSettingsStore.getState().toggle();
      expect(useSettingsStore.getState().isOpen).toBe(false);
    });

    it('should handle mixed open/close/toggle calls', () => {
      useSettingsStore.getState().open();
      expect(useSettingsStore.getState().isOpen).toBe(true);

      useSettingsStore.getState().toggle();
      expect(useSettingsStore.getState().isOpen).toBe(false);

      useSettingsStore.getState().toggle();
      expect(useSettingsStore.getState().isOpen).toBe(true);

      useSettingsStore.getState().close();
      expect(useSettingsStore.getState().isOpen).toBe(false);
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    useSettingsStore.setState(INITIAL_STATE);
  });

  describe('selectSettingsOpen', () => {
    it('should return false when closed', () => {
      expect(selectSettingsOpen(useSettingsStore.getState())).toBe(false);
    });

    it('should return true when open', () => {
      useSettingsStore.getState().open();
      expect(selectSettingsOpen(useSettingsStore.getState())).toBe(true);
    });

    it('should reflect toggle changes', () => {
      useSettingsStore.getState().toggle();
      expect(selectSettingsOpen(useSettingsStore.getState())).toBe(true);

      useSettingsStore.getState().toggle();
      expect(selectSettingsOpen(useSettingsStore.getState())).toBe(false);
    });
  });
});
