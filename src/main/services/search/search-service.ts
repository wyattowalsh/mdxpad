/**
 * Full-text search service.
 * Indexes workspace files using MiniSearch for fast full-text search.
 *
 * @module search-service
 */

import MiniSearch from 'minisearch';
import { watch, type FSWatcher } from 'chokidar';
import { lstat, readFile, readdir, stat } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import type {
  SearchQueryResponse,
  SearchIndexResponse,
  SearchStatusResponse,
  SearchResult,
} from '@shared/contracts/search-schemas';
import { resolveWorkspaceFilePath } from '../ai/agent-path';
import { pathMatchesExclude } from './path-excludes';

export { pathMatchesExclude };

const DEFAULT_EXTENSIONS = ['.md', '.mdx', '.txt', '.markdown'];
const MAX_FILE_SIZE_BYTES = 1_048_576; // 1 MB
const DEBOUNCE_MS = 500;
const DEFAULT_MAX_RESULTS = 20;

interface IndexedDocument {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
}

interface WorkspaceIndex {
  miniSearch: MiniSearch<IndexedDocument>;
  fileCount: number;
  lastIndexedAt: string | null;
  watcher: FSWatcher | null;
}

const workspaceIndexes = new Map<string, WorkspaceIndex>();

function createMiniSearch(): MiniSearch<IndexedDocument> {
  return new MiniSearch<IndexedDocument>({
    fields: ['fileName', 'content'],
    storeFields: ['filePath', 'fileName', 'content'],
    searchOptions: {
      boost: { fileName: 2 },
      prefix: true,
      combineWith: 'AND',
    },
  });
}

function generateSnippet(content: string, query: string, maxLength = 200): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const queryWords = lowerQuery.split(/\s+/);

  let bestIndex = 0;
  for (const word of queryWords) {
    const idx = lowerContent.indexOf(word);
    if (idx >= 0) {
      bestIndex = idx;
      break;
    }
  }

  const halfLen = Math.floor(maxLength / 2);
  const start = Math.max(0, bestIndex - halfLen);
  const end = Math.min(content.length, start + maxLength);
  let snippet = content.slice(start, end).replace(/\n+/g, ' ').trim();

  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';

  return snippet;
}

function computeMatchRanges(content: string, query: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  const lowerContent = content.toLowerCase();
  const words = query.toLowerCase().split(/\s+/);

  for (const word of words) {
    if (word.length === 0) continue;
    let pos = 0;
    while (pos < lowerContent.length) {
      const idx = lowerContent.indexOf(word, pos);
      if (idx === -1) break;
      ranges.push({ start: idx, end: idx + word.length });
      pos = idx + 1;
      if (ranges.length > 50) break;
    }
  }

  return ranges.sort((a, b) => a.start - b.start);
}

async function readFileContent(filePath: string): Promise<string | null> {
  try {
    const fileStat = await stat(filePath);
    if (fileStat.size > MAX_FILE_SIZE_BYTES) return null;
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function watchedFileInside(workspaceDir: string, filePath: string): boolean {
  try {
    resolveWorkspaceFilePath(workspaceDir, filePath);
    return true;
  } catch {
    return false;
  }
}

function matchesExtensions(filePath: string, extensions: string[]): boolean {
  return extensions.includes(extname(filePath).toLowerCase());
}

async function collectFiles(
  dir: string,
  extensions: string[],
  excludePatterns: readonly string[] = []
): Promise<string[]> {
  const results: string[] = [];
  const queue = [dir];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) {
        continue;
      }
      const entries = await readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = join(current, entry.name);
        if (pathMatchesExclude(dir, fullPath, excludePatterns)) continue;
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          queue.push(fullPath);
        } else if (entry.isFile() && matchesExtensions(entry.name, extensions)) {
          results.push(fullPath);
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  return results;
}

export async function indexWorkspace(
  workspaceDir: string,
  fileExtensions?: string[],
  excludePatterns: readonly string[] = []
): Promise<SearchIndexResponse> {
  const startTime = Date.now();
  const extensions = fileExtensions ?? DEFAULT_EXTENSIONS;
  const files = await collectFiles(workspaceDir, extensions, excludePatterns);

  const miniSearch = createMiniSearch();
  const documents: IndexedDocument[] = [];

  for (const filePath of files) {
    const content = await readFileContent(filePath);
    if (content === null) continue;
    documents.push({
      id: relative(workspaceDir, filePath),
      filePath,
      fileName: basename(filePath),
      content,
    });
  }

  miniSearch.addAll(documents);

  const existing = workspaceIndexes.get(workspaceDir);
  if (existing?.watcher) {
    await existing.watcher.close();
  }
  const watcher = watchWorkspace(workspaceDir, extensions);

  const now = new Date().toISOString();
  workspaceIndexes.set(workspaceDir, {
    miniSearch,
    fileCount: documents.length,
    lastIndexedAt: now,
    watcher,
  });

  return {
    indexedFiles: documents.length,
    indexTimeMs: Date.now() - startTime,
  };
}

function watchWorkspace(workspaceDir: string, extensions: string[]): FSWatcher {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const watcher = watch(workspaceDir, {
    ignored: /(^|[/\\])(\.|node_modules)/,
    persistent: false,
    ignoreInitial: true,
    followSymlinks: false,
  });

  watcher.on('all', (_event, filePath) => {
    if (!watchedFileInside(workspaceDir, filePath)) return;
    if (!matchesExtensions(filePath, extensions)) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void updateSingleFile(workspaceDir, filePath, extensions);
    }, DEBOUNCE_MS);
  });

  return watcher;
}

