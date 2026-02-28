/**
 * Tag Store Operations Benchmark
 *
 * Measures tag management performance including persistence overhead:
 * - Create tags (with localStorage persistence)
 * - Assign tags to files (with localStorage persistence)
 * - Filter/query by tag (read-only, no persistence)
 *
 * Target: < 50ms for read operations, scaled thresholds for writes with persistence.
 *
 * @module scripts/bench-tags
 */

import { runBenchmarkSuite } from './bench-harness';

// =============================================================================
// MOCK ENVIRONMENT
// =============================================================================

const storage: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => {
      storage[key] = value;
    },
    removeItem: (key: string) => {
      Reflect.deleteProperty(storage, key);
    },
    clear: () => {
      for (const key of Object.keys(storage)) {
        Reflect.deleteProperty(storage, key);
      }
    },
  },
});

const { useTagStore, selectTagsByFile, selectFilesWithTag, selectTagTree } =
  await import('../src/renderer/stores/tag-store');

// =============================================================================
// SETUP: pre-populate store for query benchmarks
// =============================================================================

function setupPopulatedStore(): { tagIds: string[] } {
  useTagStore.getState().reset();
  const store = useTagStore.getState();
  const tagIds: string[] = [];
  for (let i = 0; i < 100; i++) {
    tagIds.push(store.addTag(`tag-${i}`, `#${String(i).padStart(6, '0')}`, null));
  }
  // Assign tags to files: 10 tags per file, 100 files
  for (let f = 0; f < 100; f++) {
    for (let t = 0; t < 10; t++) {
      const tagId = tagIds[t];
      if (tagId) store.assignTagToFile(`/path/to/file-${f}.mdx`, tagId);
    }
  }
  return { tagIds };
}

const { tagIds: preloadedTagIds } = setupPopulatedStore();

// =============================================================================
// BENCHMARK
// =============================================================================

runBenchmarkSuite('Tag Store Operations', [
  {
    name: 'Create 100 tags (with persistence)',
    thresholdMs: 50,
    iterations: 20,
    warmupIterations: 3,
    fn: () => {
      useTagStore.getState().reset();
      const store = useTagStore.getState();
      for (let i = 0; i < 100; i++) {
        store.addTag(`tag-${i}`, `#${String(i).padStart(6, '0')}`, null);
      }
    },
  },
  {
    name: 'Assign 10 tags to 50 files (500 assignments with persistence)',
    thresholdMs: 50,
    iterations: 10,
    warmupIterations: 2,
    fn: () => {
      useTagStore.getState().reset();
      const store = useTagStore.getState();
      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        ids.push(store.addTag(`tag-${i}`));
      }
      for (let f = 0; f < 50; f++) {
        for (let t = 0; t < 10; t++) {
          const id = ids[t];
          if (id) store.assignTagToFile(`/path/to/file-${f}.mdx`, id);
        }
      }
    },
  },
  {
    name: 'Query: tags for a specific file (100 tags, 100 files)',
    thresholdMs: 50,
    iterations: 200,
    warmupIterations: 10,
    fn: () => {
      const state = useTagStore.getState();
      selectTagsByFile('/path/to/file-50.mdx')(state);
    },
  },
  {
    name: 'Query: files with a specific tag (100 files)',
    thresholdMs: 50,
    iterations: 200,
    warmupIterations: 10,
    fn: () => {
      const state = useTagStore.getState();
      if (preloadedTagIds[0]) {
        selectFilesWithTag(preloadedTagIds[0])(state);
      }
    },
  },
  {
    name: 'Build tag tree (100 tags, flat)',
    thresholdMs: 50,
    iterations: 100,
    warmupIterations: 10,
    fn: () => {
      const state = useTagStore.getState();
      selectTagTree(state);
    },
  },
]).catch((err: unknown) => {
  console.error('Benchmark suite failed:', err);
  process.exit(1);
});
