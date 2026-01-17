/**
 * Outline Navigation Contract
 *
 * Feature: 007-mdx-content-outline
 * Purpose: Define the hook interface for navigating to outline items
 */

import type { EditorView } from '@codemirror/view';
import type { RefObject } from 'react';

// ============================================================================
// Navigation Types
// ============================================================================

/**
 * Location to navigate to in the editor.
 */
export interface OutlineLocation {
  /** Line number (1-indexed) */
  readonly line: number;

  /** Column number (1-indexed), defaults to 1 if not provided */
  readonly column?: number;
}

/**
 * Options for the useOutlineNavigation hook.
 */
export interface UseOutlineNavigationOptions {
  /** Ref to the CodeMirror EditorView */
  readonly editorRef: RefObject<EditorView | null>;

  /** Duration of line highlight in ms (default: 500) */
  readonly highlightDuration?: number;
}

/**
 * Result returned by the useOutlineNavigation hook.
 */
export interface UseOutlineNavigationResult {
  /**
   * Navigate to a specific location in the editor.
   * Positions cursor, scrolls to center, and briefly highlights the line.
   */
  readonly navigateToItem: (location: OutlineLocation) => void;

  /**
   * Whether navigation is currently in progress (for UI feedback).
   */
  readonly isNavigating: boolean;
}

// ============================================================================
// Hook Signature
// ============================================================================

/**
 * Hook for navigating from outline items to editor locations.
 *
 * @example
 * ```tsx
 * const { navigateToItem } = useOutlineNavigation({ editorRef });
 *
 * const handleItemClick = (item: OutlineItem) => {
 *   navigateToItem({ line: item.line, column: item.column });
 * };
 * ```
 */
export type UseOutlineNavigation = (
  options: UseOutlineNavigationOptions
) => UseOutlineNavigationResult;

// ============================================================================
// Highlight Effect Types
// ============================================================================

/**
 * State effect for triggering line highlight.
 * Used internally by the navigation hook.
 */
export interface HighlightEffectValue {
  /** Line number to highlight (1-indexed) */
  readonly line: number;

  /** Duration in ms */
  readonly duration: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default highlight duration in milliseconds */
export const DEFAULT_HIGHLIGHT_DURATION_MS = 500;

/** CSS class applied to highlighted lines */
export const HIGHLIGHT_LINE_CLASS = 'cm-outline-highlight';

/**
 * Scroll behavior for navigation.
 * NOTE: Verified compatible with CodeMirror 6's scrollIntoView.
 * If issues arise, consider using EditorView.scrollIntoView(pos, { y: 'center' }) instead.
 */
export const SCROLL_BEHAVIOR: ScrollIntoViewOptions = {
  block: 'center',
  behavior: 'smooth',
};
