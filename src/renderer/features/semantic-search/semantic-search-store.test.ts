/**
 * Unit tests for Semantic Search Store.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DocumentId } from '@shared/types/document';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';
import { useSemanticSearchStore } from './semantic-search-store';

describe('useSemanticSearchStore', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    useSemanticSearchStore.getState().reset();
    useDocumentStore.getState().reset();
    useTabStore.getState().reset();
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

  it('asks for an open folder instead of staying busy', async () => {
    useSemanticSearchStore.getState().setQuery('notes');
    await useSemanticSearchStore.getState().search('  ');

    const state = useSemanticSearchStore.getState();
    expect(state.isSearching).toBe(false);
    expect(state.error).toBe('Open a file inside a folder to search');
  });

  it('includes unsaved editor text the embedding index missed', async () => {
    useDocumentStore.getState().openDocument(
      {
        fileId: 'file-1' as DocumentId,
        filePath: '/notes/readme.md',
        mtime: 1,
      },
      'old'
    );
    useDocumentStore.getState().setContent('brand new phrase');
    useTabStore.getState().addTab({
      filePath: '/notes/other.md',
      fileName: 'other.md',
      isDirty: true,
      content: 'brand new in the other tab',
      savedContent: '',
    });
    useTabStore.getState().addTab({
      filePath: '/outside/secret.md',
      fileName: 'secret.md',
      isDirty: true,
      content: 'brand new phrase outside',
      savedContent: '',
    });
    vi.stubGlobal('mdxpad', {
      semanticSearch: {
        search: vi.fn().mockResolvedValue({ success: true, results: [] }),
      },
    });
    useSemanticSearchStore.getState().setQuery('brand new');

    await useSemanticSearchStore.getState().search('/notes');

    const results = useSemanticSearchStore.getState().results;
    expect(results.map((result) => result.filePath)).toEqual([
      '/notes/other.md',
      '/notes/readme.md',
    ]);
    expect(results[1]?.content).toContain('brand new phrase');
  });

  it('says when semantic search is unavailable', async () => {
    useSemanticSearchStore.getState().setQuery('notes');
    await useSemanticSearchStore.getState().search('/notes');

    const state = useSemanticSearchStore.getState();
    expect(state.isSearching).toBe(false);
    expect(state.isIndexing).toBe(false);
    expect(state.error).toBe('Semantic search is not available');
  });

  it('does not mark the folder indexed when no files were stored', async () => {
    vi.stubGlobal('mdxpad', {
      semanticSearch: {
        indexWorkspace: vi.fn().mockResolvedValue({
          success: true,
          indexedFiles: 0,
          totalChunks: 0,
        }),
      },
    });

    await useSemanticSearchStore.getState().indexWorkspace('/notes');

    const state = useSemanticSearchStore.getState();
    expect(state.isIndexing).toBe(false);
    expect(state.isIndexed).toBe(false);
    expect(state.error).toBe('No files were indexed');
  });

  it('loads index status for the open folder', async () => {
    vi.stubGlobal('mdxpad', {
      semanticSearch: {
        getIndexStatus: vi.fn().mockResolvedValue({
          success: true,
          isIndexed: true,
          fileCount: 3,
          chunkCount: 8,
          lastIndexedAt: '2026-11-17T15:00:00.000Z',
        }),
      },
    });

    await useSemanticSearchStore.getState().checkIndexStatus('/notes');

    const state = useSemanticSearchStore.getState();
    expect(state.isIndexed).toBe(true);
    expect(state.fileCount).toBe(3);
    expect(state.chunkCount).toBe(8);
  });
});
