import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAG_STORAGE_KEY,
  useFeatureFlagsStore,
} from './feature-flags-store';

describe('useFeatureFlagsStore', () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
    localStorage.removeItem(FEATURE_FLAG_STORAGE_KEY);
    useFeatureFlagsStore.getState().reset();
    useFeatureFlagsStore.getState().hydrate();
  });

  afterEach(() => {
    delete window.__MDXPAD_FEATURE_FLAGS__;
    vi.unstubAllGlobals();
  });

  it('uses safe default feature flags when storage is empty', () => {
    expect(useFeatureFlagsStore.getState().flags).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it('applies partial overrides through setFlags', () => {
    useFeatureFlagsStore.getState().setFlags({ ai: false, export: false });

    expect(useFeatureFlagsStore.getState().flags).toEqual({
      ...DEFAULT_FEATURE_FLAGS,
      ai: false,
      export: false,
    });
  });

  it('persists updates when a single flag changes', () => {
    const persistSpy = vi.spyOn(useFeatureFlagsStore.getState(), 'persist');

    useFeatureFlagsStore.getState().setFlag('workspace', false);

    expect(persistSpy).toHaveBeenCalledTimes(1);
  });

  it('toggles flags and persists the next value', () => {
    const persistSpy = vi.spyOn(useFeatureFlagsStore.getState(), 'persist');
    const previousValue = useFeatureFlagsStore.getState().flags.ai;

    useFeatureFlagsStore.getState().toggleFlag('ai');

    expect(useFeatureFlagsStore.getState().flags.ai).toBe(!previousValue);
    expect(persistSpy).toHaveBeenCalledTimes(1);
  });

  it('supports partial updates through setFlags', () => {
    useFeatureFlagsStore.getState().setFlags({ export: false });

    expect(useFeatureFlagsStore.getState().flags.export).toBe(false);
    expect(useFeatureFlagsStore.getState().flags.ai).toBe(DEFAULT_FEATURE_FLAGS.ai);
  });

  it('prioritizes rollout overrides over persisted flag values on hydrate', () => {
    storage.set(
      FEATURE_FLAG_STORAGE_KEY,
      JSON.stringify({
        ai: true,
      })
    );
    window.__MDXPAD_FEATURE_FLAGS__ = { ai: false };

    useFeatureFlagsStore.getState().hydrate();

    expect(useFeatureFlagsStore.getState().flags.ai).toBe(false);
  });
});
