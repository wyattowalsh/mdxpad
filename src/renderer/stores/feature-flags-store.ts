import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export const FEATURE_FLAG_STORAGE_KEY = 'mdxpad.feature-flags';

export const FEATURE_FLAG_KEYS = ['workspace', 'ai', 'export', 'authoring', 'plugin'] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export interface FeatureFlags {
  workspace: boolean;
  ai: boolean;
  export: boolean;
  authoring: boolean;
  plugin: boolean;
}

interface FeatureFlagsState {
  flags: FeatureFlags;
}

interface FeatureFlagsActions {
  setFlag: (flag: FeatureFlagKey, enabled: boolean) => void;
  setFlags: (flags: Partial<FeatureFlags>) => void;
  toggleFlag: (flag: FeatureFlagKey) => void;
  hydrate: () => void;
  persist: () => void;
  reset: () => void;
}

export type FeatureFlagsStore = FeatureFlagsState & FeatureFlagsActions;

type FeatureFlagsEnv = ImportMetaEnv & {
  readonly VITE_FEATURE_WORKSPACE?: string;
  readonly VITE_FEATURE_AI?: string;
  readonly VITE_FEATURE_EXPORT?: string;
  readonly VITE_FEATURE_AUTHORING?: string;
  readonly VITE_FEATURE_PLUGIN?: string;
};

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return undefined;
}

function sanitizeFlags(value: unknown): Partial<FeatureFlags> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const next: Partial<FeatureFlags> = {};
  for (const key of FEATURE_FLAG_KEYS) {
    const parsed = parseBoolean(record[key]);
    if (parsed !== undefined) {
      next[key] = parsed;
    }
  }
  return next;
}

function readPersistedFlags(): Partial<FeatureFlags> {
  if (typeof localStorage === 'undefined') {
    return {};
  }

  try {
    const raw = localStorage.getItem(FEATURE_FLAG_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    return sanitizeFlags(parsed);
  } catch {
    return {};
  }
}

function getEnvFlagOverrides(): Partial<FeatureFlags> {
  const env = import.meta.env as FeatureFlagsEnv;
  return sanitizeFlags({
    workspace: env.VITE_FEATURE_WORKSPACE,
    ai: env.VITE_FEATURE_AI,
    export: env.VITE_FEATURE_EXPORT,
    authoring: env.VITE_FEATURE_AUTHORING,
    plugin: env.VITE_FEATURE_PLUGIN,
  });
}

function getWindowFlagOverrides(): Partial<FeatureFlags> {
  if (typeof window === 'undefined') {
    return {};
  }

  const maybeFlags = (window as unknown as { __MDXPAD_FEATURE_FLAGS__?: unknown })
    .__MDXPAD_FEATURE_FLAGS__;
  return sanitizeFlags(maybeFlags);
}

function createDefaultFlags(): FeatureFlags {
  const baseEnabled = !import.meta.env.PROD;
  return {
    workspace: baseEnabled,
    ai: baseEnabled,
    export: baseEnabled,
    authoring: baseEnabled,
    plugin: baseEnabled,
    ...getEnvFlagOverrides(),
    ...getWindowFlagOverrides(),
  };
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = createDefaultFlags();

function resolveFlags(): FeatureFlags {
  return {
    ...DEFAULT_FEATURE_FLAGS,
    ...readPersistedFlags(),
    // Rollout overrides stay authoritative over any locally persisted toggles.
    ...getEnvFlagOverrides(),
    ...getWindowFlagOverrides(),
  };
}

export const useFeatureFlagsStore = create<FeatureFlagsStore>()(
  immer((set, get) => ({
    flags: resolveFlags(),

    setFlag: (flag, enabled) => {
      set((draft) => {
        draft.flags[flag] = enabled;
      });
      get().persist();
    },

    setFlags: (flags) => {
      const sanitized = sanitizeFlags(flags);
      set((draft) => {
        draft.flags = {
          ...draft.flags,
          ...sanitized,
        };
      });
      get().persist();
    },

    toggleFlag: (flag) => {
      set((draft) => {
        draft.flags[flag] = !draft.flags[flag];
      });
      get().persist();
    },

    hydrate: () => {
      set((draft) => {
        draft.flags = resolveFlags();
      });
    },

    persist: () => {
      if (typeof localStorage === 'undefined') {
        return;
      }
      try {
        // Strip env-override flags before saving — they should be
        // re-evaluated from the environment on each load, not baked
        // into localStorage where they would survive env changes.
        const envOverrides = getEnvFlagOverrides();
        const flags = Object.fromEntries(
          Object.entries(get().flags).filter(([key]) => !(key in envOverrides))
        );
        localStorage.setItem(FEATURE_FLAG_STORAGE_KEY, JSON.stringify(flags));
      } catch {
        // Ignore localStorage write failures.
      }
    },

    reset: () => {
      set((draft) => {
        draft.flags = { ...DEFAULT_FEATURE_FLAGS };
      });
      get().persist();
    },
  }))
);

export const selectFeatureFlags = (state: FeatureFlagsStore): FeatureFlags => state.flags;

export const selectFeatureFlag =
  (flag: FeatureFlagKey) =>
  (state: FeatureFlagsStore): boolean =>
    state.flags[flag];

export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return useFeatureFlagsStore.getState().flags[flag];
}
