/**
 * Semantic Search Panel
 *
 * UI for natural language search across workspace files using
 * AI-powered embeddings. Shows results with relevance scores.
 *
 * @module src/renderer/features/semantic-search/SemanticSearchPanel
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  useSemanticSearchStore,
  selectQuery,
  selectResults,
  selectIsSearching,
  selectIsIndexing,
  selectIsIndexed,
  selectError,
} from './semantic-search-store';
import type { SemanticSearchResult } from '@shared/contracts/semantic-search-schemas';

// =============================================================================
// RESULT ITEM
// =============================================================================

function SearchResultItem({
  result,
  onClick,
}: {
  result: SemanticSearchResult;
  onClick: (filePath: string) => void;
}) {
  const scorePercent = Math.round(result.score * 100);
  const fileName = result.filePath.split('/').pop() ?? result.filePath;

  return (
    <button
      type="button"
      onClick={() => onClick(result.filePath)}
      className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{fileName}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            scorePercent >= 80
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : scorePercent >= 60
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          {scorePercent}%
        </span>
      </div>
      <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
        {result.content.slice(0, 200)}
      </p>
      <p className="mt-1 text-xs text-gray-400">{result.filePath}</p>
    </button>
  );
}

// =============================================================================
// SEMANTIC SEARCH PANEL
// =============================================================================

interface SemanticSearchPanelProps {
  workspacePath: string;
  onNavigateToFile?: (filePath: string) => void;
}

export function SemanticSearchPanel({ workspacePath, onNavigateToFile }: SemanticSearchPanelProps) {
  const query = useSemanticSearchStore(selectQuery);
  const results = useSemanticSearchStore(selectResults);
  const isSearching = useSemanticSearchStore(selectIsSearching);
  const isIndexing = useSemanticSearchStore(selectIsIndexing);
  const isIndexed = useSemanticSearchStore(selectIsIndexed);
  const error = useSemanticSearchStore(selectError);
  const { setQuery, search, indexWorkspace, checkIndexStatus, clearResults } =
    useSemanticSearchStore();

  const seenWorkspace = useRef<string | null>(null);

  useEffect(() => {
    if (seenWorkspace.current !== null && seenWorkspace.current !== workspacePath) {
      clearResults();
    }
    seenWorkspace.current = workspacePath;
    if (workspacePath.length === 0) {
      return;
    }
    void checkIndexStatus(workspacePath);
  }, [checkIndexStatus, clearResults, workspacePath]);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(() => {
    void search(workspacePath);
  }, [search, workspacePath]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      }
    },
    [handleSearch]
  );

  const handleIndex = useCallback(() => {
    void indexWorkspace(workspacePath);
  }, [indexWorkspace, workspacePath]);

  const handleResultClick = useCallback(
    (filePath: string) => {
      onNavigateToFile?.(filePath);
    },
    [onNavigateToFile]
  );

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="border-b px-3 py-2 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Semantic Search</h3>
      </div>

      {/* Search Input */}
      <div className="border-b p-3 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search with natural language..."
            disabled={isSearching}
            className="flex-1 rounded-lg border bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Index Status */}
      {workspacePath.length === 0 ? (
        <div className="border-b p-3 dark:border-gray-700">
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            Open a file inside a folder to search.
          </p>
        </div>
      ) : (
        !isIndexed && (
          <div className="border-b p-3 dark:border-gray-700">
            <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950">
              <p className="mb-2 text-xs text-yellow-700 dark:text-yellow-300">
                Workspace not indexed. Index files to enable semantic search.
              </p>
              <button
                type="button"
                onClick={handleIndex}
                disabled={isIndexing}
                className="rounded bg-yellow-600 px-3 py-1 text-xs text-white hover:bg-yellow-700 disabled:opacity-50"
              >
                {isIndexing ? 'Indexing...' : 'Index Workspace'}
              </button>
            </div>
          </div>
        )
      )}

      {/* Error */}
      {error && (
        <div className="mx-3 mt-2 rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {results.length > 0 && (
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={clearResults}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          </div>
        )}
        {results.map((result) => (
          <SearchResultItem
            key={`${result.filePath}-${result.chunkIndex}`}
            result={result}
            onClick={handleResultClick}
          />
        ))}
        {results.length === 0 && query && !isSearching && (
          <div className="flex h-32 items-center justify-center text-sm text-gray-400">
            No results found
          </div>
        )}
      </div>
    </div>
  );
}
