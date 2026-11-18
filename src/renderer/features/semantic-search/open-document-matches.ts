/**
 * Include open documents whose text contains the query.
 * The embedding index can lag behind unsaved editor text.
 */

import type { SemanticSearchResult } from '@shared/contracts/semantic-search-schemas';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';

function insideWorkspace(workspacePath: string, filePath: string): boolean {
  const root = workspacePath.endsWith('/') ? workspacePath.slice(0, -1) : workspacePath;
  return filePath === root || filePath.startsWith(`${root}/`);
}

function containsQuery(content: string, query: string): boolean {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return false;
  }
  const haystack = content.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

function editorResult(filePath: string, content: string): SemanticSearchResult {
  return {
    filePath,
    content: content.slice(0, 200),
    score: 1,
    chunkIndex: 0,
  };
}

function openDocuments(workspacePath: string): Map<string, string> {
  const documents = new Map<string, string>();
  const state = useDocumentStore.getState();
  if (state.filePath && insideWorkspace(workspacePath, state.filePath)) {
    documents.set(state.filePath, state.content);
  }
  for (const tab of useTabStore.getState().tabs) {
    if (
      !tab.filePath ||
      tab.filePath === state.filePath ||
      !insideWorkspace(workspacePath, tab.filePath)
    ) {
      continue;
    }
    documents.set(tab.filePath, tab.content);
  }
  return documents;
}

/** Put matching open documents ahead of embedding hits, with their current text. */
export function withOpenDocumentMatches(
  results: readonly SemanticSearchResult[],
  workspacePath: string,
  query: string
): SemanticSearchResult[] {
  let next = [...results];
  for (const [filePath, content] of openDocuments(workspacePath)) {
    if (!containsQuery(content, query)) {
      continue;
    }
    const match = editorResult(filePath, content);
    const index = next.findIndex((result) => result.filePath === filePath);
    if (index === -1) {
      next = [match, ...next];
      continue;
    }
    const current = next[index];
    if (current) {
      next[index] = { ...current, content: match.content };
    }
  }
  return next;
}
