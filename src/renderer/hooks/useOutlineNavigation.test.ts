/**
 * Tests for useOutlineNavigation Hook
 *
 * Tests outline item navigation functionality including cursor positioning,
 * scrolling, focus management, and edge case handling.
 *
 * @see useOutlineNavigation.ts for implementation
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useOutlineNavigation } from './useOutlineNavigation';
import type { OutlineItem } from '@shared/types/outline';

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

/**
 * Create a mock outline item for testing.
 */
function createMockOutlineItem(overrides: Partial<OutlineItem> = {}): OutlineItem {
  return {
    id: 'test-item',
    type: 'heading',
    label: 'Test Heading',
    level: 1,
    line: 1,
    column: 1,
    children: [],
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('useOutlineNavigation', () => {
  describe('navigateToPosition', () => {
    it('should move cursor to correct position', () => {
      const doc = 'line 1\nline 2\nline 3';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useOutlineNavigation({ editorRef }));

      // Navigate to line 2, column 3
      result.current.navigateToPosition(2, 3);

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

      const { result } = renderHook(() => useOutlineNavigation({ editorRef }));

      // Navigate to a line that would be off-screen
      result.current.navigateToPosition(50, 1);

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

      const { result } = renderHook(() => useOutlineNavigation({ editorRef }));

      result.current.navigateToPosition(1, 1);

      expect(focusSpy).toHaveBeenCalled();

      cleanup(editorRef);
    });

    it('should handle invalid line numbers (clamps to valid range)', () => {
      const doc = 'line 1\nline 2\nline 3';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useOutlineNavigation({ editorRef }));

      // Navigate to line 100 (beyond document end)
      result.current.navigateToPosition(100, 1);

      // Should clamp to last line (line 3)
      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(3);

      cleanup(editorRef);
    });

    it('should handle line number less than 1 (clamps to first line)', () => {
      const doc = 'line 1\nline 2\nline 3';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useOutlineNavigation({ editorRef }));

      // Navigate to line 0 (invalid)
      result.current.navigateToPosition(0, 1);

      // Should clamp to first line
      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(1);

      cleanup(editorRef);
    });

    it('should handle invalid column numbers (clamps to line length)', () => {
      const doc = 'short';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useOutlineNavigation({ editorRef }));

      // Navigate to column 100 (beyond line end)
      result.current.navigateToPosition(1, 100);

      // Should clamp to end of line (column 6, which is after last char)
      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(1);
      expect(position.column).toBe(6); // "short" has 5 chars, max column is 6

      cleanup(editorRef);
    });

    it('should handle null editor ref gracefully', () => {
      const editorRef = createNullEditorRef();

      const { result } = renderHook(() => useOutlineNavigation({ editorRef }));

      // Should not throw when editor ref is null
      expect(() => {
        result.current.navigateToPosition(1, 1);
      }).not.toThrow();
    });

    it('should handle empty document', () => {
      const doc = '';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useOutlineNavigation({ editorRef }));

      // Should not throw on empty document
      expect(() => {
        result.current.navigateToPosition(1, 1);
      }).not.toThrow();

      cleanup(editorRef);
    });
  });

  describe('navigateToItem', () => {
    it('should navigate to outline item position', () => {
      const doc = '# Heading 1\n\n## Heading 2\n\nSome content';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useOutlineNavigation({ editorRef }));

      const item = createMockOutlineItem({ line: 3, column: 1 });
      result.current.navigateToItem(item);

      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(3);
      expect(position.column).toBe(1);

      cleanup(editorRef);
    });

    it('should navigate to heading item', () => {
      const doc = 'frontmatter\n---\n# My Title\nContent here';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useOutlineNavigation({ editorRef }));

      const headingItem = createMockOutlineItem({
        id: 'h-3-1',
        type: 'heading',
        label: 'My Title',
        level: 1,
        line: 3,
        column: 1,
      });

      result.current.navigateToItem(headingItem);

      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(3);

      cleanup(editorRef);
    });

    it('should navigate to component item', () => {
      const doc = '# Title\n\n<MyComponent prop="value" />\n\nMore text';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useOutlineNavigation({ editorRef }));

      const componentItem = createMockOutlineItem({
        id: 'c-MyComponent-3',
        type: 'component',
        label: 'MyComponent',
        level: 0,
        line: 3,
        column: 1,
      });

      result.current.navigateToItem(componentItem);

      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(3);

      cleanup(editorRef);
    });

    it('should navigate to frontmatter item', () => {
      const doc = '---\ntitle: Hello\nauthor: World\n---\n\n# Content';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useOutlineNavigation({ editorRef }));

      const frontmatterItem = createMockOutlineItem({
        id: 'fm-title',
        type: 'frontmatter',
        label: 'title: Hello',
        level: 0,
        line: 1,
        column: 1,
      });

      result.current.navigateToItem(frontmatterItem);

      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(1);

      cleanup(editorRef);
    });

    it('should use item column for precise navigation', () => {
      const doc = 'Some text <InlineComponent /> more text';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useOutlineNavigation({ editorRef }));

      const item = createMockOutlineItem({
        line: 1,
        column: 11, // Position of <InlineComponent
      });

      result.current.navigateToItem(item);

      const position = getCursorPosition(editorRef.current!);
      expect(position.column).toBe(11);

      cleanup(editorRef);
    });

    it('should handle item with children', () => {
      const doc = '# Parent\n## Child 1\n## Child 2';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useOutlineNavigation({ editorRef }));

      const parentItem = createMockOutlineItem({
        id: 'h-1-1',
        type: 'heading',
        label: 'Parent',
        level: 1,
        line: 1,
        column: 1,
        children: [
          createMockOutlineItem({ id: 'h-2-1', line: 2, column: 1, level: 2 }),
          createMockOutlineItem({ id: 'h-3-1', line: 3, column: 1, level: 2 }),
        ],
      });

      // Should navigate to parent, not children
      result.current.navigateToItem(parentItem);

      const position = getCursorPosition(editorRef.current!);
      expect(position.line).toBe(1);

      cleanup(editorRef);
    });

    it('should handle null editor ref gracefully', () => {
      const editorRef = createNullEditorRef();

      const { result } = renderHook(() => useOutlineNavigation({ editorRef }));

      const item = createMockOutlineItem({ line: 1, column: 1 });

      // Should not throw when editor ref is null
      expect(() => {
        result.current.navigateToItem(item);
      }).not.toThrow();
    });
  });

  describe('memoization', () => {
    it('should return stable navigateToPosition function', () => {
      const editorRef = createMockEditorRef('test');

      const { result, rerender } = renderHook(() =>
        useOutlineNavigation({ editorRef })
      );

      const firstNavigate = result.current.navigateToPosition;

      // Rerender with same ref
      rerender();

      // Function should be stable (same reference)
      expect(result.current.navigateToPosition).toBe(firstNavigate);

      cleanup(editorRef);
    });

    it('should return stable navigateToItem function', () => {
      const editorRef = createMockEditorRef('test');

      const { result, rerender } = renderHook(() =>
        useOutlineNavigation({ editorRef })
      );

      const firstNavigate = result.current.navigateToItem;

      // Rerender with same ref
      rerender();

      // Function should be stable (same reference)
      expect(result.current.navigateToItem).toBe(firstNavigate);

      cleanup(editorRef);
    });
  });

  describe('integration scenarios', () => {
    it('should navigate through multiple outline items', () => {
      const doc = '# First\n\n## Second\n\n### Third\n\nContent';
      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useOutlineNavigation({ editorRef }));

      // Navigate through items like a user clicking in outline
      const items = [
        createMockOutlineItem({ line: 1, column: 1 }),
        createMockOutlineItem({ line: 3, column: 1 }),
        createMockOutlineItem({ line: 5, column: 1 }),
      ];

      items.forEach((item, index) => {
        result.current.navigateToItem(item);
        const position = getCursorPosition(editorRef.current!);
        expect(position.line).toBe(item.line);
      });

      cleanup(editorRef);
    });

    it('should work with MDX document structure', () => {
      const doc = `---
title: Test Doc
---

# Introduction

<Alert type="info">
  Important message
</Alert>

## Section One

Some content here.

### Subsection

More details.`;

      const editorRef = createMockEditorRef(doc);

      const { result } = renderHook(() => useOutlineNavigation({ editorRef }));

      // Navigate to frontmatter
      result.current.navigateToItem(
        createMockOutlineItem({ type: 'frontmatter', line: 1, column: 1 })
      );
      expect(getCursorPosition(editorRef.current!).line).toBe(1);

      // Navigate to Introduction heading
      result.current.navigateToItem(
        createMockOutlineItem({ type: 'heading', line: 5, column: 1 })
      );
      expect(getCursorPosition(editorRef.current!).line).toBe(5);

      // Navigate to Alert component
      result.current.navigateToItem(
        createMockOutlineItem({ type: 'component', line: 7, column: 1 })
      );
      expect(getCursorPosition(editorRef.current!).line).toBe(7);

      // Navigate to Section One
      result.current.navigateToItem(
        createMockOutlineItem({ type: 'heading', line: 12, column: 1 })
      );
      expect(getCursorPosition(editorRef.current!).line).toBe(12);

      cleanup(editorRef);
    });
  });
});
