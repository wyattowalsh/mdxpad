/**
 * Position Mapper Module
 *
 * Feature: 008-bidirectional-sync
 *
 * Implements three-tier position mapping between editor lines and preview
 * scroll positions. The mapping strategies are:
 *
 * 1. AST-based (high confidence): Uses source positions from MDX headings
 * 2. DOM-based (medium confidence): Uses data-line attributes (future)
 * 3. Proportional (low confidence): Uses scroll ratio fallback
 *
 * @module renderer/lib/sync/position-mapper
 */

import type { PositionMapping } from '@shared/types/sync';
import type { PositionCache } from './position-cache';

// =============================================================================
// Types
// =============================================================================

/**
 * Source position from AST node.
 */
export interface ASTSourcePosition {
  /** Line number (1-indexed) */
  readonly line: number;
  /** Column number (1-indexed, optional) */
  readonly column?: number;
}

/**
 * Heading node with source position.
 * Used for AST-based position mapping.
 */
export interface HeadingWithPosition {
  /** Heading text content */
  readonly text: string;
  /** Heading depth (1-6) */
  readonly level: number;
  /** Source position in editor */
  readonly position: ASTSourcePosition;
}

/**
 * Position mapper interface.
 * Provides bidirectional mapping between editor and preview positions.
 */
export interface PositionMapper {
  /**
   * Map editor line to preview scroll position.
   * Uses three-tier strategy: AST -> DOM -> Proportional
   *
   * @param editorLine - Line number in editor (1-indexed)
   * @returns Position mapping with scroll position and confidence
   */
  readonly editorToPreview: (editorLine: number) => PositionMapping;

  /**
   * Map preview scroll position to editor line.
   *
   * @param scrollTop - Scroll position in preview (pixels from top)
   * @returns Position mapping with editor line and confidence
   */
  readonly previewToEditor: (scrollTop: number) => PositionMapping;

  /**
   * Update AST data for mapping.
   * Should be called when MDX is recompiled.
   *
   * @param headings - Array of headings with positions from AST
   */
  readonly updateAST: (headings: readonly HeadingWithPosition[]) => void;

  /**
   * Update preview scroll dimensions.
   * Should be called when preview content changes size.
   *
   * @param scrollHeight - Total scrollable height in pixels
   * @param clientHeight - Visible viewport height in pixels
   */
  readonly updatePreviewHeight: (scrollHeight: number, clientHeight: number) => void;

  /**
   * Update editor total line count.
   * Should be called when editor content changes.
   *
   * @param lines - Total number of lines in editor
   */
  readonly updateEditorLines: (lines: number) => void;

  /**
   * Clear all mappings and reset state.
   * Should be called on document change.
   */
  readonly reset: () => void;
}

/**
 * Options for creating a position mapper.
 */
