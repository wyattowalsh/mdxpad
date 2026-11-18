/**
 * Embedding Service
 *
 * Generates embeddings for workspace files and manages incremental updates.
 * Uses the existing AI provider's embedding endpoint via AIService.
 *
 * @module src/main/services/ai/embedding-service
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  assertEmbeddingsAvailable,
  type EmbeddingAvailabilitySource,
} from './embedding-availability';
import type { IAIService } from './ai-types';
import { pathMatchesExclude } from '@main/services/search/path-excludes';
import { readRealDirectory } from './directory-entries';
import { VectorStore, type VectorEntry } from './vector-store';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum characters per text chunk for embedding */
const CHUNK_SIZE = 1000;

/** Overlap between chunks to preserve context */
const CHUNK_OVERLAP = 200;

/** File extensions to index */
const INDEXABLE_EXTENSIONS = new Set([
  '.md',
  '.mdx',
  '.txt',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.yaml',
  '.yml',
]);

/** Maximum file size to index (100KB) */
const MAX_FILE_SIZE = 100 * 1024;

// =============================================================================
// TEXT CHUNKING
// =============================================================================

/**
 * Splits text into overlapping chunks for embedding.
 */
export function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

// =============================================================================
// FILE DISCOVERY
// =============================================================================

/**
 * Recursively finds indexable files in a workspace directory.
 */
export async function findIndexableFiles(
  dirPath: string,
  excludePatterns: readonly string[] = []
): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readRealDirectory(dir);
    if (!entries) {
      return;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);

      // Skip hidden directories and node_modules
      if (pathMatchesExclude(dirPath, fullPath, excludePatterns)) {
        continue;
      }
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!INDEXABLE_EXTENSIONS.has(ext)) continue;

      try {
        const stat = await fs.promises.stat(fullPath);
        if (stat.size <= MAX_FILE_SIZE) {
          results.push(fullPath);
        }
      } catch {
        // Skip files that can't be stat'd
      }
    }
  }

  await walk(dirPath);
  return results;
}

function vectorsForFile(
  filePath: string,
  chunks: readonly string[],
  embeddings: readonly number[][]
): VectorEntry[] {
  const entries: VectorEntry[] = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const content = chunks[index];
    const embedding = embeddings[index];
    if (content === undefined || embedding === undefined) {
      continue;
    }
    entries.push({
      id: `${filePath}:${index}`,
      filePath,
      content,
      chunkIndex: index,
      embedding,
    });
  }
  return entries;
}

// =============================================================================
// EMBEDDING SERVICE
// =============================================================================

export class EmbeddingService {
  private stores = new Map<string, VectorStore>();

  constructor(
    private readonly aiService: IAIService,
    private readonly availability?: EmbeddingAvailabilitySource
  ) {}

  private async assertAvailable(): Promise<void> {
    if (!this.availability) {
      return;
    }
    await assertEmbeddingsAvailable(this.availability);
  }

  /**
   * Gets or creates a vector store for a workspace.
   */
  private async getStore(workspacePath: string): Promise<VectorStore> {
    let store = this.stores.get(workspacePath);
    if (!store) {
      store = new VectorStore(workspacePath);
      await store.loadFromDisk();
      this.stores.set(workspacePath, store);
    }
    return store;
  }

  /**
   * Indexes all files in a workspace, generating embeddings.
   */
  async indexWorkspace(
    workspacePath: string,
    forceReindex = false,
    excludePatterns: readonly string[] = []
  ): Promise<{ indexedFiles: number; totalChunks: number }> {
    await this.assertAvailable();
    const store = await this.getStore(workspacePath);

    if (forceReindex) {
      store.clear();
    } else if (excludePatterns.length > 0) {
      store.removeWhere((filePath) => pathMatchesExclude(workspacePath, filePath, excludePatterns));
    }

    const files = await findIndexableFiles(workspacePath, excludePatterns);
    let totalChunks = 0;
    let indexedFiles = 0;

    // Process files in batches to avoid overwhelming the AI provider
    const batchSize = 5;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchEntries: VectorEntry[] = [];

      for (const filePath of batch) {
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const chunks = chunkText(content);

          // Generate embeddings for all chunks at once
          const response = await this.aiService.generateEmbedding({
            texts: chunks,
          });

          const entries = vectorsForFile(filePath, chunks, response.embeddings);
          if (entries.length === 0) {
            continue;
          }
          batchEntries.push(...entries);
          totalChunks += entries.length;
          indexedFiles += 1;
        } catch (error) {
          console.error(`[EmbeddingService] Failed to index ${filePath}:`, error);
        }
      }

      store.upsert(batchEntries);
    }

    await store.saveToDisk();
    return { indexedFiles, totalChunks };
  }

  /**
   * Searches the index using a natural language query.
   */
  async search(
    workspacePath: string,
    query: string,
    topK = 10,
    excludePatterns: readonly string[] = []
  ): Promise<{ filePath: string; content: string; score: number; chunkIndex: number }[]> {
    await this.assertAvailable();
    const store = await this.getStore(workspacePath);

    if (store.size === 0) {
      return [];
    }

    // Generate embedding for the query
    const response = await this.aiService.generateEmbedding({
      texts: [query],
    });

    const queryEmbedding = response.embeddings[0];
    if (!queryEmbedding) {
      return [];
    }
    const results = store.search(
      queryEmbedding,
      topK,
      (filePath) => !pathMatchesExclude(workspacePath, filePath, excludePatterns)
    );

    return results.map(({ entry, score }) => ({
      filePath: entry.filePath,
      content: entry.content,
      score,
      chunkIndex: entry.chunkIndex,
    }));
  }

  /**
   * Gets the current index status for a workspace.
   */
  async getIndexStatus(workspacePath: string): Promise<{
    isIndexed: boolean;
    fileCount: number;
    chunkCount: number;
    lastIndexedAt: string | null;
  }> {
    const store = await this.getStore(workspacePath);
    return {
      isIndexed: store.size > 0,
      fileCount: store.filePaths.size,
      chunkCount: store.size,
      lastIndexedAt: store.indexedAt,
    };
  }

  /**
   * Updates embeddings for a single file (incremental update).
   */
  async updateFile(workspacePath: string, filePath: string): Promise<void> {
    await this.assertAvailable();
    const store = await this.getStore(workspacePath);

    // Remove old entries for this file
    store.removeByFilePath(filePath);

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const chunks = chunkText(content);

      const response = await this.aiService.generateEmbedding({
        texts: chunks,
      });

      const entries: VectorEntry[] = chunks
        .map((chunk, i) => {
          const emb = response.embeddings[i];
          if (!emb) return null;
          return {
            id: `${filePath}:${i}`,
            filePath,
            content: chunk,
            chunkIndex: i,
            embedding: emb,
          };
        })
        .filter((e): e is VectorEntry => e !== null);

      store.upsert(entries);
      await store.saveToDisk();
    } catch (error) {
      console.error(`[EmbeddingService] Failed to update ${filePath}:`, error);
    }
  }
}
