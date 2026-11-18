/**
 * Remember a derived list until the values it was built from change.
 * React 19 loops when a store selector returns a new array every read.
 */

const UNSET = Symbol('unset-selector-cache');

export interface SelectorCache<T> {
  parts: readonly unknown[];
  value: T;
}

export function createSelectorCache<T>(value: T): SelectorCache<T> {
  return { parts: [UNSET], value };
}

export function cachedWhen<T>(
  cache: SelectorCache<T>,
  parts: readonly unknown[],
  compute: () => T
): T {
  if (
    cache.parts.length === parts.length &&
    cache.parts.every((part, index) => part === parts[index])
  ) {
    return cache.value;
  }
  const value = compute();
  cache.parts = parts;
  cache.value = value;
  return value;
}
