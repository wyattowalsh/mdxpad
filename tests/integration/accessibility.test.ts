/**
 * Integration tests for Accessibility Store.
 *
 * Tests high contrast toggle, reduced motion, large text,
 * preference persistence, system sync, screen reader announcements,
 * and reset to defaults.
 *
 * @module tests/integration/accessibility.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      const { [key]: _, ...rest } = store;
      store = rest;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// The accessibility store checks `typeof window !== 'undefined'` before
// persisting. In the node test environment we need to provide a window object
// so the persistence code path is exercised.
if (typeof globalThis.window === 'undefined') {
  // Minimal window mock that satisfies the `typeof window` guard.

  (globalThis as any).window = globalThis;
}

// Import after mocks
import {
  useAccessibilityStore,
  INITIAL_A11Y_STATE,
  selectHighContrastEnabled,
  selectReducedMotion,
  selectLargeText,
  selectAnnouncements,
  selectLatestAnnouncement,
} from '@renderer/stores/accessibility-store';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Accessibility Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    act(() => {
      useAccessibilityStore.getState().reset();
    });
  });

  describe('toggle high contrast', () => {
    it('should toggle high contrast on and off', () => {
      expect(selectHighContrastEnabled(useAccessibilityStore.getState())).toBe(false);

      act(() => {
        useAccessibilityStore.getState().toggleHighContrast();
      });

      expect(selectHighContrastEnabled(useAccessibilityStore.getState())).toBe(true);

      act(() => {
        useAccessibilityStore.getState().toggleHighContrast();
      });

      expect(selectHighContrastEnabled(useAccessibilityStore.getState())).toBe(false);
    });

    it('should set user override flag when toggled', () => {
      expect(useAccessibilityStore.getState().highContrastUserOverride).toBe(false);

      act(() => {
        useAccessibilityStore.getState().toggleHighContrast();
      });

      expect(useAccessibilityStore.getState().highContrastUserOverride).toBe(true);
    });
  });

  describe('toggle reduced motion', () => {
    it('should toggle reduced motion on and off', () => {
      expect(selectReducedMotion(useAccessibilityStore.getState())).toBe(false);

      act(() => {
        useAccessibilityStore.getState().toggleReducedMotion();
      });

      expect(selectReducedMotion(useAccessibilityStore.getState())).toBe(true);

      act(() => {
        useAccessibilityStore.getState().toggleReducedMotion();
      });

      expect(selectReducedMotion(useAccessibilityStore.getState())).toBe(false);
    });

    it('should set user override flag when toggled', () => {
      expect(useAccessibilityStore.getState().reducedMotionUserOverride).toBe(false);

      act(() => {
        useAccessibilityStore.getState().toggleReducedMotion();
      });

      expect(useAccessibilityStore.getState().reducedMotionUserOverride).toBe(true);
    });
  });

  describe('toggle large text', () => {
    it('should toggle large text on and off', () => {
      expect(selectLargeText(useAccessibilityStore.getState())).toBe(false);

      act(() => {
        useAccessibilityStore.getState().toggleLargeText();
      });

      expect(selectLargeText(useAccessibilityStore.getState())).toBe(true);

      act(() => {
        useAccessibilityStore.getState().toggleLargeText();
      });

      expect(selectLargeText(useAccessibilityStore.getState())).toBe(false);
    });
  });

  describe('persistence', () => {
    it('should persist preferences to localStorage', () => {
      act(() => {
        useAccessibilityStore.getState().toggleHighContrast();
      });

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const calls = localStorageMock.setItem.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall?.[0]).toBe('mdxpad:accessibility');

      const stored = JSON.parse(lastCall?.[1] ?? '{}');
      expect(stored.highContrastEnabled).toBe(true);
      expect(stored.highContrastUserOverride).toBe(true);
    });

    it('should persist all preference types', () => {
      act(() => {
        useAccessibilityStore.getState().toggleHighContrast();
        useAccessibilityStore.getState().toggleReducedMotion();
        useAccessibilityStore.getState().toggleLargeText();
      });

      const calls = localStorageMock.setItem.mock.calls;
      const lastCall = calls[calls.length - 1];
      const stored = JSON.parse(lastCall?.[1] ?? '{}');

      expect(stored.highContrastEnabled).toBe(true);
      expect(stored.reducedMotion).toBe(true);
      expect(stored.largeText).toBe(true);
    });
  });

  describe('system sync', () => {
    it('should sync high contrast from system when no user override', () => {
      act(() => {
        useAccessibilityStore.getState().syncHighContrast(true);
      });

      expect(selectHighContrastEnabled(useAccessibilityStore.getState())).toBe(true);

      act(() => {
        useAccessibilityStore.getState().syncHighContrast(false);
      });

      expect(selectHighContrastEnabled(useAccessibilityStore.getState())).toBe(false);
    });

    it('should not sync high contrast when user has overridden', () => {
      // User explicitly enables high contrast
      act(() => {
        useAccessibilityStore.getState().toggleHighContrast();
      });

      expect(selectHighContrastEnabled(useAccessibilityStore.getState())).toBe(true);

      // System says no high contrast -- should be ignored
      act(() => {
        useAccessibilityStore.getState().syncHighContrast(false);
      });

      expect(selectHighContrastEnabled(useAccessibilityStore.getState())).toBe(true);
    });

    it('should sync reduced motion from system when no user override', () => {
      act(() => {
        useAccessibilityStore.getState().syncReducedMotion(true);
      });

      expect(selectReducedMotion(useAccessibilityStore.getState())).toBe(true);
    });

    it('should not sync reduced motion when user has overridden', () => {
      act(() => {
        useAccessibilityStore.getState().toggleReducedMotion();
      });

      act(() => {
        useAccessibilityStore.getState().syncReducedMotion(false);
      });

      // User override should take precedence
      expect(selectReducedMotion(useAccessibilityStore.getState())).toBe(true);
    });
  });

  describe('screen reader announcements', () => {
    it('should add announcements', () => {
      act(() => {
        useAccessibilityStore.getState().announce('Document saved');
      });

      const state = useAccessibilityStore.getState();
      const announcements = selectAnnouncements(state);
      expect(announcements).toHaveLength(1);
      expect(announcements[0]?.message).toBe('Document saved');
      expect(announcements[0]?.priority).toBe('polite');
    });

    it('should support assertive priority', () => {
      act(() => {
        useAccessibilityStore.getState().announce('Error occurred!', 'assertive');
      });

      const latest = selectLatestAnnouncement(useAccessibilityStore.getState());
      expect(latest?.priority).toBe('assertive');
    });

    it('should cap announcements at 50', () => {
      act(() => {
        for (let i = 0; i < 55; i++) {
          useAccessibilityStore.getState().announce(`Message ${i}`);
        }
      });

      const announcements = selectAnnouncements(useAccessibilityStore.getState());
      expect(announcements.length).toBeLessThanOrEqual(50);
    });

    it('should clear all announcements', () => {
      act(() => {
        useAccessibilityStore.getState().announce('Test 1');
        useAccessibilityStore.getState().announce('Test 2');
      });

      expect(selectAnnouncements(useAccessibilityStore.getState())).toHaveLength(2);

      act(() => {
        useAccessibilityStore.getState().clearAnnouncements();
      });

      expect(selectAnnouncements(useAccessibilityStore.getState())).toHaveLength(0);
    });

    it('should select the latest announcement', () => {
      act(() => {
        useAccessibilityStore.getState().announce('First');
        useAccessibilityStore.getState().announce('Second');
        useAccessibilityStore.getState().announce('Third');
      });

      const latest = selectLatestAnnouncement(useAccessibilityStore.getState());
      expect(latest?.message).toBe('Third');
    });
  });

  describe('reset to defaults', () => {
    it('should reset all preferences to initial state', () => {
      // Enable everything
      act(() => {
        useAccessibilityStore.getState().toggleHighContrast();
        useAccessibilityStore.getState().toggleReducedMotion();
        useAccessibilityStore.getState().toggleLargeText();
        useAccessibilityStore.getState().announce('test');
      });

      const stateBefore = useAccessibilityStore.getState();
      expect(selectHighContrastEnabled(stateBefore)).toBe(true);
      expect(selectReducedMotion(stateBefore)).toBe(true);
      expect(selectLargeText(stateBefore)).toBe(true);
      expect(selectAnnouncements(stateBefore)).toHaveLength(1);

      // Reset
      act(() => {
        useAccessibilityStore.getState().reset();
      });

      const stateAfter = useAccessibilityStore.getState();
      expect(selectHighContrastEnabled(stateAfter)).toBe(false);
      expect(selectReducedMotion(stateAfter)).toBe(false);
      expect(selectLargeText(stateAfter)).toBe(false);
      expect(selectAnnouncements(stateAfter)).toHaveLength(0);
      expect(stateAfter.highContrastUserOverride).toBe(false);
      expect(stateAfter.reducedMotionUserOverride).toBe(false);
    });

    it('should allow system sync after reset', () => {
      // User overrides
      act(() => {
        useAccessibilityStore.getState().toggleHighContrast();
      });

      // System sync should be blocked
      act(() => {
        useAccessibilityStore.getState().syncHighContrast(false);
      });

      expect(selectHighContrastEnabled(useAccessibilityStore.getState())).toBe(true);

      // Reset clears override
      act(() => {
        useAccessibilityStore.getState().reset();
      });

      // System sync should work again
      act(() => {
        useAccessibilityStore.getState().syncHighContrast(true);
      });

      expect(selectHighContrastEnabled(useAccessibilityStore.getState())).toBe(true);
    });
  });
});
