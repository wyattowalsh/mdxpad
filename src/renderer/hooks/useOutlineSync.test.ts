/**
 * Tests for useOutlineSync Hook
 *
 * Tests synchronization between preview store AST and outline store.
 *
 * @see useOutlineSync.ts for implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOutlineSync } from './useOutlineSync';
import { usePreviewStore } from '@renderer/stores/preview-store';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useOutlineStore } from '@renderer/stores/outline-store';
import type { OutlineAST } from '@shared/types/outline';
import type { CompileSuccess } from '@shared/types/preview';
import { INITIAL_OUTLINE_STATE } from '@shared/types/outline';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock OutlineAST with heading nodes.
 */
function createOutlineAST(
  headings: { depth: 1 | 2 | 3 | 4 | 5 | 6; text: string; line: number }[]
): OutlineAST {
  return {
    headings: headings.map((h) => ({
      depth: h.depth,
      text: h.text,
      position: { line: h.line, column: 1 },
    })),
    components: [],
    frontmatter: null,
  };
}

/**
 * Set the preview store to a success state with a given outline AST.
 */
function setPreviewSuccess(outline: OutlineAST | null): void {
  const result: CompileSuccess = {
    ok: true,
    code: 'export default function MDXContent() {}',
    frontmatter: {},
    outline,
  };
  usePreviewStore.getState().setSuccess(result);
}

/**
 * Get the headings section items from the outline store.
 */
function getHeadingsItems() {
  const state = useOutlineStore.getState();
  const section = state.sections.find((s) => s.id === 'headings');
  return section?.items ?? [];
}

// =============================================================================
// Test Setup
// =============================================================================

beforeEach(() => {
  // Reset preview store to idle
  usePreviewStore.getState().reset();

  // Reset outline store
  useOutlineStore.getState().reset();
  useDocumentStore.getState().reset();
});

// =============================================================================
// Tests
// =============================================================================