export interface PositionMapperOptions {
  /** Cache for position mappings */
  readonly cache: PositionCache;
  /** Tolerance for heading matching (lines) */
  readonly tolerance?: number;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default tolerance for position matching (lines).
 * Headings within this many lines of the target will be considered matches.
 */
export const DEFAULT_POSITION_TOLERANCE = 5;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build a map of line numbers to headings for fast lookup.
 *
 * @param headings - Array of headings with positions
 * @returns Map of line number to heading
 */
function buildLineMap(
  headings: readonly HeadingWithPosition[]
): Map<number, HeadingWithPosition> {
  const map = new Map<number, HeadingWithPosition>();
  for (const heading of headings) {
    map.set(heading.position.line, heading);
  }
  return map;
}

/**
 * Find the nearest heading to a given line within tolerance.
 *
 * First attempts an exact match, then searches for the nearest heading
 * within the specified tolerance.
 *
 * @param line - Target line number (1-indexed)
 * @param lineMap - Map of line numbers to headings
 * @param tolerance - Maximum line distance to consider (default: 5)
 * @returns Nearest heading or null if none found within tolerance
 */
export function findNearestHeading(
  line: number,
  lineMap: Map<number, HeadingWithPosition>,
  tolerance: number = DEFAULT_POSITION_TOLERANCE
): HeadingWithPosition | null {
  // Try exact match first
  const exact = lineMap.get(line);
  if (exact) {
    return exact;
  }

  // Search for nearest heading within tolerance
  let nearest: HeadingWithPosition | null = null;
  let nearestDistance = Infinity;

  for (const [headingLine, heading] of lineMap) {
    const distance = Math.abs(headingLine - line);
    if (distance < nearestDistance && distance <= tolerance) {
      nearest = heading;
      nearestDistance = distance;
    }
  }

  return nearest;
}

/**
 * Clamp a value to a range.
 *
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate a ratio from line position.
 *
 * @param line - Line number (1-indexed)
 * @param totalLines - Total number of lines
 * @returns Ratio (0-1)
 */
function calculateLineRatio(line: number, totalLines: number): number {
  if (totalLines <= 1) {
    return 0;
  }
  return (line - 1) / (totalLines - 1);
}

/**
 * Calculate line number from ratio.
 *
 * @param ratio - Position ratio (0-1)
 * @param totalLines - Total number of lines
 * @returns Line number (1-indexed)
 */
function calculateLineFromRatio(ratio: number, totalLines: number): number {
  return Math.round(ratio * (totalLines - 1)) + 1;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a position mapper for bidirectional sync.
 *
 * The mapper uses a three-tier strategy to find position mappings:
 *
 * 1. **AST-based (high confidence)**: If the cursor is near a heading,
 *    estimate the preview position based on the heading's position in
 *    the document structure.
 *
 * 2. **DOM-based (medium confidence)**: Query preview DOM for elements
 *    with data-line attributes. (Reserved for future implementation)
 *
 * 3. **Proportional (low confidence)**: Use scroll ratio as a fallback
 *    when no structural mapping is available.
 *
 * @param options - Configuration options including cache and tolerance
 * @returns A position mapper instance
 *
 * @example
 * ```typescript
 * const cache = createPositionCache({ ttl: 1000 });
 * const mapper = createPositionMapper({ cache });
 *
 * // Update with AST data after compilation
 * mapper.updateAST(headings);
 * mapper.updateEditorLines(100);
 * mapper.updatePreviewHeight(2000, 500);
 *
 * // Map positions
 * const previewPos = mapper.editorToPreview(42);
 * const editorPos = mapper.previewToEditor(1000);
 * ```
 */
export function createPositionMapper(options: PositionMapperOptions): PositionMapper {
  const { cache, tolerance = DEFAULT_POSITION_TOLERANCE } = options;

  // Internal state
  let headings: readonly HeadingWithPosition[] = [];
  let totalEditorLines = 0;
  let previewScrollHeight = 0;
  let previewClientHeight = 0;

  /**
   * Map editor line to preview scroll position.
   */
  const editorToPreview = (editorLine: number): PositionMapping => {
    const timestamp = Date.now();

    // Validate input
    if (editorLine < 1) {
      return {
        editorLine: 1,
        previewScrollTop: 0,
        confidence: 'low',
        timestamp,
      };
    }

    // Check cache first
    const cached = cache.get(editorLine);
    if (cached) {
      return cached;
    }

    // Calculate max scroll position
    const maxScrollTop = Math.max(0, previewScrollHeight - previewClientHeight);

    // Strategy 1: AST-based mapping (high confidence)
    if (headings.length > 0) {
      const lineMap = buildLineMap(headings);
      const heading = findNearestHeading(editorLine, lineMap, tolerance);

      if (heading) {
        // Find heading index in the ordered list
        const headingIndex = headings.findIndex(
          (h) => h.position.line === heading.position.line
        );

        // Calculate ratio based on heading position in document
        const ratio = headings.length > 1
          ? headingIndex / (headings.length - 1)
          : 0;

        const scrollTop = clamp(ratio * maxScrollTop, 0, maxScrollTop);

        const mapping: PositionMapping = {
          editorLine,
          previewScrollTop: scrollTop,
          confidence: 'high',
          timestamp,
        };

        cache.set(editorLine, mapping);
        return mapping;
      }

      // If no nearby heading, interpolate between headings
      const sortedHeadings = [...headings].sort(
        (a, b) => a.position.line - b.position.line
      );

      // Find surrounding headings
      let prevHeading: HeadingWithPosition | null = null;
      let nextHeading: HeadingWithPosition | null = null;

      for (const h of sortedHeadings) {
        if (h.position.line <= editorLine) {
          prevHeading = h;
        } else if (!nextHeading) {
          nextHeading = h;
          break;
        }
      }

      // Interpolate between headings if both exist
      if (prevHeading && nextHeading) {
        const prevIndex = sortedHeadings.indexOf(prevHeading);
        const nextIndex = sortedHeadings.indexOf(nextHeading);

        const prevLine = prevHeading.position.line;
        const nextLine = nextHeading.position.line;

        // Calculate local ratio between headings
        const localRatio = (editorLine - prevLine) / (nextLine - prevLine);

        // Calculate global ratios for headings
        const prevRatio = prevIndex / (sortedHeadings.length - 1);
        const nextRatio = nextIndex / (sortedHeadings.length - 1);

        // Interpolate
        const ratio = prevRatio + localRatio * (nextRatio - prevRatio);
        const scrollTop = clamp(ratio * maxScrollTop, 0, maxScrollTop);

        const mapping: PositionMapping = {
          editorLine,
          previewScrollTop: scrollTop,
          confidence: 'medium',
          timestamp,
        };

        cache.set(editorLine, mapping);
        return mapping;
      }
    }

    // Strategy 3: Proportional fallback (low confidence)
    const ratio = calculateLineRatio(editorLine, totalEditorLines);
    const scrollTop = clamp(ratio * maxScrollTop, 0, maxScrollTop);

    const mapping: PositionMapping = {
      editorLine,
      previewScrollTop: scrollTop,
      confidence: 'low',
      timestamp,
    };

    cache.set(editorLine, mapping);
    return mapping;
  };

  /**
   * Map preview scroll position to editor line.
   */
  const previewToEditor = (scrollTop: number): PositionMapping => {
    const timestamp = Date.now();
    const maxScrollTop = Math.max(0, previewScrollHeight - previewClientHeight);

    // Calculate ratio from scroll position
    const ratio = maxScrollTop > 0 ? clamp(scrollTop / maxScrollTop, 0, 1) : 0;

    // If we have headings, try to find the nearest one
    if (headings.length > 0) {
      const sortedHeadings = [...headings].sort(
        (a, b) => a.position.line - b.position.line
      );

      // Find which heading index this ratio corresponds to
      const headingRatio = ratio * (sortedHeadings.length - 1);
      const headingIndex = Math.round(headingRatio);
      const heading = sortedHeadings[clamp(headingIndex, 0, sortedHeadings.length - 1)];

      if (heading) {
        return {
          editorLine: heading.position.line,
          previewScrollTop: scrollTop,
          confidence: 'medium',
          timestamp,
        };
      }
    }

    // Proportional fallback
    const line = calculateLineFromRatio(ratio, totalEditorLines);
    const clampedLine = clamp(line, 1, Math.max(1, totalEditorLines));

    return {
      editorLine: clampedLine,
      previewScrollTop: scrollTop,
      confidence: 'low',
      timestamp,
    };
  };

  /**
   * Update AST data for mapping.
   */
  const updateAST = (newHeadings: readonly HeadingWithPosition[]): void => {
    headings = newHeadings;
    cache.clear();
  };

  /**
   * Update preview scroll dimensions.
   */
  const updatePreviewHeight = (scrollHeight: number, clientHeight: number): void => {
    // Only clear cache if dimensions actually changed significantly
    const scrollChanged = Math.abs(previewScrollHeight - scrollHeight) > 10;
    const clientChanged = Math.abs(previewClientHeight - clientHeight) > 10;

    previewScrollHeight = scrollHeight;
    previewClientHeight = clientHeight;

    if (scrollChanged || clientChanged) {
      cache.clear();
    }
  };

  /**
   * Update editor total line count.
   */
  const updateEditorLines = (lines: number): void => {
    // Only clear cache if line count changed significantly
    if (Math.abs(totalEditorLines - lines) > 1) {
      cache.clear();
    }
    totalEditorLines = lines;
  };

  /**
   * Reset all state.
   */
  const reset = (): void => {
    headings = [];
    totalEditorLines = 0;
    previewScrollHeight = 0;
    previewClientHeight = 0;
    cache.clear();
  };

  return {
    editorToPreview,
    previewToEditor,
    updateAST,
    updatePreviewHeight,
    updateEditorLines,
    reset,
  };
}

