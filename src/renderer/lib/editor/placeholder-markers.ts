/**
 * Placeholder Marker Extension for CodeMirror
 *
 * Provides visual highlighting for static placeholder markers in MDX templates.
 * Supports both bracket syntax [TODO: ...] and HTML comment syntax <!-- TODO: ... -->
 *
 * Feature: 016-template-library
 * Requirements: FR-025, FR-028
 *
 * @module renderer/lib/editor/placeholder-markers
 */

import { RangeSetBuilder, type Extension } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';

// =============================================================================
// Constants
// =============================================================================

/**
 * Regex pattern to match static placeholder markers.
 * Supports:
 * - Bracket syntax: [TODO: description], [PLACEHOLDER: description]
 * - HTML comment syntax: <!-- TODO: description -->, <!-- PLACEHOLDER -->
 *
 * Per spec.md Static Placeholder Formats section.
 */
const PLACEHOLDER_REGEX = /\[(TODO|PLACEHOLDER):\s*[^\]]+\]|<!--\s*(TODO|PLACEHOLDER)[^>]*-->/gi;

// =============================================================================
// Decoration
// =============================================================================

/**
 * Creates the placeholder marker decoration.
 * Uses dashed orange border with light yellow background for visibility.
 * Per spec.md Placeholder Styling Specification.
 */
const placeholderMark = Decoration.mark({
  class: 'cm-placeholder-marker',
});

// =============================================================================
// View Plugin
// =============================================================================

/**
 * Finds all placeholder markers in the visible document range
 * and creates decorations for them.
 */
function findPlaceholders(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  // Iterate through visible ranges for performance
  for (const { from, to } of view.visibleRanges) {
    const text = doc.sliceString(from, to);
    let match: RegExpExecArray | null;

    // Reset regex state before use (global flag)
    PLACEHOLDER_REGEX.lastIndex = 0;

    while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
      const start = from + match.index;
      const end = start + match[0].length;
      builder.add(start, end, placeholderMark);
    }
  }

  return builder.finish();
}

/**
 * ViewPlugin that tracks and updates placeholder decorations.
 * Re-scans on document changes or viewport changes.
 */
const placeholderPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = findPlaceholders(view);
    }

    update(update: ViewUpdate) {
      // Re-scan if document changed or viewport changed
      if (update.docChanged || update.viewportChanged) {
        this.decorations = findPlaceholders(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// =============================================================================
// Theme
// =============================================================================

/**
 * Theme extension for placeholder marker styling.
 * Per spec.md Placeholder Styling Specification:
 * - Border: 2px dashed #FFA500 (orange)
 * - Background: rgba(255, 165, 0, 0.1)
 * - Border-radius: 4px
 * - Padding: 2px 4px
 */
const placeholderTheme = EditorView.baseTheme({
  '.cm-placeholder-marker': {
    border: '2px dashed #FFA500',
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    borderRadius: '4px',
    padding: '2px 4px',
  },
  '&dark .cm-placeholder-marker': {
    // Slightly adjust for dark mode visibility
    backgroundColor: 'rgba(255, 165, 0, 0.15)',
  },
});

// =============================================================================
// Extension
// =============================================================================

/**
 * Complete placeholder marker extension.
 * Include this in your CodeMirror setup to enable placeholder highlighting.
 *
 * @example
 * ```typescript
 * import { placeholderMarkerExtension } from './placeholder-markers';
 *
 * const editor = new EditorView({
 *   extensions: [placeholderMarkerExtension, ...otherExtensions],
 * });
 * ```
 */
export const placeholderMarkerExtension: Extension = [
  placeholderPlugin,
  placeholderTheme,
];

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Checks if a string contains any placeholder markers.
 *
 * @param content - The content to check
 * @returns true if content contains placeholder markers
 *
 * @example
 * ```typescript
 * hasPlaceholders('[TODO: Add content here]'); // true
 * hasPlaceholders('Regular text'); // false
 * ```
 */
export function hasPlaceholders(content: string): boolean {
  PLACEHOLDER_REGEX.lastIndex = 0;
  return PLACEHOLDER_REGEX.test(content);
}

/**
 * Finds all placeholder marker positions in a document.
 *
 * @param content - The document content
 * @returns Array of { from, to, text } for each placeholder
 *
 * @example
 * ```typescript
 * const markers = findPlaceholderPositions('Hello [TODO: world]');
 * // Returns: [{ from: 6, to: 19, text: '[TODO: world]' }]
 * ```
 */
export function findPlaceholderPositions(
  content: string
): { from: number; to: number; text: string }[] {
  const results: { from: number; to: number; text: string }[] = [];

  PLACEHOLDER_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
    results.push({
      from: match.index,
      to: match.index + match[0].length,
      text: match[0],
    });
  }

  return results;
}
