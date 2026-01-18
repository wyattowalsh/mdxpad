/**
 * FilterHighlight Component
 *
 * Renders text with matched characters highlighted.
 * Used in file tree nodes to show which characters matched the filter query.
 *
 * @module renderer/components/file-explorer/FilterHighlight
 * Feature: 014-smart-filtering
 */

import { memo, useMemo } from 'react';
import type { MatchPositions } from '@renderer/lib/fuzzy-match/types';
import { cn } from '@shared/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * A segment of text, either matched or unmatched.
 */
export interface TextSegment {
  /** The text content of this segment */
  readonly text: string;
  /** Whether this segment contains matched characters */
  readonly isMatch: boolean;
}

/**
 * Props for FilterHighlight component.
 */
export interface FilterHighlightProps {
  /**
   * The text to render with highlighting.
   */
  readonly text: string;

  /**
   * Set of character positions (0-indexed) that should be highlighted.
   * If null or empty, text is rendered without highlighting.
   */
  readonly positions: MatchPositions | null;

  /**
   * CSS class name for the highlighted segments.
   * @default 'font-semibold underline'
   */
  readonly highlightClassName?: string;

  /**
   * Optional CSS class name for the wrapper span.
   */
  readonly className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Converts match positions to text segments.
 *
 * Groups consecutive matched and unmatched characters into segments
 * for efficient rendering.
 *
 * @param text - The text to segment
 * @param positions - Set of matched character positions
 * @returns Array of text segments
 *
 * @example
 * ```ts
 * // Text: "MyComponent.tsx"
 * // Positions: {0, 2, 3, 4} (matching "M", "Com")
 * // Returns: [{text: "M", isMatch: true}, {text: "y", isMatch: false}, ...]
 * ```
 */
export function positionsToSegments(
  text: string,
  positions: ReadonlySet<number>
): TextSegment[] {
  if (positions.size === 0) {
    return [{ text, isMatch: false }];
  }

  const segments: TextSegment[] = [];
  let currentSegment = '';
  let currentIsMatch: boolean | null = null;

  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    const isMatch = positions.has(i);

    if (currentIsMatch === null) {
      // First character
      currentIsMatch = isMatch;
      currentSegment = char;
    } else if (isMatch === currentIsMatch) {
      // Continue current segment
      currentSegment += char;
    } else {
      // Segment boundary - push current and start new
      segments.push({ text: currentSegment, isMatch: currentIsMatch });
      currentSegment = char;
      currentIsMatch = isMatch;
    }
  }

  // Push final segment
  if (currentSegment) {
    segments.push({ text: currentSegment, isMatch: currentIsMatch ?? false });
  }

  return segments;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Renders text with matched characters highlighted.
 *
 * Converts match positions to segments and renders each segment
 * with appropriate styling. Matched segments receive highlighting
 * (bold + underline by default).
 *
 * @param props - Component props
 * @returns JSX element
 *
 * @example
 * ```tsx
 * // Basic usage
 * <FilterHighlight
 *   text="MyComponent.tsx"
 *   positions={new Set([2, 3, 4])}
 * />
 *
 * // With custom highlight style
 * <FilterHighlight
 *   text="MyComponent.tsx"
 *   positions={new Set([2, 3, 4])}
 *   highlightClassName="text-primary font-bold"
 * />
 *
 * // No match (renders plain text)
 * <FilterHighlight
 *   text="MyComponent.tsx"
 *   positions={null}
 * />
 * ```
 */
function FilterHighlightComponent(props: FilterHighlightProps): React.JSX.Element {
  const {
    text,
    positions,
    highlightClassName = 'font-semibold underline',
    className,
  } = props;

  // Memoize segment computation to avoid recalculating on every render
  const segments = useMemo(() => {
    if (!positions || positions.size === 0) {
      return [{ text, isMatch: false }];
    }
    return positionsToSegments(text, positions);
  }, [text, positions]);

  // If no highlighting, render plain text
  if (!positions || positions.size === 0) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {segments.map((segment, index) => (
        <span
          key={index}
          className={segment.isMatch ? cn(highlightClassName) : undefined}
        >
          {segment.text}
        </span>
      ))}
    </span>
  );
}

/**
 * Memoized FilterHighlight component.
 */
export const FilterHighlight = memo(FilterHighlightComponent);
FilterHighlight.displayName = 'FilterHighlight';

export default FilterHighlight;
