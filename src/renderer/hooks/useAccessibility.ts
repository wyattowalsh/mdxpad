/**
 * Accessibility Hook
 *
 * Listens to system accessibility preferences via media queries
 * and syncs them with the accessibility store. Respects user overrides.
 *
 * @module renderer/hooks/useAccessibility
 */

import { useEffect } from 'react';
import { useAccessibilityStore } from '@renderer/stores/accessibility-store';

// ============================================================================
// Types
// ============================================================================

/**
 * Return type of the useAccessibility hook.
 */
export interface UseAccessibilityReturn {
  readonly highContrastEnabled: boolean;
  readonly reducedMotion: boolean;
  readonly largeText: boolean;
  readonly toggleHighContrast: () => void;
  readonly toggleReducedMotion: () => void;
  readonly toggleLargeText: () => void;
  readonly announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

// ============================================================================
// Media Query Hooks
// ============================================================================

/** Sync prefers-contrast media query with the store. */
function useContrastMediaQuery(): void {
  const syncHighContrast = useAccessibilityStore((state) => state.syncHighContrast);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(prefers-contrast: more)');
    syncHighContrast(query.matches);
    const handler = (e: MediaQueryListEvent): void => syncHighContrast(e.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, [syncHighContrast]);
}

/** Sync prefers-reduced-motion media query with the store. */
function useMotionMediaQuery(): void {
  const syncReducedMotion = useAccessibilityStore((state) => state.syncReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    syncReducedMotion(query.matches);
    const handler = (e: MediaQueryListEvent): void => syncReducedMotion(e.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, [syncReducedMotion]);
}

/** Apply CSS classes to the document root based on accessibility state. */
function useA11yCssClasses(
  highContrast: boolean,
  reducedMotion: boolean,
  largeText: boolean
): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('high-contrast', highContrast);
    root.classList.toggle('reduced-motion', reducedMotion);
    root.classList.toggle('large-text', largeText);
  }, [highContrast, reducedMotion, largeText]);
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing accessibility preferences.
 *
 * Listens to `prefers-contrast: more` and `prefers-reduced-motion: reduce`
 * media queries and syncs system preferences with the store.
 * User overrides take precedence over system preferences.
 *
 * @returns Current accessibility state and toggle functions
 */
export function useAccessibility(): UseAccessibilityReturn {
  const highContrastEnabled = useAccessibilityStore((s) => s.highContrastEnabled);
  const reducedMotion = useAccessibilityStore((s) => s.reducedMotion);
  const largeText = useAccessibilityStore((s) => s.largeText);
  const toggleHighContrast = useAccessibilityStore((s) => s.toggleHighContrast);
  const toggleReducedMotion = useAccessibilityStore((s) => s.toggleReducedMotion);
  const toggleLargeText = useAccessibilityStore((s) => s.toggleLargeText);
  const announce = useAccessibilityStore((s) => s.announce);

  useContrastMediaQuery();
  useMotionMediaQuery();
  useA11yCssClasses(highContrastEnabled, reducedMotion, largeText);

  return {
    highContrastEnabled,
    reducedMotion,
    largeText,
    toggleHighContrast,
    toggleReducedMotion,
    toggleLargeText,
    announce,
  };
}
