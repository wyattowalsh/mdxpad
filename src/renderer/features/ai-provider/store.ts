/**
 * AI Provider Zustand Store
 *
 * State management for AI provider configuration and UI state.
 * Communicates with main process via IPC through window.mdxpad.ai API.
 *
 * @module src/renderer/features/ai-provider/store
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  ProviderConfig,
  ProviderType,
  TimeRange,
  UsageStats,
} from '@shared/ai/types';

// =============================================================================
// WINDOW TYPE DECLARATION
// =============================================================================

// =============================================================================
// STORE STATE INTERFACE
// =============================================================================

/**
 * AI provider state for the renderer process.
 */
export interface AIProviderState {
  /** Provider list (synced from main process) */
  providers: ProviderConfig[];

  /** Currently active provider ID */
  activeProviderId: string | null;

  /** Loading states */
  isLoading: boolean;
  isValidating: boolean;

  /** UI state */
  settingsOpen: boolean;
  selectedProviderId: string | null;

  /** Usage stats (fetched on demand) */
  usageStats: UsageStats | null;
  usageStatsTimeRange: TimeRange;

  /** Error state */
  error: string | null;
}

/**
 * AI provider actions for the renderer process.
 */
export interface AIProviderActions {
  /** Fetch all providers from main process */
  fetchProviders: () => Promise<void>;

  /** Add a new provider */
  addProvider: (
    config: {
      displayName: string;
      type: ProviderType;
      baseUrl?: string;
    },
    apiKey?: string
  ) => Promise<void>;

  /** Update an existing provider */
  updateProvider: (
    id: string,
    updates: { displayName?: string; baseUrl?: string }
  ) => Promise<void>;

  /** Remove a provider */
  removeProvider: (id: string) => Promise<void>;

  /** Set the active provider */
  setActiveProvider: (id: string) => Promise<void>;

  /** Validate a provider's connection */
  validateProvider: (id: string) => Promise<boolean>;

  /** Fetch usage statistics */
  fetchUsageStats: (timeRange: TimeRange) => Promise<void>;

  /** UI actions */
  openSettings: () => void;
  closeSettings: () => void;
  selectProvider: (id: string | null) => void;
  clearError: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get the AI API from window.mdxpad.
 */
function getAIApi() {
  return window.mdxpad.ai;
}

/**
 * Normalize provider config from IPC response to ensure optional fields are properly typed.
 * This converts null values to undefined for optional fields.
 *
 * @param provider - Provider config from IPC
 * @returns Normalized provider config
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeProviderConfig(provider: any): ProviderConfig {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result: ProviderConfig = {
    ...provider,
  };

  // Handle optional fields - only include if they have values
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (provider.baseUrl) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    result.baseUrl = provider.baseUrl;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (provider.lastConnectedAt) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    result.lastConnectedAt = provider.lastConnectedAt;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (provider.errorMessage) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    result.errorMessage = provider.errorMessage;
  }

  return result;
}

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

/**
 * AI Provider store with immer middleware for immutable updates.
 */
export const useAIProviderStore = create<AIProviderState & AIProviderActions>()(
  immer((set) => ({
    // =========================================================================
    // Initial State
    // =========================================================================
    providers: [],
    activeProviderId: null,
    isLoading: false,
    isValidating: false,
    settingsOpen: false,
    selectedProviderId: null,
    usageStats: null,
    usageStatsTimeRange: 'week',
    error: null,

    // =========================================================================
    // Provider Management Actions
    // =========================================================================

    fetchProviders: async () => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const result = await getAIApi().listProviders();
        const providers = result.providers.map((p) => normalizeProviderConfig(p));
        const activeProviderId = result.activeProviderId;
        set((state) => {
          state.providers = providers;
          state.activeProviderId = activeProviderId;
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.isLoading = false;
          state.error = error instanceof Error ? error.message : 'Failed to fetch providers';
        });
      }
    },

    addProvider: async (config, apiKey) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const result = await getAIApi().addProvider({
          displayName: config.displayName,
          type: config.type,
          baseUrl: config.baseUrl,
          apiKey,
        });

        if (result.success && result.provider) {
          const provider = normalizeProviderConfig(result.provider);
          set((state) => {
            state.providers.push(provider);
            state.isLoading = false;
          });
        } else if (result.error) {
          const errorMessage = result.error.message;
          set((state) => {
            state.isLoading = false;
            state.error = errorMessage;
          });
          throw new Error(errorMessage);
        }
      } catch (error) {
        set((state) => {
          state.isLoading = false;
          state.error = error instanceof Error ? error.message : 'Failed to add provider';
        });
        throw error;
      }
    },

    updateProvider: async (id, updates) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const result = await getAIApi().updateProvider({ id, updates });

