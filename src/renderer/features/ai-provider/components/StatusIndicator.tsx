/**
 * StatusIndicator Component
 *
 * Visual indicator for provider connection status.
 *
 * @module src/renderer/features/ai-provider/components/StatusIndicator
 */

import type { ConnectionStatus } from '@shared/ai/types';

interface StatusIndicatorProps {
  status: ConnectionStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { color: string; label: string; pulse?: boolean }
> = {
  connected: {
    color: 'bg-green-500',
    label: 'Connected',
  },
  disconnected: {
    color: 'bg-gray-400',
    label: 'Disconnected',
  },
  error: {
    color: 'bg-red-500',
    label: 'Error',
  },
  validating: {
    color: 'bg-yellow-500',
    label: 'Validating',
    pulse: true,
  },
};

export function StatusIndicator({
  status,
  showLabel = false,
  size = 'sm',
}: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const sizeClasses = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`
          inline-block rounded-full ${config.color} ${sizeClasses}
          ${config.pulse ? 'animate-pulse' : ''}
        `}
        title={config.label}
      />
      {showLabel && (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {config.label}
        </span>
      )}
    </div>
  );
}
