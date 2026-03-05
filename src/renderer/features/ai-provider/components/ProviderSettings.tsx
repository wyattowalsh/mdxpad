/**
 * ProviderSettings Component
 *
 * Main settings panel for AI provider management.
 * Combines provider list, form, and usage statistics.
 *
 * @module src/renderer/features/ai-provider/components/ProviderSettings
 */

import { useState, useCallback, useEffect } from 'react';
import type { ProviderType, SidecarConfig } from '@shared/ai/types';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ui/dialog';
import { Button } from '@ui/button';
import { AlertTriangle } from 'lucide-react';

type ViewMode = 'list' | 'add' | 'edit';

export function ProviderSettings() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  // Initialize providers on mount
  useInitializeAIProviders();

  // Store state
  const {
    providers,
    activeProviderId,
    isLoading,
    isSidecarLoading,
    sidecarStatus,
    error,
    addProvider,
    updateProvider,
    removeProvider,
    setActiveProvider,
    fetchSidecarStatus,
    configureSidecar,
    startSidecar,
    stopSidecar,
    clearError,
  } = useAIProvider();

  const { selectedProvider, select } = useProviderSettings();
  const { stats, timeRange, refresh: refreshStats } = useUsageStats();
  const { isValidating, validate } = useProviderValidation();

  // Fetch usage stats on mount
  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    if (selectedProvider?.type === 'sidecar') {
      void fetchSidecarStatus();
    }
  }, [fetchSidecarStatus, selectedProvider?.id, selectedProvider?.type]);

  // Handle add provider
  const handleAdd = useCallback(
    async (
      config: {
        displayName: string;
        type: ProviderType;
        baseUrl?: string;
        sidecarConfig?: SidecarConfig;
      },
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
      config: {
        displayName: string;
        type: ProviderType;
        baseUrl?: string;
        sidecarConfig?: SidecarConfig;
      },
      _apiKey?: string
    ) => {
      if (!selectedProvider) return;

      const updates: {
        displayName?: string;
        baseUrl?: string;
        sidecarConfig?: SidecarConfig;
      } = {
        displayName: config.displayName,
      };

      if (config.baseUrl !== undefined) {
        updates.baseUrl = config.baseUrl;
      }

      if (config.sidecarConfig !== undefined) {
        updates.sidecarConfig = config.sidecarConfig;
      }

      await updateProvider(selectedProvider.id, updates);
      setViewMode('list');
      select(null);
    },
    [selectedProvider, updateProvider, select]
  );

  // Handle remove provider request
  const handleRemoveRequest = useCallback(() => {
    if (!selectedProvider) return;
    setIsRemoveDialogOpen(true);
  }, [selectedProvider]);

  // Handle remove confirm
  const handleRemoveConfirm = useCallback(async () => {
    if (!selectedProvider) return;
    await removeProvider(selectedProvider.id);
    setIsRemoveDialogOpen(false);
    setViewMode('list');
    select(null);
  }, [selectedProvider, removeProvider, select]);

  // Handle remove cancel
  const handleRemoveCancel = useCallback(() => {
    setIsRemoveDialogOpen(false);
  }, []);

  // Handle validate provider
  const handleValidate = useCallback(async () => {
    if (!selectedProvider) return;
    await validate(selectedProvider.id);
  }, [selectedProvider, validate]);

  const handleSidecarConfigure = useCallback(async () => {
    if (selectedProvider?.type !== 'sidecar' || !selectedProvider.sidecarConfig) {
      return;
    }
    await configureSidecar(selectedProvider.sidecarConfig);
  }, [configureSidecar, selectedProvider]);

  const handleSidecarStart = useCallback(async () => {
    if (selectedProvider?.type !== 'sidecar') {
      return;
    }
    await startSidecar(selectedProvider.sidecarConfig);
  }, [selectedProvider, startSidecar]);

  const handleSidecarStop = useCallback(async () => {
    if (selectedProvider?.type !== 'sidecar') {
      return;
    }
    await stopSidecar();
  }, [selectedProvider, stopSidecar]);

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
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI Providers</h2>
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
                onSetActive={(id) => void setActiveProvider(id)}
                isLoading={isLoading}
              />
            </div>

            {/* Usage stats */}
            <div className="p-4">
              <UsageStats
                stats={stats}
                timeRange={timeRange}
                onTimeRangeChange={(range) => void refreshStats(range)}
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

                {selectedProvider.type === 'sidecar' && (
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Sidecar Runtime Status:{' '}
                        <span className="font-medium capitalize">
                          {sidecarStatus?.status ?? 'unknown'}
                        </span>
                      </p>
                      <button
                        onClick={() => void fetchSidecarStatus()}
                        disabled={isSidecarLoading}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                      >
                        Refresh
                      </button>
                    </div>
                    {sidecarStatus?.endpoint && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Endpoint: {sidecarStatus.endpoint}
                      </p>
                    )}
                    {sidecarStatus?.error?.message && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {sidecarStatus.error.message}
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        onClick={() => void handleSidecarConfigure()}
                        disabled={isSidecarLoading || !selectedProvider.sidecarConfig}
                        className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        Apply Config
                      </button>
                      <button
                        onClick={() => void handleSidecarStart()}
                        disabled={
                          isSidecarLoading ||
                          sidecarStatus?.status === 'running' ||
                          sidecarStatus?.status === 'starting'
                        }
                        className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        Start Runtime
                      </button>
                      <button
                        onClick={() => void handleSidecarStop()}
                        disabled={
                          isSidecarLoading ||
                          sidecarStatus?.status === 'stopped' ||
                          sidecarStatus?.status === 'stopping'
                        }
                        className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        Stop Runtime
                      </button>
                    </div>
                  </div>
                )}

                {/* Additional actions */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  <button
                    onClick={() => void handleValidate()}
                    disabled={isValidating}
                    className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {isValidating ? 'Validating...' : 'Test Connection'}
                  </button>
                  <button
                    onClick={handleRemoveRequest}
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

      {/* Remove Confirmation Dialog */}
      <Dialog open={isRemoveDialogOpen} onOpenChange={(open) => !open && handleRemoveCancel()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              Remove Provider
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-semibold text-foreground">
                &ldquo;{selectedProvider?.displayName}&rdquo;
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleRemoveCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleRemoveConfirm()}
              disabled={isLoading}
            >
              {isLoading ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