        if (result.success && result.provider) {
          const provider = normalizeProviderConfig(result.provider);
          set((state) => {
            const index = state.providers.findIndex((p) => p.id === id);
            if (index !== -1) {
              state.providers[index] = provider;
            }
            state.isLoading = false;
          });
        } else if (result.error) {
          const errorMessage = result.error.message;
          set((state) => {
            state.isLoading = false;
            state.error = errorMessage;
          });
          throw new Error(errorMessage);
        }
      } catch (error) {
        set((state) => {
          state.isLoading = false;
          state.error = error instanceof Error ? error.message : 'Failed to update provider';
        });
        throw error;
      }
    },

    removeProvider: async (id) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const result = await getAIApi().removeProvider(id);

        if (result.success) {
          set((state) => {
            state.providers = state.providers.filter((p) => p.id !== id);
            if (state.activeProviderId === id) {
              state.activeProviderId = null;
            }
            if (state.selectedProviderId === id) {
              state.selectedProviderId = null;
            }
            state.isLoading = false;
          });
        } else if (result.error) {
          const errorMessage = result.error.message;
          set((state) => {
            state.isLoading = false;
            state.error = errorMessage;
          });
          throw new Error(errorMessage);
        }
      } catch (error) {
        set((state) => {
          state.isLoading = false;
          state.error = error instanceof Error ? error.message : 'Failed to remove provider';
        });
        throw error;
      }
    },

    setActiveProvider: async (id) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const result = await getAIApi().setActiveProvider(id);

        if (result.success) {
          const activeProviderId = result.activeProviderId ?? id;
          set((state) => {
            // Update all providers to reflect new active state
            state.providers.forEach((p) => {
              p.isActive = p.id === id;
            });
            state.activeProviderId = activeProviderId;
            state.isLoading = false;
          });
        } else if (result.error) {
          const errorMessage = result.error.message;
          set((state) => {
            state.isLoading = false;
            state.error = errorMessage;
          });
          throw new Error(errorMessage);
        }
      } catch (error) {
        set((state) => {
          state.isLoading = false;
          state.error = error instanceof Error ? error.message : 'Failed to set active provider';
        });
        throw error;
      }
    },

    validateProvider: async (id) => {
      set((state) => {
        state.isValidating = true;
        state.error = null;
      });

      try {
        const result = await getAIApi().validateProvider(id);

        set((state) => {
          const provider = state.providers.find((p) => p.id === id);
          if (provider) {
            provider.status = result.status;
            if (result.success) {
              provider.lastConnectedAt = new Date().toISOString();
              // Delete the property instead of setting to undefined
              delete (provider as Partial<ProviderConfig>).errorMessage;
            } else if (result.error) {
              provider.errorMessage = result.error.message;
            }
          }
          state.isValidating = false;
        });

        return result.success;
      } catch (error) {
        set((state) => {
          // Set provider error state on validation failure
          const provider = state.providers.find((p) => p.id === id);
          if (provider) {
            provider.status = 'error';
            provider.errorMessage = error instanceof Error ? error.message : 'Failed to validate provider';
          }
          state.isValidating = false;
          state.error = error instanceof Error ? error.message : 'Failed to validate provider';
        });
        return false;
      }
    },

    // =========================================================================
    // Usage Statistics Actions
    // =========================================================================

    fetchUsageStats: async (timeRange) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const result = await getAIApi().queryUsage({ timeRange });

        if (result.success && result.stats) {
          const stats = result.stats;
          // Compute avg duration from operation stats
          const avgDurationMs =
            stats.byOperation.length > 0
              ? stats.byOperation.reduce((sum, op) => sum + op.avgDurationMs, 0) /
                stats.byOperation.length
              : 0;

          const usageStats = {
            timeRange,
            totalRequests: stats.totalRequests,
            successfulRequests: stats.successfulRequests,
            failedRequests: stats.failedRequests,
            totalTokens: stats.totalTokens,
            inputTokens: stats.inputTokens,
            outputTokens: stats.outputTokens,
            estimatedCostUsd: stats.estimatedCostUsd,
            avgDurationMs,
            byProvider: {},
            byModel: {},
          };

          set((state) => {
            state.usageStats = usageStats;
            state.usageStatsTimeRange = timeRange;
            state.isLoading = false;
          });
        } else {
          set((state) => {
            state.isLoading = false;
          });
        }
      } catch (error) {
        set((state) => {
          state.isLoading = false;
          state.error = error instanceof Error ? error.message : 'Failed to fetch usage stats';
        });
      }
    },

    // =========================================================================
    // UI State Actions
    // =========================================================================

    openSettings: () => {
      set((state) => {
        state.settingsOpen = true;
      });
    },

    closeSettings: () => {
      set((state) => {
        state.settingsOpen = false;
        state.selectedProviderId = null;
      });
    },

    selectProvider: (id) => {
      set((state) => {
        state.selectedProviderId = id;
      });
    },

    clearError: () => {
      set((state) => {
        state.error = null;
      });
    },
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Get the currently active provider.
 */
export function selectActiveProvider(state: AIProviderState): ProviderConfig | null {
  return state.providers.find((p) => p.id === state.activeProviderId) ?? null;
}

/**
 * Get the currently selected provider (for editing).
 */
export function selectSelectedProvider(state: AIProviderState): ProviderConfig | null {
  return state.providers.find((p) => p.id === state.selectedProviderId) ?? null;
}

/**
 * Get connected providers.
 */
export function selectConnectedProviders(state: AIProviderState): ProviderConfig[] {
  return state.providers.filter((p) => p.status === 'connected');
}
