/**
 * AI Provider React Hooks
 *
 * Custom hooks for AI provider management in React components.
 * These hooks wrap the Zustand store and provide convenient interfaces
 * for common AI provider operations.
 *
 * @module src/renderer/features/ai-provider/hooks
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ProviderType, TimeRange } from '@shared/ai/types';
import {
  useAIProviderStore,
  selectActiveProvider,
  selectSelectedProvider,
  selectConnectedProviders,
} from './store';

// =============================================================================
// PROVIDER MANAGEMENT HOOKS
// =============================================================================

/**
 * Hook for accessing the full AI provider state and actions.
 * Use more specific hooks when possible to minimize re-renders.
 */
export function useAIProvider() {
  return useAIProviderStore(
    useShallow((state) => ({
      providers: state.providers,
      activeProviderId: state.activeProviderId,
      isLoading: state.isLoading,
      isValidating: state.isValidating,
      error: state.error,
      fetchProviders: state.fetchProviders,
      addProvider: state.addProvider,
      updateProvider: state.updateProvider,
      removeProvider: state.removeProvider,
      setActiveProvider: state.setActiveProvider,
      validateProvider: state.validateProvider,
      clearError: state.clearError,
    }))
  );
}

/**
 * Hook for accessing the currently active provider.
 * Returns null if no provider is active.
 */
export function useActiveProvider() {
  const activeProvider = useAIProviderStore(selectActiveProvider);
  const setActiveProvider = useAIProviderStore((state) => state.setActiveProvider);

  return {
    activeProvider,
    setActiveProvider,
  };
}

/**
 * Hook for accessing connected providers only.
 */
export function useConnectedProviders() {
  return useAIProviderStore(
    useShallow((state) => state.providers.filter((p) => p.status === 'connected'))
  );
}

/**
 * Hook for provider validation with loading state.
 */
export function useProviderValidation() {
  const isValidating = useAIProviderStore((state) => state.isValidating);
  const validateProvider = useAIProviderStore((state) => state.validateProvider);

  const validate = useCallback(
    async (providerId: string): Promise<boolean> => {
      return validateProvider(providerId);
    },
    [validateProvider]
  );

  return {
    isValidating,
    validate,
  };
}

// =============================================================================
// PROVIDER CRUD HOOKS
// =============================================================================

/**
 * Hook for adding a new provider.
 */
export function useAddProvider() {
  const isLoading = useAIProviderStore((state) => state.isLoading);
  const error = useAIProviderStore((state) => state.error);
  const addProvider = useAIProviderStore((state) => state.addProvider);
  const clearError = useAIProviderStore((state) => state.clearError);

  const add = useCallback(
    async (
      config: {
        displayName: string;
        type: ProviderType;
        baseUrl?: string;
      },
      apiKey?: string
    ): Promise<void> => {
      await addProvider(config, apiKey);
    },
    [addProvider]
  );

  return {
    isLoading,
    error,
    add,
    clearError,
  };
}

/**
 * Hook for updating an existing provider.
 */
export function useUpdateProvider() {
  const isLoading = useAIProviderStore((state) => state.isLoading);
  const error = useAIProviderStore((state) => state.error);
  const updateProvider = useAIProviderStore((state) => state.updateProvider);
  const clearError = useAIProviderStore((state) => state.clearError);

  const update = useCallback(
    async (
      id: string,
      updates: { displayName?: string; baseUrl?: string }
    ): Promise<void> => {
      await updateProvider(id, updates);
    },
    [updateProvider]
  );

  return {
    isLoading,
    error,
    update,
    clearError,
  };
}

/**
 * Hook for removing a provider.
 */
export function useRemoveProvider() {
  const isLoading = useAIProviderStore((state) => state.isLoading);
  const error = useAIProviderStore((state) => state.error);
  const removeProvider = useAIProviderStore((state) => state.removeProvider);
  const clearError = useAIProviderStore((state) => state.clearError);

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await removeProvider(id);
    },
    [removeProvider]
  );

  return {
    isLoading,
    error,
    remove,
    clearError,
  };
}

