/**
 * ProviderService Unit Tests
 *
 * Tests for AI provider configuration management including CRUD operations,
 * validation, and business constraints.
 *
 * @module tests/unit/provider-service
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { ProviderConfig, ProviderType } from '../../../../shared/ai/types';

// =============================================================================
// Mock Setup - Use vi.hoisted for hoisted mock variables
// =============================================================================

const { mockStoreData, mockStore, mockStoreConstructor, mockPerformValidation, mockCreateErrorResult, mockRandomUUID, mockSetSnapshots } = vi.hoisted(() => {
  const storeData = new Map<string, unknown>();
  const setSnapshots: [string, unknown][] = [];
  const store = {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      const val = storeData.get(key);
      return val !== undefined ? val : defaultValue;
    }),
    set: vi.fn((key: string, value: unknown) => {
      // Capture a deep snapshot for assertion, store original for get()
      setSnapshots.push([key, JSON.parse(JSON.stringify(value))]);
      storeData.set(key, value);
    }),
    delete: vi.fn((key: string) => { storeData.delete(key); }),
    has: vi.fn((key: string) => storeData.has(key)),
    clear: vi.fn(() => { storeData.clear(); }),
    onDidChange: vi.fn(),
  };
  return {
    mockStoreData: storeData,
    mockStore: store,
    mockStoreConstructor: vi.fn().mockImplementation(() => store),
    mockPerformValidation: vi.fn(),
    mockCreateErrorResult: vi.fn(),
    mockRandomUUID: vi.fn(() => 'test-uuid-123'),
    mockSetSnapshots: setSnapshots,
  };
});

const mockCredentialService = {
  setCredential: vi.fn(),
  getCredential: vi.fn(),
  clearCredential: vi.fn(),
  hasCredential: vi.fn(),
  isAvailable: vi.fn(() => true),
  getStorageType: vi.fn(() => 'persistent' as const),
};

// Mock electron-store
vi.mock('electron-store', () => ({
  default: mockStoreConstructor,
}));

// Mock crypto
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return { ...actual, randomUUID: mockRandomUUID };
});

// Mock provider-validation
vi.mock('../provider-validation', () => ({
  performValidation: mockPerformValidation,
  createErrorResult: mockCreateErrorResult,
}));

// Import after mocks
import { ProviderService } from '../provider-service';
import { ProviderNotFoundError } from '../../../../shared/ai/errors';

// =============================================================================
// Test Utilities
// =============================================================================

function createMockProvider(overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
    id: 'provider-1',
    displayName: 'Test Provider',
    type: 'openai',
    isActive: false,
    status: 'disconnected',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function resetMocks(): void {
  vi.clearAllMocks();
  mockStoreData.clear();
  mockSetSnapshots.length = 0;
  mockStoreData.set('providers', {});
  mockStoreData.set('activeProviderId', null);
  mockStore.get.mockImplementation((key: string, defaultValue?: unknown) => {
    const val = mockStoreData.get(key);
    return val !== undefined ? val : defaultValue;
  });
  mockStore.set.mockImplementation((key: string, value: unknown) => {
    mockSetSnapshots.push([key, JSON.parse(JSON.stringify(value))]);
    mockStoreData.set(key, value);
  });
  mockStoreConstructor.mockImplementation(() => mockStore);
  mockRandomUUID.mockReturnValue('test-uuid-123');
  mockCredentialService.setCredential.mockResolvedValue({
    success: true,
    storageType: 'persistent',
    metadata: {
      providerId: 'test',
      storageType: 'persistent',
      keyPreview: 'test',
      storedAt: '2024-01-01',
    },
  });
  mockCredentialService.getCredential.mockResolvedValue('test-api-key');
  mockCredentialService.clearCredential.mockResolvedValue(true);
  mockPerformValidation.mockResolvedValue({
    valid: true,
    status: 'connected',
  });
}

// =============================================================================
// ProviderService Tests
// =============================================================================

describe('ProviderService', () => {
  let service: ProviderService;

  beforeEach(() => {
    resetMocks();
    service = new ProviderService(mockCredentialService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Constructor Tests
  // ===========================================================================

  describe('constructor', () => {
    it('should initialize electron-store with correct config', () => {
      expect(mockStoreConstructor).toHaveBeenCalledWith({
        name: 'mdxpad-providers',
        defaults: {
          providers: {},
          activeProviderId: null,
        },
      });
    });

    it('should accept credential service dependency', () => {
      expect(service).toBeDefined();
    });
  });

  // ===========================================================================
  // getProviders Tests
  // ===========================================================================

  describe('getProviders', () => {
    it('should return empty array when no providers', async () => {
      mockStoreData.set('providers', {});

      const result = await service.getProviders();

      expect(result).toEqual([]);
    });

    it('should return all providers sorted by creation date', async () => {
      const providers = {
        'id-2': createMockProvider({ id: 'id-2', createdAt: '2024-01-02T00:00:00.000Z' }),
        'id-1': createMockProvider({ id: 'id-1', createdAt: '2024-01-01T00:00:00.000Z' }),
        'id-3': createMockProvider({ id: 'id-3', createdAt: '2024-01-03T00:00:00.000Z' }),
      };
      mockStoreData.set('providers', providers);

      const result = await service.getProviders();

      expect(result).toHaveLength(3);
      expect(result[0]?.id).toBe('id-1');
      expect(result[1]?.id).toBe('id-2');
      expect(result[2]?.id).toBe('id-3');
    });
  });

  // ===========================================================================
  // getProvider Tests
  // ===========================================================================

  describe('getProvider', () => {
    it('should return provider by ID', async () => {
      const provider = createMockProvider({ id: 'test-id' });
      mockStoreData.set('providers', { 'test-id': provider });

      const result = await service.getProvider('test-id');

      expect(result).toEqual(provider);
    });

    it('should return null for non-existent provider', async () => {
      mockStoreData.set('providers', {});

      const result = await service.getProvider('non-existent');

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // getActiveProvider Tests
  // ===========================================================================

  describe('getActiveProvider', () => {
    it('should return active provider', async () => {
      const activeProvider = createMockProvider({ id: 'active-1', isActive: true });
      mockStoreData.set('activeProviderId', 'active-1');
      mockStoreData.set('providers', { 'active-1': activeProvider });

      const result = await service.getActiveProvider();

      expect(result).toEqual(activeProvider);
    });

    it('should return null when no active provider', async () => {
      mockStoreData.set('activeProviderId', null);
      mockStoreData.set('providers', {});

      const result = await service.getActiveProvider();

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // addProvider Tests
  // ===========================================================================

  describe('addProvider', () => {
    it('should create new provider with generated ID', async () => {
      const config = {
        displayName: 'OpenAI',
        type: 'openai' as ProviderType,
        isActive: false,
      };

      const result = await service.addProvider(config);

      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.displayName).toBe('OpenAI');
      expect(result.type).toBe('openai');
      expect(result.status).toBe('disconnected');
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should save provider to store', async () => {
      const config = {
        displayName: 'OpenAI',
        type: 'openai' as ProviderType,
        isActive: false,
      };

      const result = await service.addProvider(config);

      expect(mockStore.set).toHaveBeenCalledWith(
        'providers',
        expect.objectContaining({
          [result.id]: expect.objectContaining({
            displayName: 'OpenAI',
            type: 'openai',
          }),
        })
      );
    });

    it('should store API key when provided', async () => {
      const config = {
        displayName: 'OpenAI',
        type: 'openai' as ProviderType,
        isActive: false,
      };
      const apiKey = 'sk-test-key';

      const result = await service.addProvider(config, apiKey);

      expect(mockCredentialService.setCredential).toHaveBeenCalledWith(
        result.id,
        apiKey
      );
    });

    it('should not store API key when not provided', async () => {
      const config = {
        displayName: 'OpenAI',
        type: 'openai' as ProviderType,
        isActive: false,
      };

      await service.addProvider(config);

      expect(mockCredentialService.setCredential).not.toHaveBeenCalled();
    });

    it('should deactivate existing active provider when adding active provider', async () => {
      const existingActive = createMockProvider({ id: 'existing', isActive: true });
      mockStoreData.set('activeProviderId', 'existing');
      mockStoreData.set('providers', { existing: existingActive });

      const config = {
        displayName: 'New Active',
        type: 'openai' as ProviderType,
        isActive: true,
      };

      await service.addProvider(config);

      // Should have updated existing provider to inactive
      const setCallArgs = mockStore.set.mock.calls.find(
        (call) => call[0] === 'providers'
      );
      expect(setCallArgs).toBeDefined();
      expect((setCallArgs?.[1] as Record<string, ProviderConfig>)?.existing?.isActive).toBe(false);
    });

    it('should set activeProviderId when adding active provider', async () => {
      const config = {
        displayName: 'Active Provider',
        type: 'openai' as ProviderType,
        isActive: true,
      };

      const result = await service.addProvider(config);

      expect(mockStore.set).toHaveBeenCalledWith('activeProviderId', result.id);
    });

    it('should enforce max provider limit', async () => {
      const providers: Record<string, ProviderConfig> = {};
      for (let i = 0; i < 10; i++) {
        providers[`id-${i}`] = createMockProvider({ id: `id-${i}` });
      }
      mockStoreData.set('providers', providers);

      const config = {
        displayName: 'Too Many',
        type: 'openai' as ProviderType,
        isActive: false,
      };

      await expect(service.addProvider(config)).rejects.toThrow(
        'Maximum provider limit (10) reached'
      );
    });

    it('should require baseUrl for ollama provider', async () => {
      const config = {
        displayName: 'Ollama',
        type: 'ollama' as ProviderType,
        isActive: false,
      };

      await expect(service.addProvider(config)).rejects.toThrow(
        'baseUrl is required for provider type: ollama'
      );
    });

    it('should require baseUrl for lmstudio provider', async () => {
      const config = {
        displayName: 'LM Studio',
        type: 'lmstudio' as ProviderType,
        isActive: false,
      };

      await expect(service.addProvider(config)).rejects.toThrow(
        'baseUrl is required for provider type: lmstudio'
      );
    });

    it('should require baseUrl for openai-compatible provider', async () => {
      const config = {
        displayName: 'Compatible',
        type: 'openai-compatible' as ProviderType,
        isActive: false,
      };

      await expect(service.addProvider(config)).rejects.toThrow(
        'baseUrl is required for provider type: openai-compatible'
      );
    });

    it('should accept baseUrl when provided for local provider', async () => {
      const config = {
        displayName: 'Ollama',
        type: 'ollama' as ProviderType,
        baseUrl: 'http://localhost:11434',
        isActive: false,
      };

      const result = await service.addProvider(config);

      expect(result.baseUrl).toBe('http://localhost:11434');
    });
  });

  // ===========================================================================
  // updateProvider Tests
  // ===========================================================================

  describe('updateProvider', () => {
    it('should update provider fields', async () => {
      const existing = createMockProvider({ id: 'test-id', displayName: 'Old Name' });
      mockStoreData.set('providers', { 'test-id': existing });

      const result = await service.updateProvider('test-id', {
        displayName: 'New Name',
      });

      expect(result.displayName).toBe('New Name');
      expect(result.updatedAt).not.toBe(existing.updatedAt);
    });

    it('should throw ProviderNotFoundError for non-existent provider', async () => {
      mockStoreData.set('providers', {});

      await expect(
        service.updateProvider('non-existent', { displayName: 'Test' })
      ).rejects.toThrow(ProviderNotFoundError);
    });

    it('should preserve immutable fields', async () => {
      const existing = createMockProvider({
        id: 'test-id',
        createdAt: '2024-01-01T00:00:00.000Z',
      });
      mockStoreData.set('providers', { 'test-id': existing });

      const result = await service.updateProvider('test-id', {
        id: 'new-id',
        createdAt: '2099-01-01T00:00:00.000Z',
        displayName: 'New Name',
      } as Partial<ProviderConfig>);

      expect(result.id).toBe('test-id');
      expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should deactivate other providers when activating', async () => {
      const provider1 = createMockProvider({ id: 'id-1', isActive: true });
      const provider2 = createMockProvider({ id: 'id-2', isActive: false });
      mockStoreData.set('activeProviderId', 'id-1');
      mockStoreData.set('providers', { 'id-1': provider1, 'id-2': provider2 });

      await service.updateProvider('id-2', { isActive: true });

      const setCall = mockStore.set.mock.calls.find((call) => call[0] === 'providers');
      expect((setCall?.[1] as Record<string, ProviderConfig>)?.['id-1']?.isActive).toBe(false);
    });

    it('should update activeProviderId when activating', async () => {
      const existing = createMockProvider({ id: 'test-id', isActive: false });
      mockStoreData.set('providers', { 'test-id': existing });

      await service.updateProvider('test-id', { isActive: true });

      expect(mockStore.set).toHaveBeenCalledWith('activeProviderId', 'test-id');
    });

    it('should clear activeProviderId when deactivating', async () => {
      const existing = createMockProvider({ id: 'test-id', isActive: true });
      mockStoreData.set('activeProviderId', 'test-id');
      mockStoreData.set('providers', { 'test-id': existing });

      await service.updateProvider('test-id', { isActive: false });

      expect(mockStore.set).toHaveBeenCalledWith('activeProviderId', null);
    });

    it('should validate baseUrl requirement when changing type', async () => {
      const existing = createMockProvider({ id: 'test-id', type: 'openai' });
      mockStoreData.set('providers', { 'test-id': existing });

      await expect(
        service.updateProvider('test-id', { type: 'ollama' })
      ).rejects.toThrow('baseUrl is required');
    });
  });

  // ===========================================================================
  // removeProvider Tests
  // ===========================================================================

  describe('removeProvider', () => {
    it('should remove provider from store', async () => {
      const provider = createMockProvider({ id: 'test-id' });
      mockStoreData.set('providers', { 'test-id': provider });

      await service.removeProvider('test-id');

      expect(mockStore.set).toHaveBeenCalledWith('providers', {});
    });

    it('should remove credential', async () => {
      const provider = createMockProvider({ id: 'test-id' });
      mockStoreData.set('providers', { 'test-id': provider });

      await service.removeProvider('test-id');

      expect(mockCredentialService.clearCredential).toHaveBeenCalledWith('test-id');
    });

    it('should clear activeProviderId if removing active provider', async () => {
      const provider = createMockProvider({ id: 'test-id', isActive: true });
      mockStoreData.set('activeProviderId', 'test-id');
      mockStoreData.set('providers', { 'test-id': provider });

      await service.removeProvider('test-id');

      expect(mockStore.set).toHaveBeenCalledWith('activeProviderId', null);
    });

    it('should throw ProviderNotFoundError for non-existent provider', async () => {
      mockStoreData.set('providers', {});

      await expect(service.removeProvider('non-existent')).rejects.toThrow(
        ProviderNotFoundError
      );
    });

    it('should preserve other providers', async () => {
      const provider1 = createMockProvider({ id: 'id-1' });
      const provider2 = createMockProvider({ id: 'id-2' });
      mockStoreData.set('providers', { 'id-1': provider1, 'id-2': provider2 });

      await service.removeProvider('id-1');

      expect(mockStore.set).toHaveBeenCalledWith(
        'providers',
        expect.objectContaining({ 'id-2': provider2 })
      );
    });
  });

  // ===========================================================================
  // setActiveProvider Tests
  // ===========================================================================

  describe('setActiveProvider', () => {
    it('should activate provider', async () => {
      const provider = createMockProvider({ id: 'test-id', isActive: false });
      mockStoreData.set('providers', { 'test-id': provider });

      await service.setActiveProvider('test-id');

      expect(mockStore.set).toHaveBeenCalledWith('activeProviderId', 'test-id');
    });

    it('should throw ProviderNotFoundError for non-existent provider', async () => {
      mockStoreData.set('providers', {});

      await expect(service.setActiveProvider('non-existent')).rejects.toThrow(
        ProviderNotFoundError
      );
    });

    it('should deactivate existing active provider', async () => {
      const activeProvider = createMockProvider({ id: 'active-1', isActive: true });
      const newProvider = createMockProvider({ id: 'new-1', isActive: false });
      mockStoreData.set('activeProviderId', 'active-1');
      mockStoreData.set('providers', { 'active-1': activeProvider, 'new-1': newProvider });

      await service.setActiveProvider('new-1');

      const setCall = mockStore.set.mock.calls.find((call) => call[0] === 'providers');
      expect((setCall?.[1] as Record<string, ProviderConfig>)?.['active-1']?.isActive).toBe(false);
    });
  });

  // ===========================================================================
  // validateProvider Tests
  // ===========================================================================

  describe('validateProvider', () => {
    it('should validate provider and update status on success', async () => {
      const provider = createMockProvider({ id: 'test-id', status: 'disconnected' });
      mockStoreData.set('providers', { 'test-id': provider });
      mockPerformValidation.mockResolvedValue({
        valid: true,
        status: 'connected',
      });

      const result = await service.validateProvider('test-id');

      expect(result.valid).toBe(true);
      expect(result.status).toBe('connected');
      expect(mockPerformValidation).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'test-id' }),
        'test-api-key'
      );
    });

    it('should set status to validating during validation', async () => {
      const provider = createMockProvider({ id: 'test-id' });
      mockStoreData.set('providers', { 'test-id': provider });
      mockPerformValidation.mockResolvedValue({ valid: true, status: 'connected' });

      await service.validateProvider('test-id');

      // Use snapshots to check intermediate state since mock.calls stores references
      // which get mutated by subsequent operations
      const validatingSnapshot = mockSetSnapshots.find(
        ([key, value]) =>
          key === 'providers' &&
          (value as Record<string, { status: string }>)['test-id']?.status === 'validating'
      );
      expect(validatingSnapshot).toBeDefined();
    });

    it('should update status on validation failure', async () => {
      const provider = createMockProvider({ id: 'test-id' });
      mockStoreData.set('providers', { 'test-id': provider });
      mockPerformValidation.mockResolvedValue({
        valid: false,
        status: 'error',
        error: { message: 'Invalid API key' },
      });

      const result = await service.validateProvider('test-id');

      expect(result.valid).toBe(false);
      expect(result.status).toBe('error');
    });

    it('should handle validation errors', async () => {
      const provider = createMockProvider({ id: 'test-id' });
      mockStoreData.set('providers', { 'test-id': provider });
      mockPerformValidation.mockRejectedValue(new Error('Network error'));
      mockCreateErrorResult.mockReturnValue({
        valid: false,
        status: 'error',
        error: { message: 'Network error' },
      });

      const result = await service.validateProvider('test-id');

      expect(result.valid).toBe(false);
      expect(mockCreateErrorResult).toHaveBeenCalled();
    });

    it('should throw ProviderNotFoundError for non-existent provider', async () => {
      mockStoreData.set('providers', {});

      await expect(service.validateProvider('non-existent')).rejects.toThrow(
        ProviderNotFoundError
      );
    });

    it('should clear errorMessage on successful validation', async () => {
      const provider = createMockProvider({
        id: 'test-id',
        status: 'error',
        errorMessage: 'Old error',
      });
      mockStoreData.set('providers', { 'test-id': provider });
      mockPerformValidation.mockResolvedValue({ valid: true, status: 'connected' });

      await service.validateProvider('test-id');

      const setCall = mockStore.set.mock.calls.find((call) => call[0] === 'providers');
      expect((setCall?.[1] as Record<string, ProviderConfig>)?.['test-id']?.errorMessage).toBeUndefined();
    });
  });

  // ===========================================================================
  // getProviderCount Tests
  // ===========================================================================

  describe('getProviderCount', () => {
    it('should return zero for no providers', async () => {
      mockStoreData.set('providers', {});

      const result = await service.getProviderCount();

      expect(result).toBe(0);
    });

    it('should return correct count', async () => {
      const providers = {
        'id-1': createMockProvider({ id: 'id-1' }),
        'id-2': createMockProvider({ id: 'id-2' }),
        'id-3': createMockProvider({ id: 'id-3' }),
      };
      mockStoreData.set('providers', providers);

      const result = await service.getProviderCount();

      expect(result).toBe(3);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle concurrent updates to same provider', async () => {
      const provider = createMockProvider({ id: 'test-id' });
      mockStoreData.set('providers', { 'test-id': provider });

      const promises = [
        service.updateProvider('test-id', { displayName: 'Name 1' }),
        service.updateProvider('test-id', { displayName: 'Name 2' }),
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it('should handle special characters in provider names', async () => {
      const config = {
        displayName: 'Test <>&"\'',
        type: 'openai' as ProviderType,
        isActive: false,
      };

      const result = await service.addProvider(config);

      expect(result.displayName).toBe('Test <>&"\'');
    });

    it('should handle very long provider names', async () => {
      const longName = 'x'.repeat(1000);
      const config = {
        displayName: longName,
        type: 'openai' as ProviderType,
        isActive: false,
      };

      const result = await service.addProvider(config);

      expect(result.displayName).toBe(longName);
    });
  });
});
