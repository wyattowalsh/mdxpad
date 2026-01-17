/**
 * Tests for useErrorNavigation Hook
 *
 * Tests error navigation functionality including cursor positioning,
 * scrolling, focus management, and edge case handling.
 *
 * @see useErrorNavigation.ts for implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useErrorNavigation, type ErrorLocation } from './useErrorNavigation';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock EditorView ref with the given document content.
 */
function createMockEditorRef(doc: string): React.RefObject<EditorView | null> {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const state = EditorState.create({
    doc,
    selection: { anchor: 0, head: 0 },
  });

  const view = new EditorView({
    state,
    parent: container,
  });

  return { current: view };
}

/**
 * Create a null editor ref for testing null handling.
 */
function createNullEditorRef(): React.RefObject<EditorView | null> {
  return { current: null };
}

/**
 * Get the current cursor position from an EditorView.
 */
function getCursorPosition(view: EditorView): { line: number; column: number } {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  return {
    line: line.number,
    column: pos - line.from + 1, // 1-indexed column
  };
}

/**
 * Clean up EditorView by removing from DOM and destroying.
 */
function cleanup(ref: React.RefObject<EditorView | null>): void {
  if (ref.current) {
    ref.current.dom.parentElement?.removeChild(ref.current.dom);
    ref.current.destroy();
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('useErrorNavigation', () => {
  describe('navigateToError', () => {
    it('should move cursor to correct position', () => {
      const doc = 'line 1\nline 2\nline 3';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      // Navigate to line 2, column 3
      result.current.navigateToError({ line: 2, column: 3 });

      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(2);
      expect(position.column).toBe(3);

      cleanup(editorRef);
    });

    it('should scroll editor into view', () => {
      // Create a document with many lines
      const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
      const doc = lines.join('\n');
      const editorRef = createMockEditorRef(doc);

      // Spy on dispatch to verify scrollIntoView is called
      const dispatchSpy = vi.spyOn(editorRef.current!, 'dispatch');

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      // Navigate to a line that would be off-screen
      result.current.navigateToError({ line: 50, column: 1 });

      // Verify dispatch was called with scrollIntoView
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          scrollIntoView: true,
        })
      );

      cleanup(editorRef);
    });

    it('should focus the editor', () => {
      const doc = 'test content';
      const editorRef = createMockEditorRef(doc);

      // Spy on focus
      const focusSpy = vi.spyOn(editorRef.current!, 'focus');

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      result.current.navigateToError({ line: 1, column: 1 });

      expect(focusSpy).toHaveBeenCalled();

      cleanup(editorRef);
    });

    it('should handle invalid line numbers (clamps to valid range)', () => {
      const doc = 'line 1\nline 2\nline 3';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      // Navigate to line 100 (beyond document end)
      result.current.navigateToError({ line: 100, column: 1 });

      // Should clamp to last line (line 3)
      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(3);

      cleanup(editorRef);
    });

    it('should handle line number less than 1 (clamps to first line)', () => {
      const doc = 'line 1\nline 2\nline 3';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      // Navigate to line 0 (invalid)
      result.current.navigateToError({ line: 0, column: 1 });

      // Should clamp to first line
      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(1);

      cleanup(editorRef);
    });

    it('should handle negative line numbers', () => {
      const doc = 'line 1\nline 2';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      // Navigate to line -5 (invalid)
      result.current.navigateToError({ line: -5, column: 1 });

      // Should clamp to first line
      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(1);

      cleanup(editorRef);
    });

    it('should handle invalid column numbers (clamps to line length)', () => {
      const doc = 'short';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      // Navigate to column 100 (beyond line end)
      result.current.navigateToError({ line: 1, column: 100 });

      // Should clamp to end of line (column 6, which is after last char)
      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(1);
      expect(position.column).toBe(6); // "short" has 5 chars, max column is 6

      cleanup(editorRef);
    });

    it('should handle column number less than 1 (clamps to first column)', () => {
      const doc = 'test content';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      // Navigate to column 0 (invalid)
      result.current.navigateToError({ line: 1, column: 0 });

      // Should clamp to first column
      const position = getCursorPosition(editorRef.current!);
      expect(position.column).toBe(1);

      cleanup(editorRef);
    });

    it('should handle negative column numbers', () => {
      const doc = 'test content';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      // Navigate to column -10 (invalid)
      result.current.navigateToError({ line: 1, column: -10 });

      // Should clamp to first column
      const position = getCursorPosition(editorRef.current!);
      expect(position.column).toBe(1);

      cleanup(editorRef);
    });

    it('should handle null editor ref gracefully', () => {
      const editorRef = createNullEditorRef();

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      // Should not throw when editor ref is null
      expect(() => {
        result.current.navigateToError({ line: 1, column: 1 });
      }).not.toThrow();
    });

    it('should navigate to correct position in middle of line', () => {
      const doc = 'const x = 123;';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      // Navigate to column 7 (the 'x')
      result.current.navigateToError({ line: 1, column: 7 });

      const position = getCursorPosition(editorRef.current!);
      expect(position.column).toBe(7);

      cleanup(editorRef);
    });

    it('should navigate to first line correctly', () => {
      const doc = 'first line\nsecond line';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      result.current.navigateToError({ line: 1, column: 1 });

      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(1);
      expect(position.column).toBe(1);

      cleanup(editorRef);
    });

    it('should navigate to last line correctly', () => {
      const doc = 'first\nsecond\nthird';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      result.current.navigateToError({ line: 3, column: 1 });

      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(3);
      expect(position.column).toBe(1);

      cleanup(editorRef);
    });

    it('should navigate to end of line correctly', () => {
      const doc = 'hello';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      // Navigate to column 6 (after last character)
      result.current.navigateToError({ line: 1, column: 6 });

      const position = getCursorPosition(editorRef.current!);
      expect(position.column).toBe(6);

      cleanup(editorRef);
    });

    it('should handle empty document', () => {
      const doc = '';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      // Should not throw on empty document
      expect(() => {
        result.current.navigateToError({ line: 1, column: 1 });
      }).not.toThrow();

      cleanup(editorRef);
    });

    it('should handle single character document', () => {
      const doc = 'x';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      result.current.navigateToError({ line: 1, column: 1 });

      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(1);
      expect(position.column).toBe(1);

      cleanup(editorRef);
    });

    it('should handle empty lines', () => {
      const doc = 'line 1\n\nline 3';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      // Navigate to empty line 2
      result.current.navigateToError({ line: 2, column: 1 });

      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(2);
      expect(position.column).toBe(1);

      cleanup(editorRef);
    });

    it('should handle lines with varying lengths', () => {
      const doc = 'short\nthis is a much longer line\nmed';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      // Navigate to middle of long line
      result.current.navigateToError({ line: 2, column: 15 });

      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(2);
      expect(position.column).toBe(15);

      cleanup(editorRef);
    });

    it('should handle unicode characters', () => {
      const doc = 'hello 世界';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      // Navigate into the unicode portion
      result.current.navigateToError({ line: 1, column: 8 });

      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(1);
      expect(position.column).toBe(8);

      cleanup(editorRef);
    });

    it('should set selection with cursor (collapsed selection)', () => {
      const doc = 'test content';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      result.current.navigateToError({ line: 1, column: 5 });

      // Verify selection is collapsed (anchor === head)
      const selection = editorRef.current!.state.selection.main;
      expect(selection.anchor).toBe(selection.head);

      cleanup(editorRef);
    });

    it('should be callable multiple times', () => {
      const doc = 'line 1\nline 2\nline 3';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useErrorNavigation({ editorRef }));

      // Navigate multiple times
      result.current.navigateToError({ line: 1, column: 1 });
      expect(getCursorPosition(editorRef.current!).line).toBe(1);

      result.current.navigateToError({ line: 2, column: 3 });
      expect(getCursorPosition(editorRef.current!).line).toBe(2);
      expect(getCursorPosition(editorRef.current!).column).toBe(3);

      result.current.navigateToError({ line: 3, column: 5 });
      expect(getCursorPosition(editorRef.current!).line).toBe(3);
      expect(getCursorPosition(editorRef.current!).column).toBe(5);

      cleanup(editorRef);
    });
  });

  describe('memoization', () => {
    it('should return stable navigateToError function', () => {
      const editorRef = createMockEditorRef('test');

      const { result, rerender } = renderHook(() =>
        useErrorNavigation({ editorRef })
      );

      const firstNavigate = result.current.navigateToError;

      // Rerender with same ref
      rerender();

      // Function should be stable (same reference)
      expect(result.current.navigateToError).toBe(firstNavigate);

      cleanup(editorRef);
    });
  });
});
