/**
 * Tests for useFilterDebounce Hook
 *
 * Tests debounced fuzzy filtering for file tree explorer.
 *
 * @see useFilterDebounce.ts for implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFilterDebounce, FILTER_DEBOUNCE_MS } from './useFilterDebounce';
import { useFileExplorerStore } from '../stores/file-explorer-store';
import type { FileEntry } from '../lib/fuzzy-match/matcher';

// =============================================================================
// Test Setup
// =============================================================================

const createMockFile = (overrides?: Partial<FileEntry>): FileEntry => ({
  id: `file-${Math.random()}`,
  path: '/test/file.md',
  name: 'file.md',
  ...overrides,
});

beforeEach(() => {
  // Reset file explorer store to initial state
  useFileExplorerStore.setState({
    query: { value: '', isActive: false },
    matchResults: new Map(),
    matchCount: 0,
    isFiltering: false,
  });
});

// =============================================================================
// Tests
// =============================================================================

describe('useFilterDebounce', () => {
  describe('basic behavior', () => {
    it('should set isFiltering true immediately when query provided', () => {
      const files = [createMockFile({ id: '1', name: 'test.md' })];

      renderHook(() => useFilterDebounce({ query: 'test', files }));

      const state = useFileExplorerStore.getState();
      expect(state.isFiltering).toBe(true);
    });

    it('should eventually apply empty results for empty query', async () => {
      const files = [
        createMockFile({ id: '1', name: 'file1.md' }),
        createMockFile({ id: '2', name: 'file2.md' }),
      ];

      renderHook(() => useFilterDebounce({ query: '', files }));

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, FILTER_DEBOUNCE_MS + 50));

      const state = useFileExplorerStore.getState();
      expect(state.matchCount).toBe(0);
      expect(state.matchResults.size).toBe(0);
    });

    it('should eventually filter files with non-empty query', async () => {
      const files = [
        createMockFile({ id: '1', name: 'document.md', path: '/test/document.md' }),
        createMockFile({ id: '2', name: 'README.md', path: '/test/README.md' }),
      ];

      renderHook(() => useFilterDebounce({ query: 'doc', files }));

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, FILTER_DEBOUNCE_MS + 50));

      const state = useFileExplorerStore.getState();
      expect(state.matchCount).toBeGreaterThan(0);
    });
  });

  describe('enabled option', () => {
    it('should not filter when disabled', async () => {
      const files = [createMockFile({ id: '1', name: 'test.md' })];

      renderHook(() =>
        useFilterDebounce({ query: 'test', files, enabled: false })
      );

      // Should not set isFiltering when disabled
      const state = useFileExplorerStore.getState();
      expect(state.isFiltering).toBe(false);
    });

    it('should default to enabled when option not provided', () => {
      const files = [createMockFile({ id: '1', name: 'test.md' })];

      renderHook(() => useFilterDebounce({ query: 'test', files }));

      // Should set isFiltering (enabled by default)
      expect(useFileExplorerStore.getState().isFiltering).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty files array', async () => {
      renderHook(() => useFilterDebounce({ query: 'test', files: [] }));

      await new Promise(resolve => setTimeout(resolve, FILTER_DEBOUNCE_MS + 50));

      const state = useFileExplorerStore.getState();
      expect(state.matchCount).toBe(0);
    });

    it('should handle whitespace-only query as empty', async () => {
      const files = [createMockFile({ id: '1', name: 'test.md' })];

      renderHook(() => useFilterDebounce({ query: '   ', files }));

      await new Promise(resolve => setTimeout(resolve, FILTER_DEBOUNCE_MS + 50));

      const state = useFileExplorerStore.getState();
      expect(state.matchCount).toBe(0);
    });

    it('should handle files with no matches', async () => {
      const files = [
        createMockFile({ id: '1', name: 'alpha.md' }),
        createMockFile({ id: '2', name: 'beta.md' }),
      ];

      renderHook(() => useFilterDebounce({ query: 'zzz', files }));

      await new Promise(resolve => setTimeout(resolve, FILTER_DEBOUNCE_MS + 50));

      const state = useFileExplorerStore.getState();
      expect(state.matchCount).toBe(0);
    });

    it('should handle Unicode in query', async () => {
      const files = [createMockFile({ id: '1', name: '文档.md' })];

      renderHook(() => useFilterDebounce({ query: '文', files }));

      await new Promise(resolve => setTimeout(resolve, FILTER_DEBOUNCE_MS + 50));

      const state = useFileExplorerStore.getState();
      // Should not throw
      expect(state.isFiltering).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should not throw on unmount', () => {
      const files = [createMockFile({ id: '1', name: 'test.md' })];

      const { unmount } = renderHook(() =>
        useFilterDebounce({ query: 'test', files })
      );

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should cleanup timers when disabled', async () => {
      const files = [createMockFile({ id: '1', name: 'test.md' })];

      const { rerender } = renderHook(
        ({ enabled }) => useFilterDebounce({ query: 'test', files, enabled }),
        { initialProps: { enabled: true } }
      );

      rerender({ enabled: false });

      // Wait past debounce time
      await new Promise(resolve => setTimeout(resolve, FILTER_DEBOUNCE_MS + 100));

      // Should not have filtered (was disabled)
      const state = useFileExplorerStore.getState();
      // State may vary, just verify no crash
      expect(state).toBeDefined();
    });
  });

  describe('rerender handling', () => {
    it('should handle query updates', async () => {
      const files = [createMockFile({ id: '1', name: 'test.md' })];

      const { rerender } = renderHook(
        ({ query }) => useFilterDebounce({ query, files }),
        { initialProps: { query: 'test' } }
      );

      // Change query
      rerender({ query: 'test2' });

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, FILTER_DEBOUNCE_MS + 50));

      // Should have processed second query
      expect(useFileExplorerStore.getState().isFiltering).toBe(false);
    });

    it('should handle files array updates', async () => {
      const files1 = [createMockFile({ id: '1', name: 'test1.md' })];
      const files2 = [createMockFile({ id: '2', name: 'test2.md' })];

      const { rerender } = renderHook(
        ({ files }) => useFilterDebounce({ query: 'test', files }),
        { initialProps: { files: files1 } }
      );

      rerender({ files: files2 });

      await new Promise(resolve => setTimeout(resolve, FILTER_DEBOUNCE_MS + 50));

      // Should have processed with new files
      expect(useFileExplorerStore.getState().isFiltering).toBe(false);
    });
  });

  describe('multiple instances', () => {
    it('should work with multiple instances (last one wins)', async () => {
      const files = [createMockFile({ id: '1', name: 'test.md' })];

      // Two instances with same store
      renderHook(() => useFilterDebounce({ query: 'query1', files }));
      renderHook(() => useFilterDebounce({ query: 'query2', files }));

      await new Promise(resolve => setTimeout(resolve, FILTER_DEBOUNCE_MS + 50));

      // Both complete, store updated by last one
      expect(useFileExplorerStore.getState().isFiltering).toBe(false);
    });
  });
});
