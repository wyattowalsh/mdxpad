import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderCapability } from '../../../../shared/ai/types';
import type { ProviderConfig, ModelCapabilities } from '../../../../shared/ai/types';
import {
  CapabilityNotSupportedError,
  NoActiveProviderError,
  ProviderDisconnectedError,
  ProviderNotFoundError,
} from '../../../../shared/ai/errors';
import { ProviderSessionService } from '../provider-session-service';

function createProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'provider-1',
    displayName: 'Provider 1',
    type: 'openai',
    isActive: true,
    status: 'connected',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createCapabilities(
  modelId: string,
  capabilities: ProviderCapability[]
): ModelCapabilities {
  return {
    modelId,
    capabilities: new Set(capabilities),
  };
}

describe('ProviderSessionService', () => {
  const mockProviderService = {
    getProviders: vi.fn(),
    getProvider: vi.fn(),
    getActiveProvider: vi.fn(),
    addProvider: vi.fn(),
    updateProvider: vi.fn(),
    removeProvider: vi.fn(),
    setActiveProvider: vi.fn(),
    validateProvider: vi.fn(),
    getProviderCount: vi.fn(),
  };

  const mockCapabilityService = {
    getCapabilities: vi.fn(),
    listModels: vi.fn(),
    hasCapability: vi.fn(),
    refreshCapabilities: vi.fn(),
    getProvidersWithCapability: vi.fn(),
  };

  let service: ProviderSessionService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockProviderService.getActiveProvider.mockResolvedValue(createProvider());
    mockProviderService.getProvider.mockResolvedValue(createProvider());

    mockCapabilityService.listModels.mockResolvedValue([
      { id: 'gpt-4o', name: 'GPT-4o', capabilities: [ProviderCapability.TEXT_GENERATION] },
    ]);
    mockCapabilityService.getCapabilities.mockResolvedValue(
      createCapabilities('gpt-4o', [
        ProviderCapability.TEXT_GENERATION,
        ProviderCapability.STREAMING,
      ])
    );

    service = new ProviderSessionService(mockProviderService, mockCapabilityService);
  });

  it('selects explicit provider/model when provided', async () => {
    const provider = createProvider({ id: 'provider-2' });
    mockProviderService.getProvider.mockResolvedValue(provider);

    const result = await service.selectProviderModel({
      providerId: 'provider-2',
      modelId: 'gpt-4o-mini',
    });

    expect(mockProviderService.getProvider).toHaveBeenCalledWith('provider-2');
    expect(result.provider.id).toBe('provider-2');
    expect(result.modelId).toBe('gpt-4o-mini');
  });

  it('falls back to active provider when providerId is omitted', async () => {
    const activeProvider = createProvider({ id: 'active-provider' });
    mockProviderService.getActiveProvider.mockResolvedValue(activeProvider);

    const result = await service.selectProviderModel();

    expect(mockProviderService.getActiveProvider).toHaveBeenCalled();
    expect(result.provider.id).toBe('active-provider');
  });

  it('chooses first listed model when default model is unavailable', async () => {
    const provider = createProvider({ type: 'ollama', id: 'local-provider' });
    mockProviderService.getProvider.mockResolvedValue(provider);
    mockCapabilityService.listModels.mockResolvedValue([
      {
        id: 'llama3.2',
        name: 'llama3.2',
        capabilities: [ProviderCapability.TEXT_GENERATION],
      },
    ]);

    const result = await service.selectProviderModel({ providerId: provider.id });

    expect(result.modelId).toBe('llama3.2');
  });

  it('throws ProviderNotFoundError for unknown provider', async () => {
    mockProviderService.getProvider.mockResolvedValue(null);

    await expect(service.selectProviderModel({ providerId: 'missing-provider' })).rejects.toThrow(
      ProviderNotFoundError
    );
  });

  it('throws ProviderDisconnectedError when provider is not connected', async () => {
    const provider = createProvider({ status: 'disconnected' });
    mockProviderService.getActiveProvider.mockResolvedValue(provider);

    await expect(service.assertSessionReady()).rejects.toThrow(ProviderDisconnectedError);
  });

  it('throws CapabilityNotSupportedError when capability is missing', async () => {
    mockCapabilityService.getCapabilities.mockResolvedValue(
      createCapabilities('gpt-4o', [ProviderCapability.TEXT_GENERATION])
    );

    await expect(
      service.assertSessionReady({
        requiredCapability: ProviderCapability.IMAGE_GENERATION,
      })
    ).rejects.toThrow(CapabilityNotSupportedError);
  });

  it('returns not ready with NoActiveProviderError when no active provider exists', async () => {
    mockProviderService.getActiveProvider.mockResolvedValue(null);

    const result = await service.checkSessionReadiness();

    expect(result.ready).toBe(false);
    expect(result.error).toBeInstanceOf(NoActiveProviderError);
  });

  it('returns ready selection when provider/model satisfy readiness checks', async () => {
    const result = await service.assertSessionReady({
      requiredCapability: ProviderCapability.STREAMING,
    });

    expect(result.provider.id).toBe('provider-1');
    expect(result.modelId).toBe('gpt-4o');
    expect(result.capabilities.capabilities.has(ProviderCapability.STREAMING)).toBe(true);
  });
});
