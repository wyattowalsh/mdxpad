/**
 * Keybinding Conflict Detection Benchmark
 *
 * Measures keybinding operations:
 * - Initialize 200 custom bindings
 * - Detect conflicts across all bindings
 *
 * Target: < 10ms for conflict detection.
 *
 * @module scripts/bench-keybindings
 */

import { runBenchmarkSuite } from './bench-harness';
import type { Keybinding, Modifier } from '../src/renderer/stores/keybinding-store';

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

const { useKeybindingStore, normalizeKeybinding } =
  await import('../src/renderer/stores/keybinding-store');

// =============================================================================
// TEST DATA
// =============================================================================

const BINDING_COUNT = 200;

const KEYS = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
const MODIFIER_COMBOS: Modifier[][] = [
  ['Mod'],
  ['Mod', 'Shift'],
  ['Mod', 'Alt'],
  ['Ctrl', 'Shift'],
  ['Alt'],
  ['Meta', 'Shift'],
];
const CATEGORIES = ['editing', 'navigation', 'file', 'view', 'tools', 'debug'];

function generateBindings(count: number): Keybinding[] {
  const bindings: Keybinding[] = [];
  for (let i = 0; i < count; i++) {
    const key = KEYS[i % KEYS.length] ?? 'a';
    const modifiers = MODIFIER_COMBOS[i % MODIFIER_COMBOS.length] ?? ['Mod'];
    const category = CATEGORIES[i % CATEGORIES.length] ?? 'editing';
    bindings.push({
      commandId: `cmd-${i}`,
      key,
      modifiers: [...modifiers],
      label: `Command ${i}`,
      category,
    });
  }
  return bindings;
}

/**
 * Generate bindings with intentional conflicts (same key+modifiers, different commands).
 */
function generateBindingsWithConflicts(count: number, conflictRate: number): Keybinding[] {
  const bindings = generateBindings(count);
  const conflictCount = Math.floor(count * conflictRate);

  for (let i = 0; i < conflictCount; i++) {
    const sourceIdx = i % bindings.length;
    const source = bindings[sourceIdx];
    if (!source) continue;
    // Duplicate key+modifiers with different commandId
    bindings.push({
      commandId: `conflict-cmd-${i}`,
      key: source.key,
      modifiers: [...source.modifiers],
      label: `Conflict Command ${i}`,
      category: source.category,
    });
  }

  return bindings;
}

const defaultBindings = generateBindings(BINDING_COUNT);
const conflictBindings = generateBindingsWithConflicts(BINDING_COUNT, 0.1); // 10% conflicts

// =============================================================================
// BENCHMARK
// =============================================================================

// Setup the store with bindings for conflict detection tests
useKeybindingStore.getState().initDefaults(defaultBindings);

runBenchmarkSuite('Keybinding Conflict Detection', [
  {
    name: `Initialize ${BINDING_COUNT} default bindings`,
    thresholdMs: 10,
    iterations: 100,
    warmupIterations: 10,
    fn: () => {
      useKeybindingStore.getState().resetAll();
      useKeybindingStore.getState().initDefaults(defaultBindings);
    },
  },
  {
    name: `Detect conflicts across ${BINDING_COUNT} bindings (no conflicts)`,
    thresholdMs: 10,
    iterations: 200,
    warmupIterations: 10,
    fn: () => {
      useKeybindingStore.getState().detectConflicts();
    },
  },
  {
    name: `Detect conflicts across ${conflictBindings.length} bindings (10% conflict rate)`,
    thresholdMs: 10,
    iterations: 200,
    warmupIterations: 10,
    fn: () => {
      // Load conflict-inducing bindings
      useKeybindingStore.getState().importBindings(conflictBindings);
      useKeybindingStore.getState().detectConflicts();
    },
  },
  {
    name: `normalizeKeybinding x ${BINDING_COUNT}`,
    thresholdMs: 10,
    iterations: 200,
    warmupIterations: 10,
    fn: () => {
      for (const binding of defaultBindings) {
        normalizeKeybinding(binding.key, binding.modifiers);
      }
    },
  },
  {
    name: `Set binding (rebind) x 50 (with persistence)`,
    thresholdMs: 10,
    iterations: 50,
    warmupIterations: 5,
    fn: () => {
      useKeybindingStore.getState().initDefaults(defaultBindings);
      const store = useKeybindingStore.getState();
      for (let i = 0; i < 50; i++) {
        store.setBinding(`cmd-${i}`, 'z', ['Mod', 'Shift']);
      }
    },
  },
]).catch((err: unknown) => {
  console.error('Benchmark suite failed:', err);
  process.exit(1);
});
