/**
 * Version History Store Benchmark
 *
 * Measures version history operations:
 * - Load history entries (bulk)
 * - Add entries one at a time (with Immer overhead)
 * - Query/select operations
 *
 * Target: < 100ms for bulk and query operations.
 *
 * @module scripts/bench-version-history
 */

import { runBenchmarkSuite } from './bench-harness';
import type { VersionEntry, VersionSource } from '../src/shared/contracts/history-schemas';

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

const { useVersionHistoryStore, selectEntries, selectSelectedEntry, selectEntriesBySource } =
  await import('../src/renderer/stores/version-history-store');

// =============================================================================
// TEST DATA
// =============================================================================

const SOURCES: VersionSource[] = ['autosave', 'manual', 'git'];

function generateEntries(count: number): VersionEntry[] {
  const entries: VersionEntry[] = [];
  const baseTime = Date.now();

  for (let i = 0; i < count; i++) {
    entries.push({
      id: `version-${i}`,
      timestamp: baseTime - i * 60000,
      source: SOURCES[i % SOURCES.length] ?? 'manual',
      label: i % 5 === 0 ? `Snapshot ${i}` : undefined,
      diff: i % 3 === 0 ? `@@ -1,3 +1,4 @@\n+line ${i}` : undefined,
    });
  }

  return entries;
}

const entries1000 = generateEntries(1000);
const entries100 = generateEntries(100);

// Pre-populate for query benchmarks
useVersionHistoryStore.getState().loadHistory(entries1000, '/test/file.mdx');

// =============================================================================
// BENCHMARK
// =============================================================================

runBenchmarkSuite('Version History Store', [
  {
    name: 'Load 1000 history entries (bulk)',
    thresholdMs: 100,
    iterations: 50,
    warmupIterations: 5,
    fn: () => {
      useVersionHistoryStore.getState().reset();
      useVersionHistoryStore.getState().loadHistory(entries1000, '/test/file.mdx');
    },
  },
  {
    name: 'Add 100 entries one at a time',
    thresholdMs: 100,
    iterations: 20,
    warmupIterations: 3,
    fn: () => {
      useVersionHistoryStore.getState().reset();
      const store = useVersionHistoryStore.getState();
      for (const entry of entries100) {
        store.addEntry(entry);
      }
    },
  },
  {
    name: 'Select all entries (1000 loaded)',
    thresholdMs: 100,
    iterations: 200,
    warmupIterations: 10,
    fn: () => {
      const state = useVersionHistoryStore.getState();
      selectEntries(state);
    },
  },
  {
    name: 'Select entry by ID (1000 loaded)',
    thresholdMs: 100,
    iterations: 200,
    warmupIterations: 10,
    fn: () => {
      useVersionHistoryStore.getState().selectEntry('version-500');
      const state = useVersionHistoryStore.getState();
      selectSelectedEntry(state);
    },
  },
  {
    name: 'Filter entries by source (1000 loaded)',
    thresholdMs: 100,
    iterations: 200,
    warmupIterations: 10,
    fn: () => {
      const state = useVersionHistoryStore.getState();
      selectEntriesBySource(state, 'manual');
    },
  },
]).catch((err: unknown) => {
  console.error('Benchmark suite failed:', err);
  process.exit(1);
});