// =============================================================================
// USAGE STATISTICS HOOKS
// =============================================================================

/**
 * Hook for accessing usage statistics.
 */
export function useUsageStats() {
  const usageStats = useAIProviderStore((state) => state.usageStats);
  const usageStatsTimeRange = useAIProviderStore((state) => state.usageStatsTimeRange);
  const isLoading = useAIProviderStore((state) => state.isLoading);
  const fetchUsageStats = useAIProviderStore((state) => state.fetchUsageStats);

  const refresh = useCallback(
    async (timeRange?: TimeRange): Promise<void> => {
      await fetchUsageStats(timeRange ?? usageStatsTimeRange);
    },
    [fetchUsageStats, usageStatsTimeRange]
  );

  return {
    stats: usageStats,
    timeRange: usageStatsTimeRange,
    isLoading,
    refresh,
  };
}

// =============================================================================
// UI STATE HOOKS
// =============================================================================

/**
 * Hook for managing provider settings UI state.
 */
export function useProviderSettings() {
  const settingsOpen = useAIProviderStore((state) => state.settingsOpen);
  const selectedProvider = useAIProviderStore(selectSelectedProvider);
  const openSettings = useAIProviderStore((state) => state.openSettings);
  const closeSettings = useAIProviderStore((state) => state.closeSettings);
  const selectProvider = useAIProviderStore((state) => state.selectProvider);

  return {
    isOpen: settingsOpen,
    selectedProvider,
    open: openSettings,
    close: closeSettings,
    select: selectProvider,
  };
}

// =============================================================================
// CAPABILITY HOOKS
// =============================================================================

/**
 * Hook for accessing provider capabilities.
 * Fetches capabilities for the specified provider and model.
 * Note: Capabilities are fetched via the main process API.
 */
export function useProviderCapabilities(providerId: string | null, _modelId?: string) {
  const provider = useAIProviderStore((state) =>
    state.providers.find((p) => p.id === providerId)
  );

  // Capabilities would be fetched via the AI API
  // This hook provides access to the provider for capability queries
  const capabilities = useMemo(() => {
    if (!provider) {
      return null;
    }

    return {
      providerId: provider.id,
      providerType: provider.type,
      status: provider.status,
    };
  }, [provider]);

  return capabilities;
}

// =============================================================================
// INITIALIZATION HOOKS
// =============================================================================

/**
 * Hook for initializing the AI provider store.
 * Call this in your app's root component or provider settings component.
 */
export function useInitializeAIProviders() {
  const fetchProviders = useAIProviderStore((state) => state.fetchProviders);
  const isLoading = useAIProviderStore((state) => state.isLoading);
  const providers = useAIProviderStore((state) => state.providers);

  useEffect(() => {
    // Only fetch if we haven't loaded providers yet
    if (providers.length === 0 && !isLoading) {
      void fetchProviders();
    }
  }, [fetchProviders, isLoading, providers.length]);

  return {
    isInitialized: providers.length > 0 || !isLoading,
    isLoading,
  };
}

// =============================================================================
// DERIVED STATE HOOKS
// =============================================================================

/**
 * Hook for checking if any provider is configured and connected.
 */
export function useHasConnectedProvider() {
  return useAIProviderStore((state) =>
    state.providers.some((p) => p.status === 'connected')
  );
}

/**
 * Hook for getting provider by ID.
 */
export function useProviderById(providerId: string | null) {
  return useAIProviderStore((state) =>
    providerId ? state.providers.find((p) => p.id === providerId) ?? null : null
  );
}

/**
 * Hook for getting providers by type.
 */
export function useProvidersByType(type: ProviderType) {
  return useAIProviderStore((state) =>
    state.providers.filter((p) => p.type === type)
  );
}
