/**
 * In-Memory Vector Store
 *
 * Provides cosine similarity search over embedding vectors with
 * disk persistence to a JSON file in the workspace `.mdxpad/` directory.
 *
 * @module src/main/services/ai/vector-store
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// =============================================================================
// TYPES
// =============================================================================

export interface VectorEntry {
  readonly id: string;
  readonly filePath: string;
  readonly content: string;
  readonly chunkIndex: number;
  readonly embedding: number[];
}

interface SerializedStore {
  version: number;
  entries: VectorEntry[];
  lastIndexedAt: string;
}

// =============================================================================
// VECTOR MATH
// =============================================================================

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (const [i, ai] of a.entries()) {
    const bi = b[i] ?? 0;
    sum += ai * bi;
  }
  return sum;
}

function magnitude(v: number[]): number {
  let sum = 0;
  for (const vi of v) {
    sum += vi * vi;
  }
  return Math.sqrt(sum);
}

/**
 * Computes cosine similarity between two vectors.
 * Returns a value between -1 and 1 (1 = identical direction).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

// =============================================================================
// VECTOR STORE
// =============================================================================

export class VectorStore {
  private entries = new Map<string, VectorEntry>();
  private lastIndexedAt: string | null = null;
  private readonly storagePath: string;

  constructor(workspacePath: string) {
    this.storagePath = path.join(workspacePath, '.mdxpad', 'vector-index.json');
  }

  /**
   * Adds or updates entries in the store.
   */
  upsert(entries: VectorEntry[]): void {
    for (const entry of entries) {
      this.entries.set(entry.id, entry);
    }
    this.lastIndexedAt = new Date().toISOString();
  }

  /**
   * Removes all entries for a given file path.
   */
  removeByFilePath(filePath: string): void {
    for (const [id, entry] of this.entries) {
      if (entry.filePath === filePath) {
        this.entries.delete(id);
      }
    }
  }

  /**
   * Performs top-K cosine similarity search.
   */
  search(queryEmbedding: number[], topK: number): { entry: VectorEntry; score: number }[] {
    const scored: { entry: VectorEntry; score: number }[] = [];

    for (const entry of this.entries.values()) {
      const score = cosineSimilarity(queryEmbedding, entry.embedding);
      scored.push({ entry, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * Returns the number of entries in the store.
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Returns the set of unique file paths in the store.
   */
  get filePaths(): Set<string> {
    const paths = new Set<string>();
    for (const entry of this.entries.values()) {
      paths.add(entry.filePath);
    }
    return paths;
  }

  /**
   * Returns when the index was last built.
   */
  get indexedAt(): string | null {
    return this.lastIndexedAt;
  }

  /**
   * Clears all entries.
   */
  clear(): void {
    this.entries.clear();
    this.lastIndexedAt = null;
  }

  /**
   * Persists the store to disk as JSON.
   */
  async saveToDisk(): Promise<void> {
    const dir = path.dirname(this.storagePath);
    await fs.promises.mkdir(dir, { recursive: true });

    const data: SerializedStore = {
      version: 1,
      entries: Array.from(this.entries.values()),
      lastIndexedAt: this.lastIndexedAt ?? new Date().toISOString(),
    };

    await fs.promises.writeFile(this.storagePath, JSON.stringify(data), 'utf-8');
  }

  /**
   * Loads the store from disk if the file exists.
   */
  async loadFromDisk(): Promise<boolean> {
    try {
      const raw = await fs.promises.readFile(this.storagePath, 'utf-8');
      const data = JSON.parse(raw) as SerializedStore;

      if (data.version !== 1) return false;

      this.entries.clear();
      for (const entry of data.entries) {
        this.entries.set(entry.id, entry);
      }
      this.lastIndexedAt = data.lastIndexedAt;
      return true;
    } catch {
      return false;
    }
  }
}
