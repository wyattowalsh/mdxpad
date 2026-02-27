/**
 * Unit tests for Semantic Search Store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSemanticSearchStore } from './semantic-search-store';

describe('useSemanticSearchStore', () => {
  beforeEach(() => {
    useSemanticSearchStore.getState().reset();
  });

  it('should initialize with empty state', () => {
    const state = useSemanticSearchStore.getState();
    expect(state.query).toBe('');
    expect(state.results).toHaveLength(0);
    expect(state.isSearching).toBe(false);
    expect(state.isIndexing).toBe(false);
    expect(state.isIndexed).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should update query', () => {
    useSemanticSearchStore.getState().setQuery('test query');
    expect(useSemanticSearchStore.getState().query).toBe('test query');
  });

  it('should clear results', () => {
    // Manually set some state to test clearing
    useSemanticSearchStore.getState().setQuery('something');
    useSemanticSearchStore.getState().clearResults();

    const state = useSemanticSearchStore.getState();
    expect(state.results).toHaveLength(0);
    expect(state.query).toBe('');
  });

  it('should clear error', () => {
    // Use handleStreamEvent-like approach: directly set error via internal state
    useSemanticSearchStore.setState({ error: 'test error' });
    useSemanticSearchStore.getState().clearError();
    expect(useSemanticSearchStore.getState().error).toBeNull();
  });

  it('should reset to initial state', () => {
    useSemanticSearchStore.getState().setQuery('query');
    useSemanticSearchStore.setState({
      isIndexed: true,
      fileCount: 10,
      chunkCount: 50,
    });

    useSemanticSearchStore.getState().reset();

    const state = useSemanticSearchStore.getState();
    expect(state.query).toBe('');
    expect(state.isIndexed).toBe(false);
    expect(state.fileCount).toBe(0);
    expect(state.chunkCount).toBe(0);
  });

  it('should not search with empty query', async () => {
    useSemanticSearchStore.getState().setQuery('');
    await useSemanticSearchStore.getState().search('/test/workspace');

    const state = useSemanticSearchStore.getState();
    expect(state.isSearching).toBe(false);
  });

  it('should not search with whitespace-only query', async () => {
    useSemanticSearchStore.getState().setQuery('   ');
    await useSemanticSearchStore.getState().search('/test/workspace');

    const state = useSemanticSearchStore.getState();
    expect(state.isSearching).toBe(false);
  });
});
