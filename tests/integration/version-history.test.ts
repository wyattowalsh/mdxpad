/**
 * Version History Store State Transition & Selector Tests
 *
 * Tests version entry loading, timeline ordering, entry selection,
 * source-based filtering, loading/error state management, file path
 * tracking, and store reset.
 *
 * NOTE: Scope clarification — despite the `tests/integration/` path, these are
 * unit-level tests exercising the Zustand version-history-store in isolation
 * with a mocked localStorage. Version entries are synthetic objects passed
 * directly to the store — no actual autosave snapshots, git log parsing, or
 * filesystem reads are involved. True integration tests would trigger autosaves
 * and git commits through real services, load the resulting history via IPC, and
 * verify that selecting a version entry restores the correct document content in
 * the editor.
 *
 * @module tests/integration/version-history.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      const { [key]: _, ...rest } = store;
      store = rest;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Import after mocks
import {
  useVersionHistoryStore,
  INITIAL_VERSION_HISTORY_STATE,
  selectEntries,
  selectSelectedEntry,
  selectIsLoading,
  selectError,
  selectCurrentFilePath,
  selectEntriesBySource,
  selectHasEntries,
} from '@renderer/stores/version-history-store';
import type { VersionEntry } from '@shared/contracts/history-schemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEntry(overrides?: Partial<VersionEntry>): VersionEntry {
  return {
    id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    source: 'manual',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Version History Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    act(() => {
      useVersionHistoryStore.setState({ ...INITIAL_VERSION_HISTORY_STATE });
    });
  });

  describe('entries added -> timeline shows correct order', () => {
    it('should sort entries newest first when loading history', () => {
      const entries: VersionEntry[] = [
        createEntry({ id: 'v1', timestamp: 1000, source: 'autosave' }),
        createEntry({ id: 'v2', timestamp: 3000, source: 'manual' }),
        createEntry({ id: 'v3', timestamp: 2000, source: 'git' }),
      ];

      act(() => {
        useVersionHistoryStore.getState().loadHistory(entries, '/test/file.mdx');
      });

      const state = useVersionHistoryStore.getState();
      const sorted = selectEntries(state);

      expect(sorted).toHaveLength(3);
      expect(sorted[0]?.id).toBe('v2'); // newest
      expect(sorted[1]?.id).toBe('v3');
      expect(sorted[2]?.id).toBe('v1'); // oldest
    });

    it('should add a new entry in the correct sorted position', () => {
      const entries: VersionEntry[] = [
        createEntry({ id: 'v1', timestamp: 1000 }),
        createEntry({ id: 'v3', timestamp: 3000 }),
      ];

      act(() => {
        useVersionHistoryStore.getState().loadHistory(entries, '/test/file.mdx');
      });

      // Add entry with timestamp between existing ones
      act(() => {
        useVersionHistoryStore.getState().addEntry(createEntry({ id: 'v2', timestamp: 2000 }));
      });

      const state = useVersionHistoryStore.getState();
      const sorted = selectEntries(state);

      expect(sorted).toHaveLength(3);
      expect(sorted[0]?.id).toBe('v3');
      expect(sorted[1]?.id).toBe('v2');
      expect(sorted[2]?.id).toBe('v1');
    });
  });

  describe('selection', () => {
    it('should select and retrieve a version entry', () => {
      const entries: VersionEntry[] = [
        createEntry({ id: 'v1', timestamp: 1000 }),
        createEntry({ id: 'v2', timestamp: 2000 }),
      ];

      act(() => {
        useVersionHistoryStore.getState().loadHistory(entries, '/test/file.mdx');
      });

      act(() => {
        useVersionHistoryStore.getState().selectEntry('v1');
      });

      const state = useVersionHistoryStore.getState();
      const selected = selectSelectedEntry(state);

      expect(selected).toBeDefined();
      expect(selected?.id).toBe('v1');
    });

    it('should clear selection when loading history clears selectedEntryId', () => {
      const entries: VersionEntry[] = [createEntry({ id: 'v1', timestamp: 1000 })];

      act(() => {
        useVersionHistoryStore.getState().loadHistory(entries, '/test/file.mdx');
        useVersionHistoryStore.getState().selectEntry('v1');
      });

      // Loading new history clears selection
      act(() => {
        useVersionHistoryStore
          .getState()
          .loadHistory([createEntry({ id: 'v2', timestamp: 2000 })], '/test/other.mdx');
      });

      const state = useVersionHistoryStore.getState();
      expect(state.selectedEntryId).toBeNull();
      expect(selectSelectedEntry(state)).toBeUndefined();
    });

    it('should deselect when entry is set to null', () => {
      act(() => {
        useVersionHistoryStore
          .getState()
          .loadHistory([createEntry({ id: 'v1', timestamp: 1000 })], '/test/file.mdx');
        useVersionHistoryStore.getState().selectEntry('v1');
      });

      act(() => {
        useVersionHistoryStore.getState().selectEntry(null);
      });

      expect(useVersionHistoryStore.getState().selectedEntryId).toBeNull();
    });
  });

  describe('loading and error states', () => {
    it('should manage loading state', () => {
      act(() => {
        useVersionHistoryStore.getState().setLoading(true);
      });

      expect(selectIsLoading(useVersionHistoryStore.getState())).toBe(true);

      act(() => {
        useVersionHistoryStore.getState().loadHistory([], '/test/file.mdx');
      });

      expect(selectIsLoading(useVersionHistoryStore.getState())).toBe(false);
    });

    it('should clear error when loading starts', () => {
      act(() => {
        useVersionHistoryStore.getState().setError('Failed to fetch history');
      });

      expect(selectError(useVersionHistoryStore.getState())).toBe('Failed to fetch history');

      act(() => {
        useVersionHistoryStore.getState().setLoading(true);
      });

      expect(selectError(useVersionHistoryStore.getState())).toBeNull();
    });

    it('should set error and clear loading', () => {
      act(() => {
        useVersionHistoryStore.getState().setLoading(true);
        useVersionHistoryStore.getState().setError('Network error');
      });

      const state = useVersionHistoryStore.getState();
      expect(selectError(state)).toBe('Network error');
      expect(selectIsLoading(state)).toBe(false);
    });
  });

  describe('filtering by source', () => {
    it('should filter entries by version source', () => {
      const entries: VersionEntry[] = [
        createEntry({ id: 'v1', timestamp: 1000, source: 'autosave' }),
        createEntry({ id: 'v2', timestamp: 2000, source: 'manual' }),
        createEntry({ id: 'v3', timestamp: 3000, source: 'autosave' }),
        createEntry({ id: 'v4', timestamp: 4000, source: 'git' }),
      ];

      act(() => {
        useVersionHistoryStore.getState().loadHistory(entries, '/test/file.mdx');
      });

      const state = useVersionHistoryStore.getState();

      const autosaves = selectEntriesBySource(state, 'autosave');
      expect(autosaves).toHaveLength(2);

      const manuals = selectEntriesBySource(state, 'manual');
      expect(manuals).toHaveLength(1);

      const gitVersions = selectEntriesBySource(state, 'git');
      expect(gitVersions).toHaveLength(1);
    });
  });

  describe('file path tracking', () => {
    it('should track current file path', () => {
      act(() => {
        useVersionHistoryStore.getState().loadHistory([], '/docs/readme.mdx');
      });

      expect(selectCurrentFilePath(useVersionHistoryStore.getState())).toBe('/docs/readme.mdx');
    });

    it('should update file path when switching files', () => {
      act(() => {
        useVersionHistoryStore.getState().loadHistory([], '/docs/readme.mdx');
      });

      act(() => {
        useVersionHistoryStore.getState().loadHistory([], '/docs/guide.mdx');
      });

      expect(selectCurrentFilePath(useVersionHistoryStore.getState())).toBe('/docs/guide.mdx');
    });
  });

  describe('clear and reset', () => {
    it('should clear all history', () => {
      act(() => {
        useVersionHistoryStore
          .getState()
          .loadHistory([createEntry({ id: 'v1', timestamp: 1000 })], '/test/file.mdx');
        useVersionHistoryStore.getState().selectEntry('v1');
      });

      act(() => {
        useVersionHistoryStore.getState().clearHistory();
      });

      const state = useVersionHistoryStore.getState();
      expect(selectHasEntries(state)).toBe(false);
      expect(state.selectedEntryId).toBeNull();
      expect(selectCurrentFilePath(state)).toBeNull();
    });

    it('should reset to initial state', () => {
      act(() => {
        useVersionHistoryStore.getState().loadHistory([createEntry()], '/test/file.mdx');
        useVersionHistoryStore.getState().setError('some error');
      });

      act(() => {
        useVersionHistoryStore.getState().reset();
      });

      const state = useVersionHistoryStore.getState();
      expect(selectEntries(state)).toHaveLength(0);
      expect(selectIsLoading(state)).toBe(false);
      expect(selectError(state)).toBeNull();
      expect(selectCurrentFilePath(state)).toBeNull();
      expect(selectHasEntries(state)).toBe(false);
    });
  });

  describe('hasEntries selector', () => {
    it('should return false when no entries', () => {
      expect(selectHasEntries(useVersionHistoryStore.getState())).toBe(false);
    });

    it('should return true when entries exist', () => {
      act(() => {
        useVersionHistoryStore.getState().loadHistory([createEntry()], '/test/file.mdx');
      });

      expect(selectHasEntries(useVersionHistoryStore.getState())).toBe(true);
    });
  });
});
