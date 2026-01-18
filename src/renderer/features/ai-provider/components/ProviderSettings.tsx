/**
 * ProviderSettings Component
 *
 * Main settings panel for AI provider management.
 * Combines provider list, form, and usage statistics.
 *
 * @module src/renderer/features/ai-provider/components/ProviderSettings
 */

import { useState, useCallback, useEffect } from 'react';
import type { ProviderType } from '@shared/ai/types';
import {
  useAIProvider,
  useProviderSettings,
  useUsageStats,
  useProviderValidation,
  useInitializeAIProviders,
} from '../hooks';
import { ProviderList } from './ProviderList';
import { ProviderForm } from './ProviderForm';
import { UsageStats } from './UsageStats';

type ViewMode = 'list' | 'add' | 'edit';

export function ProviderSettings() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Initialize providers on mount
  useInitializeAIProviders();

  // Store state
  const {
    providers,
    activeProviderId,
    isLoading,
    error,
    addProvider,
    updateProvider,
    removeProvider,
    setActiveProvider,
    clearError,
  } = useAIProvider();

  const { selectedProvider, select } = useProviderSettings();
  const { stats, timeRange, refresh: refreshStats } = useUsageStats();
  const { isValidating, validate } = useProviderValidation();

  // Fetch usage stats on mount
  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  // Handle add provider
  const handleAdd = useCallback(
    async (
      config: { displayName: string; type: ProviderType; baseUrl?: string },
      apiKey?: string
    ) => {
      await addProvider(config, apiKey);
      setViewMode('list');
    },
    [addProvider]
  );

  // Handle update provider
  const handleUpdate = useCallback(
    async (
      config: { displayName: string; type: ProviderType; baseUrl?: string },
      _apiKey?: string
    ) => {
      if (!selectedProvider) return;

      const updates: { displayName?: string; baseUrl?: string } = {
        displayName: config.displayName,
      };

      if (config.baseUrl !== undefined) {
        updates.baseUrl = config.baseUrl;
      }

      await updateProvider(selectedProvider.id, updates);
      setViewMode('list');
      select(null);
    },
    [selectedProvider, updateProvider, select]
  );

  // Handle remove provider
  const handleRemove = useCallback(async () => {
    if (!selectedProvider) return;
    if (confirm(`Remove provider "${selectedProvider.displayName}"?`)) {
      await removeProvider(selectedProvider.id);
      setViewMode('list');
      select(null);
    }
  }, [selectedProvider, removeProvider, select]);

  // Handle validate provider
  const handleValidate = useCallback(async () => {
    if (!selectedProvider) return;
    await validate(selectedProvider.id);
  }, [selectedProvider, validate]);

  // Handle select provider
  const handleSelectProvider = useCallback(
    (id: string) => {
      select(id);
      setViewMode('edit');
    },
    [select]
  );

  // Handle cancel form
  const handleCancel = useCallback(() => {
    setViewMode('list');
    select(null);
    clearError();
  }, [select, clearError]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          AI Providers
        </h2>
        {viewMode === 'list' && (
          <button
            onClick={() => setViewMode('add')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            + Add Provider
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'list' ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {/* Provider list */}
            <div className="py-2">
              <ProviderList
                providers={providers}
                activeProviderId={activeProviderId}
                selectedProviderId={selectedProvider?.id ?? null}
                onSelect={handleSelectProvider}
                onSetActive={setActiveProvider}
                isLoading={isLoading}
              />
            </div>

            {/* Usage stats */}
            <div className="p-4">
              <UsageStats
                stats={stats}
                timeRange={timeRange}
                onTimeRangeChange={refreshStats}
                isLoading={isLoading}
              />
            </div>
          </div>
        ) : viewMode === 'add' ? (
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
              Add New Provider
            </h3>
            <ProviderForm
              onSubmit={handleAdd}
              onCancel={handleCancel}
              isLoading={isLoading}
              error={error}
            />
          </div>
        ) : (
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
              Edit Provider
            </h3>
            {selectedProvider && (
              <>
                <ProviderForm
                  provider={selectedProvider}
                  onSubmit={handleUpdate}
                  onCancel={handleCancel}
                  isLoading={isLoading}
                  error={error}
                />

                {/* Additional actions */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  <button
                    onClick={handleValidate}
                    disabled={isValidating}
                    className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {isValidating ? 'Validating...' : 'Test Connection'}
                  </button>
                  <button
                    onClick={handleRemove}
                    disabled={isLoading}
                    className="w-full px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                  >
                    Remove Provider
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
