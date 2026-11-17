/**
 * PluginCard Component
 *
 * Displays a single plugin with its details and action buttons.
 *
 * @module renderer/features/plugins/PluginCard
 */

import type { PluginRecord, MarketplacePlugin } from '@shared/contracts/plugin-schemas';

// ============================================================================
// Types
// ============================================================================

interface InstalledPluginCardProps {
  plugin: PluginRecord;
  onEnable: (pluginId: string) => void;
  onDisable: (pluginId: string) => void;
  onUninstall: (pluginId: string) => void;
  isLoading?: boolean | undefined;
}

interface MarketplacePluginCardProps {
  plugin: MarketplacePlugin;
  isInstalled: boolean;
}

// ============================================================================
// Permission Badge
// ============================================================================

function PermissionBadge({ permission }: { permission: string }) {
  const colors: Record<string, string> = {
    'file-read': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'file-write': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    ui: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    network: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded ${colors[permission] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}`}
    >
      {permission}
    </span>
  );
}

// ============================================================================
// State Badge
// ============================================================================

function StateBadge({ state }: { state: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    installed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    disabled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded ${styles[state] ?? 'bg-gray-100 text-gray-800'}`}
    >
      {state}
    </span>
  );
}

// ============================================================================
// Installed Plugin Card
// ============================================================================

export function InstalledPluginCard({
  plugin,
  onEnable,
  onDisable,
  onUninstall,
  isLoading,
}: InstalledPluginCardProps) {
  const isActive = plugin.state === 'active';

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {plugin.manifest.name}
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              v{plugin.manifest.version}
            </span>
            <StateBadge state={plugin.state} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {plugin.manifest.description}
          </p>
          {plugin.manifest.author && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              by {plugin.manifest.author}
            </p>
          )}
          {plugin.error && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{plugin.error}</p>
          )}
          <div className="flex gap-1 mt-2">
            {plugin.manifest.permissions.map((perm) => (
              <PermissionBadge key={perm} permission={perm} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {isActive ? (
            <button
              className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
              onClick={() => onDisable(plugin.id)}
              disabled={isLoading}
            >
              Disable
            </button>
          ) : (
            <button
              className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              onClick={() => onEnable(plugin.id)}
              disabled={isLoading}
            >
              Enable
            </button>
          )}
          <button
            className="text-xs px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50"
            onClick={() => onUninstall(plugin.id)}
            disabled={isLoading}
          >
            Uninstall
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Marketplace Plugin Card
// ============================================================================

export function MarketplacePluginCard({ plugin, isInstalled }: MarketplacePluginCardProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">{plugin.name}</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">v{plugin.version}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{plugin.description}</p>
          {plugin.author && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">by {plugin.author}</p>
          )}
          <div className="flex gap-1 mt-2">
            {plugin.permissions.map((perm) => (
              <PermissionBadge key={perm} permission={perm} />
            ))}
          </div>
        </div>
        <div>
          {isInstalled ? (
            <span className="text-xs px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
              Installed
            </span>
          ) : (
            <span className="text-xs px-3 py-1 text-gray-500 dark:text-gray-400">
              Install unavailable
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