describe('useOutlineSync', () => {
  describe('compilation state sync', () => {
    it('should set isParsing to true when preview is compiling', () => {
      usePreviewStore.getState().startCompiling();

      renderHook(() => useOutlineSync());

      const outlineState = useOutlineStore.getState();
      expect(outlineState.isParsing).toBe(true);
    });

    it('should set isParsing to false when preview is not compiling', () => {
      // Preview is idle (not compiling) after reset
      renderHook(() => useOutlineSync());

      const outlineState = useOutlineStore.getState();
      expect(outlineState.isParsing).toBe(false);
    });

    it('should update isParsing when compilation state changes', () => {
      const { rerender } = renderHook(() => useOutlineSync());

      expect(useOutlineStore.getState().isParsing).toBe(false);

      // Start compiling
      usePreviewStore.getState().startCompiling();
      rerender();

      expect(useOutlineStore.getState().isParsing).toBe(true);

      // Finish compiling (transition to success clears compiling)
      setPreviewSuccess(null);
      rerender();

      expect(useOutlineStore.getState().isParsing).toBe(false);
    });
  });

  describe('AST sync', () => {
    it('should update outline when AST is available', () => {
      const mockAST = createOutlineAST([{ depth: 1, text: 'Test Heading', line: 1 }]);
      setPreviewSuccess(mockAST);

      renderHook(() => useOutlineSync());

      const headings = getHeadingsItems();
      expect(headings.length).toBeGreaterThan(0);
    });

    it('should not update outline when AST is null', () => {
      // Preview is idle, no AST available
      renderHook(() => useOutlineSync());

      const headings = getHeadingsItems();
      expect(headings).toEqual([]);
    });

    it('should update outline when AST changes', () => {
      const ast1 = createOutlineAST([{ depth: 1, text: 'Heading 1', line: 1 }]);
      setPreviewSuccess(ast1);

      const { rerender } = renderHook(() => useOutlineSync());

      const headingsCount1 = getHeadingsItems().length;

      // Update AST with more headings
      const ast2 = createOutlineAST([
        { depth: 1, text: 'Heading 1', line: 1 },
        { depth: 2, text: 'Heading 2', line: 3 },
      ]);
      setPreviewSuccess(ast2);
      rerender();

      const headingsCount2 = getHeadingsItems().length;

      expect(headingsCount2).toBeGreaterThan(headingsCount1);
    });

    it('should clear outline when preview transitions to error', () => {
      const ast = createOutlineAST([{ depth: 1, text: 'Heading 1', line: 1 }]);
      setPreviewSuccess(ast);

      const { rerender } = renderHook(() => useOutlineSync());
      expect(getHeadingsItems().length).toBeGreaterThan(0);

      usePreviewStore.getState().setError([{ message: 'Compile failed' }]);
      rerender();

      expect(getHeadingsItems()).toEqual([]);
    });

    it('uses the open document when the compiled outline is for another file', () => {
      usePreviewStore
        .getState()
        .setSuccess(
          {
            ok: true,
            code: 'export default function MDXContent() {}',
            frontmatter: {},
            outline: createOutlineAST([{ depth: 1, text: 'Other', line: 1 }]),
          },
          '/notes/a.md'
        );
      useDocumentStore.setState({ filePath: '/notes/b.md', content: '# Kept\n' });

      renderHook(() => useOutlineSync());

      expect(getHeadingsItems().map((item) => item.label)).toEqual(['Kept']);
    });

    it('keeps document headings when preview compilation fails', () => {
      useDocumentStore.setState({ content: '```md\n# Hidden\n```\n\n# Kept\n' });
      const ast = createOutlineAST([{ depth: 1, text: 'Old', line: 1 }]);
      setPreviewSuccess(ast);

      const { rerender } = renderHook(() => useOutlineSync());
      usePreviewStore.getState().setError([{ message: 'Compile failed' }]);
      rerender();

      expect(getHeadingsItems().map((item) => item.label)).toEqual(['Kept']);
    });
  });

  describe('combined compilation and AST sync', () => {
    it('should handle compilation start with no AST', () => {
      usePreviewStore.getState().startCompiling();

      renderHook(() => useOutlineSync());

      const outlineState = useOutlineStore.getState();
      expect(outlineState.isParsing).toBe(true);
      expect(getHeadingsItems()).toEqual([]);
    });

    it('should handle compilation complete with AST', () => {
      const mockAST = createOutlineAST([{ depth: 1, text: 'Complete', line: 1 }]);
      setPreviewSuccess(mockAST);

      renderHook(() => useOutlineSync());

      const outlineState = useOutlineStore.getState();
      expect(outlineState.isParsing).toBe(false);
      expect(getHeadingsItems().length).toBeGreaterThan(0);
    });

    it('should track full compilation cycle', () => {
      const { rerender } = renderHook(() => useOutlineSync());

      // Start compilation
      usePreviewStore.getState().startCompiling();
      rerender();

      expect(useOutlineStore.getState().isParsing).toBe(true);

      // Complete compilation with AST
      const mockAST = createOutlineAST([{ depth: 1, text: 'Done', line: 1 }]);
      setPreviewSuccess(mockAST);
      rerender();

      const outlineState = useOutlineStore.getState();
      expect(outlineState.isParsing).toBe(false);
      expect(getHeadingsItems().length).toBeGreaterThan(0);
    });
  });

  describe('multiple updates', () => {
    it('should handle rapid AST updates', () => {
      const { rerender } = renderHook(() => useOutlineSync());

      const asts = [
        createOutlineAST([{ depth: 1, text: 'V1', line: 1 }]),
        createOutlineAST([{ depth: 1, text: 'V2', line: 1 }]),
        createOutlineAST([{ depth: 1, text: 'V3', line: 1 }]),
      ];

      // Rapid updates
      asts.forEach((ast) => {
        setPreviewSuccess(ast);
        rerender();
      });

      // Should have final state
      expect(getHeadingsItems().length).toBeGreaterThan(0);
    });

    it('should handle compilation state flapping', () => {
      const { rerender } = renderHook(() => useOutlineSync());

      // Rapidly toggle compilation state
      usePreviewStore.getState().startCompiling();
      rerender();

      setPreviewSuccess(null);
      rerender();

      usePreviewStore.getState().startCompiling();
      rerender();

      setPreviewSuccess(null);
      rerender();

      // Final state should be not compiling
      expect(useOutlineStore.getState().isParsing).toBe(false);
    });
  });

  describe('empty/null AST handling', () => {
    it('should handle empty AST children array', () => {
      const emptyAST: OutlineAST = { headings: [], components: [], frontmatter: null };
      setPreviewSuccess(emptyAST);

      renderHook(() => useOutlineSync());

      expect(getHeadingsItems()).toEqual([]);
    });

    it('should handle AST with non-heading nodes', () => {
      // AST with components but no headings
      const noHeadingsAST: OutlineAST = {
        headings: [],
        components: [{ name: 'MyComponent', position: { line: 1, column: 1 } }],
        frontmatter: null,
      };
      setPreviewSuccess(noHeadingsAST);

      renderHook(() => useOutlineSync());

      expect(getHeadingsItems()).toEqual([]);
    });
  });

  describe('cleanup', () => {
    it('should not throw on unmount', () => {
      const { unmount } = renderHook(() => useOutlineSync());

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should handle unmount during compilation', () => {
      usePreviewStore.getState().startCompiling();

      const { unmount } = renderHook(() => useOutlineSync());

      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });

  describe('integration', () => {
    it('should sync immediately on mount if AST exists', () => {
      const mockAST = createOutlineAST([{ depth: 1, text: 'Existing', line: 1 }]);
      setPreviewSuccess(mockAST);

      renderHook(() => useOutlineSync());

      const outlineState = useOutlineStore.getState();
      expect(outlineState.isParsing).toBe(false);
      expect(getHeadingsItems().length).toBeGreaterThan(0);
    });

    it('should work with multiple outline sync hook instances', () => {
      const mockAST = createOutlineAST([{ depth: 1, text: 'Multi', line: 1 }]);
      setPreviewSuccess(mockAST);

      // Render multiple instances
      renderHook(() => useOutlineSync());
      renderHook(() => useOutlineSync());

      // Both should sync (they share stores)
      expect(getHeadingsItems().length).toBeGreaterThan(0);
    });
  });
});
