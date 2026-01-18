/**
 * ProviderList Component
 *
 * Displays a list of configured AI providers with status indicators.
 *
 * @module src/renderer/features/ai-provider/components/ProviderList
 */

import type { ProviderConfig } from '@shared/ai/types';
import { StatusIndicator } from './StatusIndicator';

interface ProviderListProps {
  providers: ProviderConfig[];
  activeProviderId: string | null;
  selectedProviderId: string | null;
  onSelect: (id: string) => void;
  onSetActive: (id: string) => void;
  isLoading?: boolean | undefined;
}

export function ProviderList({
  providers,
  activeProviderId,
  selectedProviderId,
  onSelect,
  onSetActive,
  isLoading,
}: ProviderListProps) {
  if (providers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
        <p className="text-sm">No providers configured</p>
        <p className="text-xs mt-1">Add a provider to get started</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
      {providers.map((provider) => (
        <ProviderListItem
          key={provider.id}
          provider={provider}
          isActive={provider.id === activeProviderId}
          isSelected={provider.id === selectedProviderId}
          onSelect={() => onSelect(provider.id)}
          onSetActive={() => onSetActive(provider.id)}
          isLoading={isLoading}
        />
      ))}
    </ul>
  );
}

interface ProviderListItemProps {
  provider: ProviderConfig;
  isActive: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onSetActive: () => void;
  isLoading?: boolean | undefined;
}

function ProviderListItem({
  provider,
  isActive,
  isSelected,
  onSelect,
  onSetActive,
  isLoading,
}: ProviderListItemProps) {
  return (
    <li
      className={`
        flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}
      `}
      onClick={onSelect}
    >
      {/* Status indicator */}
      <StatusIndicator status={provider.status} />

      {/* Provider info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {provider.displayName}
          </span>
          {isActive && (
            <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-1.5 py-0.5 rounded">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
            {provider.type}
          </span>
        </div>
      </div>

      {/* Actions */}
      {!isActive && provider.status === 'connected' && (
        <button
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
          onClick={(e) => {
            e.stopPropagation();
            onSetActive();
          }}
          disabled={isLoading}
        >
          Set Active
        </button>
      )}
    </li>
  );
}
