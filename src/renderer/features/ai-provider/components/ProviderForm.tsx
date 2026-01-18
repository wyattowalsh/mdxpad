/**
 * ProviderForm Component
 *
 * Form for adding or editing AI provider configuration.
 *
 * @module src/renderer/features/ai-provider/components/ProviderForm
 */

import { useState, useCallback } from 'react';
import type { ProviderConfig, ProviderType } from '@shared/ai/types';

interface ProviderFormProps {
  /** Existing provider to edit, or undefined for new provider */
  provider?: ProviderConfig;
  /** Called when form is submitted */
  onSubmit: (
    config: { displayName: string; type: ProviderType; baseUrl?: string },
    apiKey?: string
  ) => Promise<void>;
  /** Called when form is cancelled */
  onCancel: () => void;
  /** Whether the form is submitting */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
}

const PROVIDER_TYPES: { value: ProviderType; label: string; requiresApiKey: boolean }[] = [
  { value: 'openai', label: 'OpenAI', requiresApiKey: true },
  { value: 'anthropic', label: 'Anthropic', requiresApiKey: true },
  { value: 'ollama', label: 'Ollama (Local)', requiresApiKey: false },
  { value: 'lmstudio', label: 'LM Studio (Local)', requiresApiKey: false },
  { value: 'openai-compatible', label: 'OpenAI Compatible', requiresApiKey: true },
];

const DEFAULT_BASE_URLS: Partial<Record<ProviderType, string>> = {
  ollama: 'http://localhost:11434',
  lmstudio: 'http://localhost:1234/v1',
};

export function ProviderForm({
  provider,
  onSubmit,
  onCancel,
  isLoading,
  error,
}: ProviderFormProps) {
  const isEditing = !!provider;

  const [displayName, setDisplayName] = useState(provider?.displayName ?? '');
  const [type, setType] = useState<ProviderType>(provider?.type ?? 'openai');
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const selectedType = PROVIDER_TYPES.find((t) => t.value === type);
  const requiresApiKey = selectedType?.requiresApiKey ?? true;
  const requiresBaseUrl = type === 'openai-compatible' || type === 'ollama' || type === 'lmstudio';

  const handleTypeChange = useCallback((newType: ProviderType) => {
    setType(newType);
    // Set default base URL for local providers
    const defaultUrl = DEFAULT_BASE_URLS[newType];
    if (defaultUrl && !baseUrl) {
      setBaseUrl(defaultUrl);
    }
  }, [baseUrl]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const config: { displayName: string; type: ProviderType; baseUrl?: string } = {
        displayName: displayName.trim(),
        type,
      };

      if (requiresBaseUrl && baseUrl.trim()) {
        config.baseUrl = baseUrl.trim();
      }

      await onSubmit(
        config,
        requiresApiKey && apiKey.trim() ? apiKey.trim() : undefined
      );
    },
    [displayName, type, baseUrl, apiKey, requiresBaseUrl, requiresApiKey, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Display Name */}
      <div>
        <label
          htmlFor="displayName"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Display Name
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="My OpenAI Provider"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Provider Type */}
      {!isEditing && (
        <div>
          <label
            htmlFor="type"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Provider Type
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as ProviderType)}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {PROVIDER_TYPES.map((pt) => (
              <option key={pt.value} value={pt.value}>
                {pt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Base URL (for compatible/local providers) */}
      {requiresBaseUrl && (
        <div>
          <label
            htmlFor="baseUrl"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Base URL
          </label>
          <input
            id="baseUrl"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={DEFAULT_BASE_URLS[type] ?? 'https://api.example.com/v1'}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {/* API Key */}
      {requiresApiKey && (
        <div>
          <label
            htmlFor="apiKey"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            API Key {isEditing && '(leave blank to keep existing)'}
          </label>
          <div className="relative mt-1">
            <input
              id="apiKey"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isEditing ? '••••••••••••••••' : 'sk-...'}
              required={!isEditing}
              autoComplete="off"
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showApiKey ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Your API key is encrypted and stored securely in macOS Keychain.
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : isEditing ? 'Update Provider' : 'Add Provider'}
        </button>
      </div>
    </form>
  );
}
