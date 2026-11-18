/**
 * Unit tests for Vector Store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VectorStore, cosineSimilarity, type VectorEntry } from './vector-store';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0);
  });

  it('should return -1 for opposite vectors', () => {
    const a = [1, 0];
    const b = [-1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0);
  });

  it('should return 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('should return 0 for zero vectors', () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });

  it('should handle different-length vectors', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });
});

describe('VectorStore', () => {
  let store: VectorStore;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-store-test-'));
    store = new VectorStore(tmpDir);
  });

  const makeEntry = (id: string, filePath: string, embedding: number[]): VectorEntry => ({
    id,
    filePath,
    content: `Content of ${id}`,
    chunkIndex: 0,
    embedding,
  });

  it('should start empty', () => {
    expect(store.size).toBe(0);
    expect(store.filePaths.size).toBe(0);
    expect(store.indexedAt).toBeNull();
  });

  it('should upsert entries', () => {
    store.upsert([makeEntry('a', '/file1.md', [1, 0, 0]), makeEntry('b', '/file2.md', [0, 1, 0])]);

    expect(store.size).toBe(2);
    expect(store.filePaths.size).toBe(2);
    expect(store.indexedAt).not.toBeNull();
  });

  it('should search by cosine similarity', () => {
    store.upsert([
      makeEntry('a', '/file1.md', [1, 0, 0]),
      makeEntry('b', '/file2.md', [0, 1, 0]),
      makeEntry('c', '/file3.md', [0.9, 0.1, 0]),
    ]);

    const results = store.search([1, 0, 0], 2);
    expect(results).toHaveLength(2);
    // First result should be the most similar
    const first = results[0];
    const second = results[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first!.entry.id).toBe('a');
    expect(first!.score).toBeCloseTo(1.0);
    // Second should be the 90% similar one
    expect(second!.entry.id).toBe('c');
  });

  it('should remove entries by file path', () => {
    store.upsert([
      makeEntry('a', '/file1.md', [1, 0, 0]),
      makeEntry('b', '/file1.md', [0, 1, 0]),
      makeEntry('c', '/file2.md', [0, 0, 1]),
    ]);

    store.removeByFilePath('/file1.md');

    expect(store.size).toBe(1);
    expect(store.filePaths.has('/file1.md')).toBe(false);
    expect(store.filePaths.has('/file2.md')).toBe(true);
  });

  it('should clear all entries', () => {
    store.upsert([makeEntry('a', '/file1.md', [1, 0, 0])]);
    store.clear();

    expect(store.size).toBe(0);
    expect(store.indexedAt).toBeNull();
  });

  it('should persist to and load from disk', async () => {
    store.upsert([makeEntry('a', '/file1.md', [1, 0, 0]), makeEntry('b', '/file2.md', [0, 1, 0])]);

    await store.saveToDisk();

    const store2 = new VectorStore(tmpDir);
    const loaded = await store2.loadFromDisk();

    expect(loaded).toBe(true);
    expect(store2.size).toBe(2);
  });

  it('does not load or overwrite an index that is a link', async () => {
    const indexDir = path.join(tmpDir, '.mdxpad');
    fs.mkdirSync(indexDir);
    const outside = path.join(tmpDir, 'secret.json');
    const indexPath = path.join(indexDir, 'vector-index.json');
    fs.writeFileSync(
      outside,
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'secret',
            filePath: '/secret.md',
            content: 'hidden',
            chunkIndex: 0,
            embedding: [1, 0, 0],
          },
        ],
        lastIndexedAt: '2020-01-01T00:00:00.000Z',
      })
    );
    fs.symlinkSync(outside, indexPath);

    await expect(store.loadFromDisk()).resolves.toBe(false);
    expect(store.size).toBe(0);

    store.upsert([makeEntry('local', '/note.md', [1, 0, 0])]);
    await store.saveToDisk();

    expect(fs.readFileSync(outside, 'utf-8')).toContain('secret');
    expect(fs.lstatSync(indexPath).isSymbolicLink()).toBe(false);
    const reloaded = new VectorStore(tmpDir);
    await expect(reloaded.loadFromDisk()).resolves.toBe(true);
    expect(reloaded.size).toBe(1);
  });

  it('should return false when loading from non-existent file', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-empty-'));
    const emptyStore = new VectorStore(emptyDir);
    const loaded = await emptyStore.loadFromDisk();
    expect(loaded).toBe(false);
  });

  it('should handle top-K larger than entries', () => {
    store.upsert([makeEntry('a', '/file1.md', [1, 0, 0])]);
    const results = store.search([1, 0, 0], 10);
    expect(results).toHaveLength(1);
  });
});
