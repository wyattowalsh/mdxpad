/**
 * CapabilityBadge Component
 *
 * Displays a visual badge for AI provider capabilities.
 *
 * @module src/renderer/features/ai-provider/components/CapabilityBadge
 */

import { ProviderCapability } from '@shared/ai/types';

interface CapabilityBadgeProps {
  capability: ProviderCapability;
  size?: 'sm' | 'md';
}

const CAPABILITY_CONFIG: Record<
  ProviderCapability,
  { label: string; color: string; icon: string }
> = {
  [ProviderCapability.TEXT_GENERATION]: {
    label: 'Text',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    icon: '💬',
  },
  [ProviderCapability.STREAMING]: {
    label: 'Stream',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    icon: '⚡',
  },
  [ProviderCapability.EMBEDDINGS]: {
    label: 'Embed',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    icon: '🔢',
  },
  [ProviderCapability.IMAGE_GENERATION]: {
    label: 'Image',
    color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    icon: '🎨',
  },
  [ProviderCapability.VISION]: {
    label: 'Vision',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    icon: '👁️',
  },
  [ProviderCapability.TOOL_USE]: {
    label: 'Tools',
    color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    icon: '⚙️',
  },
  [ProviderCapability.AGENTS]: {
    label: 'Agents',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    icon: '🤖',
  },
};

export function CapabilityBadge({ capability, size = 'sm' }: CapabilityBadgeProps) {
  const config = CAPABILITY_CONFIG[capability];

  if (!config) {
    return null;
  }

  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.color} ${sizeClasses}`}
      title={capability}
    >
      <span className="text-[0.7em]">{config.icon}</span>
      {config.label}
    </span>
  );
}

interface CapabilityListProps {
  capabilities: ProviderCapability[];
  size?: 'sm' | 'md';
  max?: number;
}

export function CapabilityList({ capabilities, size = 'sm', max }: CapabilityListProps) {
  const displayCaps = max ? capabilities.slice(0, max) : capabilities;
  const remaining = max ? capabilities.length - max : 0;

  return (
    <div className="flex flex-wrap gap-1">
      {displayCaps.map((cap) => (
        <CapabilityBadge key={cap} capability={cap} size={size} />
      ))}
      {remaining > 0 && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          +{remaining} more
        </span>
      )}
    </div>
  );
}
