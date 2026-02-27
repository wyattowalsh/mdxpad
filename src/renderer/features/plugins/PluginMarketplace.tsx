/**
 * PluginMarketplace Component
 *
 * Browse and manage plugins: installed list, marketplace, enable/disable.
 *
 * @module renderer/features/plugins/PluginMarketplace
 */

import { useCallback, useEffect, useState } from 'react';

import type { PluginRecord } from '@shared/contracts/plugin-schemas';

import { usePluginStore } from './plugin-store';
import { InstalledPluginCard, MarketplacePluginCard } from './PluginCard';

// ============================================================================
// Types
// ============================================================================

type TabId = 'installed' | 'marketplace';

interface PluginApiShape {
  list: () => Promise<{ plugins: PluginRecord[] }>;
  install: (path: string) => Promise<{ ok: boolean; plugin?: PluginRecord }>;
  uninstall: (id: string) => Promise<{ ok: boolean }>;
  enable: (id: string) => Promise<{ ok: boolean; plugin?: PluginRecord }>;
  disable: (id: string) => Promise<{ ok: boolean; plugin?: PluginRecord }>;
}

function getPluginApi(): PluginApiShape | undefined {
  const win = globalThis as Record<string, unknown>;
  const mdxpad = win['mdxpad'] as Record<string, unknown> | undefined;
  return mdxpad?.['plugin'] as PluginApiShape | undefined;
}

// ============================================================================
// Component
// ============================================================================

export function PluginMarketplace() {
  const [activeTab, setActiveTab] = useState<TabId>('installed');
  const plugins = usePluginStore((s) => s.plugins);
  const marketplace = usePluginStore((s) => s.marketplace);
  const isLoading = usePluginStore((s) => s.isLoading);
  const error = usePluginStore((s) => s.error);
  const setPlugins = usePluginStore((s) => s.setPlugins);
  const setLoading = usePluginStore((s) => s.setLoading);
  const setError = usePluginStore((s) => s.setError);
  const updatePlugin = usePluginStore((s) => s.updatePlugin);
  const removePlugin = usePluginStore((s) => s.removePlugin);

  // Load installed plugins on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const api = getPluginApi();
        if (api) {
          const result = await api.list();
          setPlugins(result.plugins);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [setPlugins, setLoading, setError]);

  const handleEnable = useCallback(
    async (pluginId: string) => {
      setLoading(true);
      try {
        const api = getPluginApi();
        if (api) {
          const result = await api.enable(pluginId);
          if (result.ok && result.plugin) {
            updatePlugin(result.plugin);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, updatePlugin]
  );

  const handleDisable = useCallback(
    async (pluginId: string) => {
      setLoading(true);
      try {
        const api = getPluginApi();
        if (api) {
          const result = await api.disable(pluginId);
          if (result.ok && result.plugin) {
            updatePlugin(result.plugin);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, updatePlugin]
  );

  const handleUninstall = useCallback(
    async (pluginId: string) => {
      setLoading(true);
      try {
        const api = getPluginApi();
        if (api) {
          const result = await api.uninstall(pluginId);
          if (result.ok) {
            removePlugin(pluginId);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, removePlugin]
  );

  const handleInstall = useCallback(
    async (pluginId: string) => {
      setLoading(true);
      try {
        const api = getPluginApi();
        if (api) {
          const result = await api.install(pluginId);
          if (result.ok && result.plugin) {
            usePluginStore.getState().addPlugin(result.plugin);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  const installedIds = new Set(plugins.map((p) => p.id));

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <TabButton
          label="Installed"
          count={plugins.length}
          isActive={activeTab === 'installed'}
          onClick={() => setActiveTab('installed')}
        />
        <TabButton
          label="Marketplace"
          count={marketplace.length}
          isActive={activeTab === 'marketplace'}
          onClick={() => setActiveTab('marketplace')}
        />
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && plugins.length === 0 && (
          <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-sm">Loading plugins...</p>
          </div>
        )}

        {activeTab === 'installed' && (
          <>
            {plugins.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                <p className="text-sm">No plugins installed</p>
                <p className="text-xs mt-1">Browse the marketplace to find plugins</p>
              </div>
            )}
            {plugins.map((plugin) => (
              <InstalledPluginCard
                key={plugin.id}
                plugin={plugin}
                onEnable={handleEnable}
                onDisable={handleDisable}
                onUninstall={handleUninstall}
                isLoading={isLoading}
              />
            ))}
          </>
        )}

        {activeTab === 'marketplace' && (
          <>
            {marketplace.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                <p className="text-sm">No plugins available</p>
                <p className="text-xs mt-1">Check back later for new plugins</p>
              </div>
            )}
            {marketplace.map((plugin) => (
              <MarketplacePluginCard
                key={plugin.id}
                plugin={plugin}
                isInstalled={installedIds.has(plugin.id)}
                onInstall={handleInstall}
                isLoading={isLoading}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Tab Button
// ============================================================================

function TabButton({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
      onClick={onClick}
    >
      {label}
      {count > 0 && (
        <span className="ml-1.5 text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </button>
  );
}
