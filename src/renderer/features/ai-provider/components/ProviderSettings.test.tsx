import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProviderConfig } from '@shared/ai/types';

import { ProviderSettings } from './ProviderSettings';
import {
  useAIProvider,
  useProviderSettings,
  useUsageStats,
  useProviderValidation,
  useInitializeAIProviders,
} from '../hooks';

vi.mock('../hooks', () => ({
  useAIProvider: vi.fn(),
  useProviderSettings: vi.fn(),
  useUsageStats: vi.fn(),
  useProviderValidation: vi.fn(),
  useInitializeAIProviders: vi.fn(),
}));

vi.mock('./ProviderList', () => ({
  ProviderList: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <button onClick={() => onSelect('sidecar-1')}>Select Sidecar</button>
  ),
}));

vi.mock('./ProviderForm', () => ({
  ProviderForm: () => <div data-testid="provider-form" />,
}));

vi.mock('./UsageStats', () => ({
  UsageStats: () => <div data-testid="usage-stats" />,
}));

const sidecarProvider: ProviderConfig = {
  id: 'sidecar-1',
  displayName: 'Local Sidecar',
  type: 'sidecar',
  sidecarConfig: {
    modelPath: '/models/llama.gguf',
    port: 11470,
  },
  isActive: true,
  status: 'connected',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

function createAIProviderState(
  overrides: Partial<ReturnType<typeof useAIProvider>> = {}
): ReturnType<typeof useAIProvider> {
  return {
    providers: [sidecarProvider],
    activeProviderId: sidecarProvider.id,
    isLoading: false,
    isValidating: false,
    sidecarStatus: {
      success: true,
      status: 'stopped',
      config: sidecarProvider.sidecarConfig,
    },
    isSidecarLoading: false,
    error: null,
    fetchProviders: vi.fn().mockResolvedValue(undefined),
    addProvider: vi.fn().mockResolvedValue(undefined),
    updateProvider: vi.fn().mockResolvedValue(undefined),
    removeProvider: vi.fn().mockResolvedValue(undefined),
    setActiveProvider: vi.fn().mockResolvedValue(undefined),
    validateProvider: vi.fn().mockResolvedValue(true),
    fetchSidecarStatus: vi.fn().mockResolvedValue({
      success: true,
      status: 'running',
      endpoint: 'http://127.0.0.1:11470',
      config: sidecarProvider.sidecarConfig,
    }),
    configureSidecar: vi.fn().mockResolvedValue({
      success: true,
      status: 'stopped',
      config: sidecarProvider.sidecarConfig,
    }),
    startSidecar: vi.fn().mockResolvedValue({
      success: true,
      status: 'running',
      endpoint: 'http://127.0.0.1:11470',
      config: sidecarProvider.sidecarConfig,
    }),
    stopSidecar: vi.fn().mockResolvedValue({
      success: true,
      status: 'stopped',
      config: sidecarProvider.sidecarConfig,
    }),
    clearError: vi.fn(),
    ...overrides,
  };
}

function createProviderSettingsState(
  selectedProvider: ProviderConfig | null = sidecarProvider
): ReturnType<typeof useProviderSettings> {
  return {
    isOpen: true,
    selectedProvider,
    open: vi.fn(),
    close: vi.fn(),
    select: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(useInitializeAIProviders).mockReturnValue({
    isInitialized: true,
    isLoading: false,
  });

  vi.mocked(useAIProvider).mockReturnValue(createAIProviderState());
  vi.mocked(useProviderSettings).mockReturnValue(createProviderSettingsState());
  vi.mocked(useUsageStats).mockReturnValue({
    stats: null,
    timeRange: 'week',
    isLoading: false,
    refresh: vi.fn().mockResolvedValue(undefined),
  });
  vi.mocked(useProviderValidation).mockReturnValue({
    isValidating: false,
    validate: vi.fn().mockResolvedValue(true),
  });
});

describe('ProviderSettings sidecar actions', () => {
  it('dispatches refresh/configure/start/stop actions from sidecar controls', async () => {
    const aiState = createAIProviderState({
      sidecarStatus: {
        success: false,
        status: 'error',
        error: { code: 'SIDECAR_NOT_RUNNING', message: 'Runtime is stopped' },
        config: sidecarProvider.sidecarConfig,
      },
    });
    vi.mocked(useAIProvider).mockReturnValue(aiState);

    render(<ProviderSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'Select Sidecar' }));

    expect(screen.getByText(/Sidecar Runtime Status:/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply Config' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Runtime' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop Runtime' }));

    await waitFor(() => {
      expect(aiState.configureSidecar).toHaveBeenCalledWith(sidecarProvider.sidecarConfig);
    });

    expect(aiState.fetchSidecarStatus).toHaveBeenCalledTimes(2);
    expect(aiState.startSidecar).toHaveBeenCalledWith(sidecarProvider.sidecarConfig);
    expect(aiState.stopSidecar).toHaveBeenCalledTimes(1);
  });

  it('renders sidecar error status details', () => {
    vi.mocked(useAIProvider).mockReturnValue(
      createAIProviderState({
        sidecarStatus: {
          success: false,
          status: 'error',
          error: { code: 'SIDECAR_START_FAILED', message: 'Unable to bind sidecar port' },
        },
      })
    );

    render(<ProviderSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'Select Sidecar' }));

    expect(screen.getByText('Unable to bind sidecar port')).toBeTruthy();
  });
});
