/**
 * Accessibility Hook Tests
 *
 * Tests for the useAccessibility hook including system preference
 * detection and CSS class application.
 *
 * @module renderer/hooks/useAccessibility.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock localStorage before importing the store
const mockStorage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
});

import { useAccessibility } from './useAccessibility';
import { useAccessibilityStore } from '@renderer/stores/accessibility-store';

// ============================================================================
// Mock Setup
// ============================================================================

interface MockMediaQueryList {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  media: string;
  onchange: null;
  addListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  dispatchEvent: ReturnType<typeof vi.fn>;
}

function createMockMediaQueryList(matches: boolean): MockMediaQueryList {
  return {
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useAccessibility', () => {
  let contrastQuery: MockMediaQueryList;
  let motionQuery: MockMediaQueryList;

  beforeEach(() => {
    useAccessibilityStore.getState().reset();
    mockStorage.clear();

    contrastQuery = createMockMediaQueryList(false);
    motionQuery = createMockMediaQueryList(false);

    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
      if (query === '(prefers-contrast: more)') {
        return contrastQuery as unknown as MediaQueryList;
      }
      if (query === '(prefers-reduced-motion: reduce)') {
        return motionQuery as unknown as MediaQueryList;
      }
      return createMockMediaQueryList(false) as unknown as MediaQueryList;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove('high-contrast', 'reduced-motion', 'large-text');
  });

  it('should return current accessibility state', () => {
    const { result } = renderHook(() => useAccessibility());
    expect(result.current.highContrastEnabled).toBe(false);
    expect(result.current.reducedMotion).toBe(false);
    expect(result.current.largeText).toBe(false);
  });

  it('should listen to prefers-contrast media query', () => {
    renderHook(() => useAccessibility());
    expect(contrastQuery.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should listen to prefers-reduced-motion media query', () => {
    renderHook(() => useAccessibility());
    expect(motionQuery.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should clean up media query listeners on unmount', () => {
    const { unmount } = renderHook(() => useAccessibility());
    unmount();
    expect(contrastQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(motionQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should apply CSS class when high contrast is toggled', () => {
    const { result } = renderHook(() => useAccessibility());

    act(() => {
      result.current.toggleHighContrast();
    });

    expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
  });

  it('should apply CSS class when large text is toggled', () => {
    const { result } = renderHook(() => useAccessibility());

    act(() => {
      result.current.toggleLargeText();
    });

    expect(document.documentElement.classList.contains('large-text')).toBe(true);
  });

  it('should provide announce function', () => {
    const { result } = renderHook(() => useAccessibility());
    expect(typeof result.current.announce).toBe('function');

    act(() => {
      result.current.announce('Test message');
    });

    const state = useAccessibilityStore.getState();
    expect(state.screenReaderAnnouncements).toHaveLength(1);
  });
});