async function updateSingleFile(
  workspaceDir: string,
  filePath: string,
  extensions: string[]
): Promise<void> {
  const index = workspaceIndexes.get(workspaceDir);
  if (!index) return;
  if (!matchesExtensions(filePath, extensions)) return;

  const docId = relative(workspaceDir, filePath);
  const existedBefore = index.miniSearch.has(docId);

  // Remove old version if it exists
  try {
    index.miniSearch.discard(docId);
  } catch {
    // Document might not exist yet
  }

  const content = await readFileContent(filePath);
  if (content !== null) {
    index.miniSearch.add({
      id: docId,
      filePath,
      fileName: basename(filePath),
      content,
    });
    if (!existedBefore) {
      index.fileCount += 1;
    }
  } else if (existedBefore) {
    index.fileCount = Math.max(0, index.fileCount - 1);
  }

  index.lastIndexedAt = new Date().toISOString();
}

export function search(
  workspaceDir: string,
  query: string,
  maxResults?: number,
  fuzzy?: boolean,
  excludePatterns: readonly string[] = []
): SearchQueryResponse {
  const startTime = Date.now();
  const index = workspaceIndexes.get(workspaceDir);

  if (!index) {
    return { results: [], totalResults: 0, queryTimeMs: 0 };
  }

  const limit = maxResults ?? DEFAULT_MAX_RESULTS;
  const searchResults = index.miniSearch
    .search(query, {
      fuzzy: fuzzy === true ? 0.2 : false,
      prefix: true,
    })
    .filter((result) => {
      const stored = result as unknown as { filePath?: string };
      return (
        stored.filePath === undefined ||
        !pathMatchesExclude(workspaceDir, stored.filePath, excludePatterns)
      );
    });

  const results: SearchResult[] = searchResults.slice(0, limit).map((result) => {
    const stored = result as unknown as { filePath: string; fileName: string; content: string };
    return {
      filePath: stored.filePath,
      fileName: stored.fileName,
      score: result.score,
      snippet: generateSnippet(stored.content, query),
      matchRanges: computeMatchRanges(stored.content, query),
    };
  });

  return {
    results,
    totalResults: searchResults.length,
    queryTimeMs: Date.now() - startTime,
  };
}

export function getStatus(workspaceDir: string): SearchStatusResponse {
  const index = workspaceIndexes.get(workspaceDir);
  if (!index) {
    return { indexed: false, fileCount: 0, lastIndexedAt: null };
  }
  return {
    indexed: true,
    fileCount: index.fileCount,
    lastIndexedAt: index.lastIndexedAt,
  };
}

export async function closeIndex(workspaceDir: string): Promise<void> {
  const index = workspaceIndexes.get(workspaceDir);
  if (index?.watcher) {
    await index.watcher.close();
  }
  workspaceIndexes.delete(workspaceDir);
}
