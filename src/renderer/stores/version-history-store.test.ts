/**
 * Version History Store Tests
 *
 * Tests for the version history store including loading, selection,
 * adding entries, and selectors.
 *
 * @module renderer/stores/version-history-store.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useVersionHistoryStore,
  selectEntries,
  selectSelectedEntry,
  selectIsLoading,
  selectError,
  selectCurrentFilePath,
  selectEntriesBySource,
  selectHasEntries,
  INITIAL_VERSION_HISTORY_STATE,
} from './version-history-store';
import type { VersionEntry } from '@shared/contracts/history-schemas';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockEntry(overrides: Partial<VersionEntry> = {}): VersionEntry {
  return {
    id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    source: 'manual',
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useVersionHistoryStore', () => {
  beforeEach(() => {
    useVersionHistoryStore.getState().reset();
  });

  describe('initial state', () => {
    it('should start with empty entries', () => {
      const state = useVersionHistoryStore.getState();
      expect(state.entries).toHaveLength(0);
    });

    it('should start with no selected entry', () => {
      const state = useVersionHistoryStore.getState();
      expect(state.selectedEntryId).toBeNull();
    });

    it('should start with isLoading false', () => {
      const state = useVersionHistoryStore.getState();
      expect(state.isLoading).toBe(false);
    });

    it('should start with no error', () => {
      const state = useVersionHistoryStore.getState();
      expect(state.error).toBeNull();
    });

    it('should start with no current file path', () => {
      const state = useVersionHistoryStore.getState();
      expect(state.currentFilePath).toBeNull();
    });
  });

  describe('loadHistory', () => {
    it('should load entries and set file path', () => {
      const entries = [
        createMockEntry({ id: 'v1', timestamp: 1000 }),
        createMockEntry({ id: 'v2', timestamp: 2000 }),
      ];

      useVersionHistoryStore.getState().loadHistory(entries, '/path/to/file.mdx');
      const state = useVersionHistoryStore.getState();

      expect(state.entries).toHaveLength(2);
      expect(state.currentFilePath).toBe('/path/to/file.mdx');
    });

    it('should sort entries by timestamp (newest first)', () => {
      const entries = [
        createMockEntry({ id: 'v1', timestamp: 1000 }),
        createMockEntry({ id: 'v3', timestamp: 3000 }),
        createMockEntry({ id: 'v2', timestamp: 2000 }),
      ];

      useVersionHistoryStore.getState().loadHistory(entries, '/file.mdx');
      const state = useVersionHistoryStore.getState();

      expect(state.entries.at(0)?.id).toBe('v3');
      expect(state.entries.at(1)?.id).toBe('v2');
      expect(state.entries.at(2)?.id).toBe('v1');
    });

    it('should clear loading and error state', () => {
      useVersionHistoryStore.getState().setLoading(true);
      useVersionHistoryStore.getState().setError('Some error');
      useVersionHistoryStore.getState().loadHistory([], '/file.mdx');

      const state = useVersionHistoryStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should clear selected entry', () => {
      useVersionHistoryStore.getState().selectEntry('v1');
      useVersionHistoryStore.getState().loadHistory([], '/file.mdx');
      expect(useVersionHistoryStore.getState().selectedEntryId).toBeNull();
    });
  });

  describe('selectEntry', () => {
    it('should select an entry by ID', () => {
      useVersionHistoryStore.getState().selectEntry('v1');
      expect(useVersionHistoryStore.getState().selectedEntryId).toBe('v1');
    });

    it('should deselect when passing null', () => {
      useVersionHistoryStore.getState().selectEntry('v1');
      useVersionHistoryStore.getState().selectEntry(null);
      expect(useVersionHistoryStore.getState().selectedEntryId).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('should set loading to true', () => {
      useVersionHistoryStore.getState().setLoading(true);
      expect(useVersionHistoryStore.getState().isLoading).toBe(true);
    });

    it('should clear error when setting loading to true', () => {
      useVersionHistoryStore.getState().setError('Error');
      useVersionHistoryStore.getState().setLoading(true);
      expect(useVersionHistoryStore.getState().error).toBeNull();
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      useVersionHistoryStore.getState().setError('Failed to load');
      expect(useVersionHistoryStore.getState().error).toBe('Failed to load');
    });

    it('should set loading to false when error is set', () => {
      useVersionHistoryStore.getState().setLoading(true);
      useVersionHistoryStore.getState().setError('Error');
      expect(useVersionHistoryStore.getState().isLoading).toBe(false);
    });

    it('should clear error when set to null', () => {
      useVersionHistoryStore.getState().setError('Error');
      useVersionHistoryStore.getState().setError(null);
      expect(useVersionHistoryStore.getState().error).toBeNull();
    });
  });

  describe('addEntry', () => {
    it('should add entry to the list', () => {
      const entry = createMockEntry({ id: 'new-v', timestamp: 5000 });
      useVersionHistoryStore.getState().addEntry(entry);
      expect(useVersionHistoryStore.getState().entries).toHaveLength(1);
    });

    it('should maintain sorted order when adding', () => {
      const entries = [
        createMockEntry({ id: 'v1', timestamp: 1000 }),
        createMockEntry({ id: 'v3', timestamp: 3000 }),
      ];
      useVersionHistoryStore.getState().loadHistory(entries, '/file.mdx');

      const newEntry = createMockEntry({ id: 'v2', timestamp: 2000 });
      useVersionHistoryStore.getState().addEntry(newEntry);

      const state = useVersionHistoryStore.getState();
      expect(state.entries.at(0)?.id).toBe('v3');
      expect(state.entries.at(1)?.id).toBe('v2');
      expect(state.entries.at(2)?.id).toBe('v1');
    });
  });

  describe('clearHistory', () => {
    it('should clear all entries and selection', () => {
      const entries = [createMockEntry({ id: 'v1' })];
      useVersionHistoryStore.getState().loadHistory(entries, '/file.mdx');
      useVersionHistoryStore.getState().selectEntry('v1');
      useVersionHistoryStore.getState().clearHistory();

      const state = useVersionHistoryStore.getState();
      expect(state.entries).toHaveLength(0);
      expect(state.selectedEntryId).toBeNull();
      expect(state.currentFilePath).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      useVersionHistoryStore.getState().loadHistory([createMockEntry()], '/file.mdx');
      useVersionHistoryStore.getState().selectEntry('v1');
      useVersionHistoryStore.getState().setError('Error');
      useVersionHistoryStore.getState().reset();

      const state = useVersionHistoryStore.getState();
      expect(state.entries).toEqual(INITIAL_VERSION_HISTORY_STATE.entries);
      expect(state.selectedEntryId).toEqual(INITIAL_VERSION_HISTORY_STATE.selectedEntryId);
      expect(state.isLoading).toEqual(INITIAL_VERSION_HISTORY_STATE.isLoading);
      expect(state.error).toEqual(INITIAL_VERSION_HISTORY_STATE.error);
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    useVersionHistoryStore.getState().reset();
  });

  describe('selectEntries', () => {
    it('should return all entries', () => {
      const entries = selectEntries(useVersionHistoryStore.getState());
      expect(entries).toHaveLength(0);
    });
  });

  describe('selectSelectedEntry', () => {
    it('should return undefined when nothing selected', () => {
      expect(selectSelectedEntry(useVersionHistoryStore.getState())).toBeUndefined();
    });

    it('should return the selected entry', () => {
      const entry = createMockEntry({ id: 'v1', timestamp: 1000 });
      useVersionHistoryStore.getState().loadHistory([entry], '/file.mdx');
      useVersionHistoryStore.getState().selectEntry('v1');
      const selected = selectSelectedEntry(useVersionHistoryStore.getState());
      expect(selected?.id).toBe('v1');
    });
  });

  describe('selectIsLoading', () => {
    it('should return loading state', () => {
      expect(selectIsLoading(useVersionHistoryStore.getState())).toBe(false);
      useVersionHistoryStore.getState().setLoading(true);
      expect(selectIsLoading(useVersionHistoryStore.getState())).toBe(true);
    });
  });

  describe('selectError', () => {
    it('should return error state', () => {
      expect(selectError(useVersionHistoryStore.getState())).toBeNull();
      useVersionHistoryStore.getState().setError('Fail');
      expect(selectError(useVersionHistoryStore.getState())).toBe('Fail');
    });
  });

  describe('selectCurrentFilePath', () => {
    it('should return current file path', () => {
      expect(selectCurrentFilePath(useVersionHistoryStore.getState())).toBeNull();
      useVersionHistoryStore.getState().loadHistory([], '/test.mdx');
      expect(selectCurrentFilePath(useVersionHistoryStore.getState())).toBe('/test.mdx');
    });
  });

  describe('selectEntriesBySource', () => {
    it('should filter entries by source', () => {
      const entries = [
        createMockEntry({ id: 'v1', source: 'autosave', timestamp: 1000 }),
        createMockEntry({ id: 'v2', source: 'manual', timestamp: 2000 }),
        createMockEntry({ id: 'v3', source: 'git', timestamp: 3000 }),
        createMockEntry({ id: 'v4', source: 'autosave', timestamp: 4000 }),
      ];
      useVersionHistoryStore.getState().loadHistory(entries, '/file.mdx');

      const autosaveEntries = selectEntriesBySource(useVersionHistoryStore.getState(), 'autosave');
      expect(autosaveEntries).toHaveLength(2);
    });
  });

  describe('selectHasEntries', () => {
    it('should return false when no entries', () => {
      expect(selectHasEntries(useVersionHistoryStore.getState())).toBe(false);
    });

    it('should return true when entries exist', () => {
      useVersionHistoryStore.getState().loadHistory([createMockEntry()], '/file.mdx');
      expect(selectHasEntries(useVersionHistoryStore.getState())).toBe(true);
    });
  });
});
