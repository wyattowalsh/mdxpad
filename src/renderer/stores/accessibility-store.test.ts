/**
 * Accessibility Store Tests
 *
 * Tests for the accessibility store including high contrast mode,
 * reduced motion, large text, and screen reader announcements.
 *
 * @module renderer/stores/accessibility-store.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage before importing the store
const mockStorage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
});

// Import after mocking localStorage
import {
  useAccessibilityStore,
  selectHighContrastEnabled,
  selectReducedMotion,
  selectLargeText,
  selectAnnouncements,
  selectLatestAnnouncement,
  INITIAL_A11Y_STATE,
} from './accessibility-store';

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  useAccessibilityStore.getState().reset();
  mockStorage.clear();
});

// ============================================================================
// Tests
// ============================================================================

describe('useAccessibilityStore', () => {
  describe('initial state', () => {
    it('should start with high contrast disabled', () => {
      const state = useAccessibilityStore.getState();
      expect(state.highContrastEnabled).toBe(false);
    });

    it('should start with reduced motion disabled', () => {
      const state = useAccessibilityStore.getState();
      expect(state.reducedMotion).toBe(false);
    });

    it('should start with large text disabled', () => {
      const state = useAccessibilityStore.getState();
      expect(state.largeText).toBe(false);
    });

    it('should start with no announcements', () => {
      const state = useAccessibilityStore.getState();
      expect(state.screenReaderAnnouncements).toHaveLength(0);
    });
  });

  describe('toggleHighContrast', () => {
    it('should enable high contrast when disabled', () => {
      useAccessibilityStore.getState().toggleHighContrast();
      expect(useAccessibilityStore.getState().highContrastEnabled).toBe(true);
    });

    it('should disable high contrast when enabled', () => {
      useAccessibilityStore.getState().toggleHighContrast();
      useAccessibilityStore.getState().toggleHighContrast();
      expect(useAccessibilityStore.getState().highContrastEnabled).toBe(false);
    });

    it('should set user override flag', () => {
      useAccessibilityStore.getState().toggleHighContrast();
      expect(useAccessibilityStore.getState().highContrastUserOverride).toBe(true);
    });

    it('should persist to localStorage', () => {
      useAccessibilityStore.getState().toggleHighContrast();
      const stored = localStorage.getItem('mdxpad:accessibility');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored ?? '{}') as { highContrastEnabled: boolean };
      expect(parsed.highContrastEnabled).toBe(true);
    });
  });

  describe('toggleReducedMotion', () => {
    it('should enable reduced motion when disabled', () => {
      useAccessibilityStore.getState().toggleReducedMotion();
      expect(useAccessibilityStore.getState().reducedMotion).toBe(true);
    });

    it('should disable reduced motion when enabled', () => {
      useAccessibilityStore.getState().toggleReducedMotion();
      useAccessibilityStore.getState().toggleReducedMotion();
      expect(useAccessibilityStore.getState().reducedMotion).toBe(false);
    });
  });

  describe('toggleLargeText', () => {
    it('should enable large text when disabled', () => {
      useAccessibilityStore.getState().toggleLargeText();
      expect(useAccessibilityStore.getState().largeText).toBe(true);
    });

    it('should disable large text when enabled', () => {
      useAccessibilityStore.getState().toggleLargeText();
      useAccessibilityStore.getState().toggleLargeText();
      expect(useAccessibilityStore.getState().largeText).toBe(false);
    });
  });

  describe('announce', () => {
    it('should add a new announcement', () => {
      useAccessibilityStore.getState().announce('File saved');
      const announcements = useAccessibilityStore.getState().screenReaderAnnouncements;
      expect(announcements).toHaveLength(1);
      expect(announcements.at(0)?.message).toBe('File saved');
    });

    it('should default to polite priority', () => {
      useAccessibilityStore.getState().announce('Update complete');
      const announcements = useAccessibilityStore.getState().screenReaderAnnouncements;
      expect(announcements.at(0)?.priority).toBe('polite');
    });

    it('should support assertive priority', () => {
      useAccessibilityStore.getState().announce('Error occurred', 'assertive');
      const announcements = useAccessibilityStore.getState().screenReaderAnnouncements;
      expect(announcements.at(0)?.priority).toBe('assertive');
    });

    it('should include a timestamp', () => {
      const before = Date.now();
      useAccessibilityStore.getState().announce('Test');
      const after = Date.now();
      const announcements = useAccessibilityStore.getState().screenReaderAnnouncements;
      expect(announcements.at(0)?.timestamp).toBeGreaterThanOrEqual(before);
      expect(announcements.at(0)?.timestamp).toBeLessThanOrEqual(after);
    });

    it('should generate unique IDs', () => {
      useAccessibilityStore.getState().announce('First');
      useAccessibilityStore.getState().announce('Second');
      const announcements = useAccessibilityStore.getState().screenReaderAnnouncements;
      expect(announcements.at(0)?.id).not.toBe(announcements.at(1)?.id);
    });
  });

  describe('clearAnnouncements', () => {
    it('should clear all announcements', () => {
      useAccessibilityStore.getState().announce('First');
      useAccessibilityStore.getState().announce('Second');
      useAccessibilityStore.getState().clearAnnouncements();
      expect(useAccessibilityStore.getState().screenReaderAnnouncements).toHaveLength(0);
    });
  });

  describe('syncHighContrast', () => {
    it('should sync system value when no user override', () => {
      useAccessibilityStore.getState().syncHighContrast(true);
      expect(useAccessibilityStore.getState().highContrastEnabled).toBe(true);
    });

    it('should not sync system value when user has overridden', () => {
      useAccessibilityStore.getState().toggleHighContrast(); // enables and sets override
      useAccessibilityStore.getState().syncHighContrast(false); // system says off
      expect(useAccessibilityStore.getState().highContrastEnabled).toBe(true); // user override preserved
    });
  });

  describe('syncReducedMotion', () => {
    it('should sync system value when no user override', () => {
      useAccessibilityStore.getState().syncReducedMotion(true);
      expect(useAccessibilityStore.getState().reducedMotion).toBe(true);
    });

    it('should not sync system value when user has overridden', () => {
      useAccessibilityStore.getState().toggleReducedMotion();
      useAccessibilityStore.getState().syncReducedMotion(false);
      expect(useAccessibilityStore.getState().reducedMotion).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      useAccessibilityStore.getState().toggleHighContrast();
      useAccessibilityStore.getState().toggleReducedMotion();
      useAccessibilityStore.getState().toggleLargeText();
      useAccessibilityStore.getState().announce('Test');
      useAccessibilityStore.getState().reset();

      const state = useAccessibilityStore.getState();
      expect(state.highContrastEnabled).toBe(INITIAL_A11Y_STATE.highContrastEnabled);
      expect(state.reducedMotion).toBe(INITIAL_A11Y_STATE.reducedMotion);
      expect(state.largeText).toBe(INITIAL_A11Y_STATE.largeText);
      expect(state.screenReaderAnnouncements).toHaveLength(0);
      expect(state.highContrastUserOverride).toBe(false);
      expect(state.reducedMotionUserOverride).toBe(false);
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    useAccessibilityStore.getState().reset();
  });

  describe('selectHighContrastEnabled', () => {
    it('should return high contrast state', () => {
      expect(selectHighContrastEnabled(useAccessibilityStore.getState())).toBe(false);
      useAccessibilityStore.getState().toggleHighContrast();
      expect(selectHighContrastEnabled(useAccessibilityStore.getState())).toBe(true);
    });
  });

  describe('selectReducedMotion', () => {
    it('should return reduced motion state', () => {
      expect(selectReducedMotion(useAccessibilityStore.getState())).toBe(false);
      useAccessibilityStore.getState().toggleReducedMotion();
      expect(selectReducedMotion(useAccessibilityStore.getState())).toBe(true);
    });
  });

  describe('selectLargeText', () => {
    it('should return large text state', () => {
      expect(selectLargeText(useAccessibilityStore.getState())).toBe(false);
      useAccessibilityStore.getState().toggleLargeText();
      expect(selectLargeText(useAccessibilityStore.getState())).toBe(true);
    });
  });

  describe('selectAnnouncements', () => {
    it('should return all announcements', () => {
      useAccessibilityStore.getState().announce('First');
      useAccessibilityStore.getState().announce('Second');
      const announcements = selectAnnouncements(useAccessibilityStore.getState());
      expect(announcements).toHaveLength(2);
    });
  });

  describe('selectLatestAnnouncement', () => {
    it('should return undefined when no announcements', () => {
      expect(selectLatestAnnouncement(useAccessibilityStore.getState())).toBeUndefined();
    });

    it('should return the most recent announcement', () => {
      useAccessibilityStore.getState().announce('First');
      useAccessibilityStore.getState().announce('Second');
      const latest = selectLatestAnnouncement(useAccessibilityStore.getState());
      expect(latest?.message).toBe('Second');
    });
  });
});
