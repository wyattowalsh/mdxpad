/**
 * Code Folding Extension for CodeMirror
 *
 * Provides fold gutter with MDX-aware fold strategies for
 * frontmatter blocks, JSX blocks, and code fences.
 *
 * @module renderer/lib/editor/extensions/code-folding
 */

import { type Extension } from '@codemirror/state';
import { foldGutter, foldService } from '@codemirror/language';

// =============================================================================
// Constants
// =============================================================================

const FRONTMATTER_DELIMITER = '---';
const CODE_FENCE_START = /^(`{3,}|~{3,})/;
const JSX_OPEN_TAG = /^<([A-Z][a-zA-Z0-9.]*)\b[^>]*(?<!\/)\s*>$/;
const JSX_SELF_CLOSE = /\/>\s*$/;
const JSX_CLOSE_TAG = /^<\/([A-Z][a-zA-Z0-9.]*)\s*>$/;

// =============================================================================
// Fold Strategies
// =============================================================================

/**
 * Fold strategy for YAML frontmatter (between --- delimiters).
 */
function foldFrontmatter(
  doc: { line(n: number): { text: string; from: number; to: number }; lines: number },
  lineNumber: number
): { from: number; to: number } | null {
  const line = doc.line(lineNumber);

  // Only fold from the opening ---
  if (line.text.trim() !== FRONTMATTER_DELIMITER) return null;

  // Must be on line 1
  if (lineNumber !== 1) return null;

  // Find closing ---
  for (let i = lineNumber + 1; i <= doc.lines; i++) {
    const candidate = doc.line(i);
    if (candidate.text.trim() === FRONTMATTER_DELIMITER) {
      return { from: line.to, to: candidate.to };
    }
  }

  return null;
}

/**
 * Fold strategy for code fences (``` or ~~~).
 */
function foldCodeFence(
  doc: { line(n: number): { text: string; from: number; to: number }; lines: number },
  lineNumber: number
): { from: number; to: number } | null {
  const line = doc.line(lineNumber);
  const match = CODE_FENCE_START.exec(line.text.trim());
  if (!match) return null;

  const fenceGroup = match[1];
  if (!fenceGroup) return null;
  const fenceChar = fenceGroup[0];
  const fenceLen = fenceGroup.length;

  // Find matching closing fence
  for (let i = lineNumber + 1; i <= doc.lines; i++) {
    const candidate = doc.line(i);
    const trimmed = candidate.text.trim();

    // Closing fence must use same char and be at least as long
    if (
      trimmed.length >= fenceLen &&
      [...trimmed].every((c) => c === fenceChar) &&
      trimmed.length <= trimmed.length // no trailing content
    ) {
      return { from: line.to, to: candidate.to };
    }
  }

  return null;
}

/**
 * Fold strategy for JSX blocks (PascalCase components).
 */
function foldJsxBlock(
  doc: { line(n: number): { text: string; from: number; to: number }; lines: number },
  lineNumber: number
): { from: number; to: number } | null {
  const line = doc.line(lineNumber);
  const trimmed = line.text.trim();

  // Skip self-closing tags
  if (JSX_SELF_CLOSE.test(trimmed)) return null;

  const openMatch = JSX_OPEN_TAG.exec(trimmed);
  if (!openMatch) return null;

  const tagName = openMatch[1];
  let depth = 1;

  for (let i = lineNumber + 1; i <= doc.lines; i++) {
    const candidateText = doc.line(i).text.trim();

    // Check for nested opening tags of the same component
    const nestedOpen = JSX_OPEN_TAG.exec(candidateText);
    if (nestedOpen && nestedOpen[1] === tagName && !JSX_SELF_CLOSE.test(candidateText)) {
      depth++;
    }

    // Check for closing tags
    const closeMatch = JSX_CLOSE_TAG.exec(candidateText);
    if (closeMatch && closeMatch[1] === tagName) {
      depth--;
      if (depth === 0) {
        return { from: line.to, to: doc.line(i).to };
      }
    }
  }

  return null;
}

// =============================================================================
// Fold Service
// =============================================================================

/**
 * Combined MDX fold service that tries each strategy in order.
 */
const mdxFoldService = foldService.of((_state, lineStart) => {
  const doc = _state.doc;
  const lineNumber = doc.lineAt(lineStart).number;

  return (
    foldFrontmatter(doc, lineNumber) ??
    foldCodeFence(doc, lineNumber) ??
    foldJsxBlock(doc, lineNumber)
  );
});

// =============================================================================
// Extension
// =============================================================================

/**
 * Code folding extension with MDX awareness.
 *
 * Supports folding:
 * - YAML frontmatter blocks (between `---` markers)
 * - Code fences (``` or ~~~ blocks)
 * - JSX component blocks (PascalCase tags)
 *
 * @returns CodeMirror Extension
 *
 * @example
 * ```typescript
 * import { codeFoldingExtension } from './code-folding';
 *
 * const view = new EditorView({
 *   extensions: [codeFoldingExtension()],
 * });
 * ```
 */
export function codeFoldingExtension(): Extension {
  return [
    mdxFoldService,
    foldGutter({
      markerDOM(open: boolean) {
        const marker = document.createElement('span');
        marker.textContent = open ? '\u25BE' : '\u25B8';
        marker.title = open ? 'Fold' : 'Unfold';
        return marker;
      },
    }),
  ];
}

// Export strategies for testing
export { foldFrontmatter, foldCodeFence, foldJsxBlock };
