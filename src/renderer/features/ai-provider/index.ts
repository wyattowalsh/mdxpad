/**
 * AI Provider Feature
 *
 * Provides AI provider management for the renderer process.
 *
 * @module src/renderer/features/ai-provider
 */

// Store
export { useAIProviderStore } from './store';
export type { AIProviderState, AIProviderActions } from './store';

// Hooks
export {
  useAIProvider,
  useActiveProvider,
  useConnectedProviders,
  useProviderValidation,
  useAddProvider,
  useUpdateProvider,
  useRemoveProvider,
  useUsageStats,
  useProviderSettings,
  useProviderCapabilities,
  useInitializeAIProviders,
  useHasConnectedProvider,
  useProviderById,
  useProvidersByType,
} from './hooks';

// Components
export {
  CapabilityBadge,
  CapabilityList,
  ProviderForm,
  ProviderList,
  ProviderSettings,
  StatusIndicator,
  UsageStats,
} from './components';
