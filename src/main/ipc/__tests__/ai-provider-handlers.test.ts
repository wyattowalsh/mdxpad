/**
 * AI Provider Handlers Tests
 *
 * Tests AI provider management, credential operations, and capability detection handlers.
 * Tests validation, error handling, and integration with AIServices.
 *
 * @see src/main/ipc/ai-provider-handlers.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';

import { AIChannels } from '@shared/ai/ipc-channels';
import * as schemas from '@shared/ai/schemas';
import { registerProviderHandlers } from '../ai-provider-handlers';
import type { AIServices } from '@main/services/ai';
import { AIProviderError } from '@shared/ai/errors';
import { ProviderCapability, type ProviderConfig } from '@shared/ai/types';

// ============================================================================
// Mock Setup
// ============================================================================

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// ============================================================================
// Test Utilities
// ============================================================================

function createMockProviderConfig(): ProviderConfig {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    displayName: 'Test Provider',
    type: 'openai',
    baseUrl: 'https://api.test.com',
    isActive: false,
    status: 'connected',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createMockAIServices(): AIServices {
  return {
    providerService: {
      getProviders: vi.fn().mockResolvedValue([]),
      getActiveProvider: vi.fn().mockResolvedValue(null),
      addProvider: vi.fn().mockResolvedValue(createMockProviderConfig()),
      updateProvider: vi.fn().mockResolvedValue(createMockProviderConfig()),
      removeProvider: vi.fn().mockResolvedValue(undefined),
      setActiveProvider: vi.fn().mockResolvedValue(undefined),
      validateProvider: vi.fn().mockResolvedValue({ valid: true, status: 'connected', models: [] }),
    },
    credentialService: {
      setCredential: vi.fn().mockResolvedValue({
        success: true,
        storageType: 'persistent',
        metadata: { keyPreview: '****' },
      }),
      hasCredential: vi.fn().mockResolvedValue({
        storageType: 'persistent',
        keyPreview: '****',
      }),
      clearCredential: vi.fn().mockResolvedValue(undefined),
    },
    capabilityService: {
      getCapabilities: vi.fn().mockResolvedValue({
        modelId: 'gpt-4',
        capabilities: new Set(['text-generation']),
        contextWindow: 8192,
        maxOutputTokens: 4096,
        constraints: {},
      }),
      listModels: vi
        .fn()
        .mockResolvedValue([
          { id: 'gpt-4', name: 'GPT-4', capabilities: [ProviderCapability.TEXT_GENERATION] },
        ]),
      refreshCapabilities: vi.fn().mockResolvedValue(undefined),
    },
    aiService: {
      generateText: vi.fn(),
      streamText: vi.fn(),
      generateEmbedding: vi.fn(),
      generateImage: vi.fn(),
    },
    sidecarService: {
      configure: vi.fn().mockResolvedValue({
        success: true,
        status: 'stopped',
      }),
      start: vi.fn().mockResolvedValue({
        success: true,
        status: 'running',
        endpoint: 'http://127.0.0.1:11470',
        pid: 4242,
      }),
      stop: vi.fn().mockResolvedValue({
        success: true,
        status: 'stopped',
      }),
      getStatus: vi.fn().mockReturnValue({
        success: true,
        status: 'running',
        endpoint: 'http://127.0.0.1:11470',
        pid: 4242,
      }),
    },
    usageService: {
      queryStats: vi.fn(),
      exportData: vi.fn(),
      clearHistory: vi.fn(),
    },
  } as unknown as AIServices;
}

function createMockWindow(): BrowserWindow {
  return {
    webContents: {
      id: 1,
      mainFrame: { routingId: 10 },
    },
  } as unknown as BrowserWindow;
}

function createAuthorizedInvokeEvent(window: BrowserWindow): IpcMainInvokeEvent {
  return {
    sender: {
      id: window.webContents.id,
      mainFrame: { routingId: window.webContents.mainFrame.routingId },
    },
    senderFrame: { routingId: window.webContents.mainFrame.routingId },
  } as IpcMainInvokeEvent;
}

function createUnauthorizedInvokeEvent(window: BrowserWindow) {
  return {
    sender: {
      id: window.webContents.id + 1,
      mainFrame: { routingId: window.webContents.mainFrame.routingId },
    },
    senderFrame: { routingId: window.webContents.mainFrame.routingId + 1 },
  };
}

const mockWindow = createMockWindow();

// ============================================================================
// Handler Registration Tests
// ============================================================================

describe('registerProviderHandlers', () => {
  it('should register all provider management handlers', () => {
    const services = createMockAIServices();
    registerProviderHandlers(services, mockWindow);

    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.PROVIDER_LIST, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.PROVIDER_ADD, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.PROVIDER_UPDATE, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.PROVIDER_REMOVE, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(
      AIChannels.PROVIDER_SET_ACTIVE,
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.PROVIDER_VALIDATE, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(
      AIChannels.SIDECAR_CONFIGURE,
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.SIDECAR_STATUS, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.SIDECAR_START, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.SIDECAR_STOP, expect.any(Function));
  });

  it('should register all credential management handlers', () => {
    const services = createMockAIServices();
    registerProviderHandlers(services, mockWindow);

    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.CREDENTIAL_SET, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.CREDENTIAL_HAS, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.CREDENTIAL_CLEAR, expect.any(Function));
  });

  it('should register all capability detection handlers', () => {
    const services = createMockAIServices();
    registerProviderHandlers(services, mockWindow);

    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.CAPABILITY_GET, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(
      AIChannels.CAPABILITY_LIST_MODELS,
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      AIChannels.CAPABILITY_REFRESH,
      expect.any(Function)
    );
  });

  it('should reject unauthorized sender for privileged provider handlers', async () => {
    const services = createMockAIServices();
    registerProviderHandlers(services, mockWindow);

    const providerAddCall = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === AIChannels.PROVIDER_ADD);
    const providerAddHandler = providerAddCall?.[1] as
      | ((event: unknown, request: unknown) => Promise<unknown>)
      | undefined;

    expect(providerAddHandler).toBeDefined();

    expect(() =>
      providerAddHandler!(createUnauthorizedInvokeEvent(mockWindow), {
        displayName: 'Test Provider',
        type: 'openai',
        apiKey: 'sk-test123',
      })
    ).toThrow('Unauthorized IPC sender');
    expect(services.providerService.addProvider).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Provider Management Handler Tests
// ============================================================================

describe('Provider Management Handlers', () => {
  let services: AIServices;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockAIServices();
    handlers = {};
    const authorizedEvent = createAuthorizedInvokeEvent(mockWindow);

    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = (...args: unknown[]) => {
        const request = args.length === 0 ? undefined : args[args.length - 1];
        return handler(authorizedEvent, request);
      };
    });

    registerProviderHandlers(services, mockWindow);
  });

  describe('PROVIDER_LIST', () => {
    it('should return list of providers with active provider ID', async () => {
      const mockProviders = [createMockProviderConfig()];
      const mockActive = { ...createMockProviderConfig(), isActive: true };

      vi.mocked(services.providerService.getProviders).mockResolvedValue(mockProviders);
      vi.mocked(services.providerService.getActiveProvider).mockResolvedValue(mockActive);

      const handler = handlers[AIChannels.PROVIDER_LIST]!;
      const result = await handler();

      expect(result).toEqual({
        providers: mockProviders,
        activeProviderId: mockActive.id,
      });
      expect(services.providerService.getProviders).toHaveBeenCalled();
      expect(services.providerService.getActiveProvider).toHaveBeenCalled();
    });

    it('should return null activeProviderId when no active provider', async () => {
      vi.mocked(services.providerService.getProviders).mockResolvedValue([]);
      vi.mocked(services.providerService.getActiveProvider).mockResolvedValue(null);

      const handler = handlers[AIChannels.PROVIDER_LIST]!;
      const result = await handler();

      expect(result.activeProviderId).toBeNull();
    });
  });

  describe('PROVIDER_ADD', () => {
    it('should add provider with valid request', async () => {
      const request = {
        displayName: 'New Provider',
        type: 'openai' as const,
        apiKey: 'sk-test123',
      };
      const mockProvider = createMockProviderConfig();

      vi.mocked(services.providerService.addProvider).mockResolvedValue(mockProvider);

      const handler = handlers[AIChannels.PROVIDER_ADD]!;
      const result = await handler(null, request);

      expect(result).toEqual({
        success: true,
        provider: mockProvider,
      });
      expect(services.providerService.addProvider).toHaveBeenCalledWith(
        {
          displayName: 'New Provider',
          type: 'openai',
          isActive: false,
        },
        'sk-test123'
      );
    });

    it('should include baseUrl when provided', async () => {
      const request = {
        displayName: 'Custom Provider',
        type: 'openai-compatible' as const,
        baseUrl: 'https://custom.api.com',
        apiKey: 'sk-custom',
      };

      await handlers[AIChannels.PROVIDER_ADD]!(null, request);

      expect(services.providerService.addProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://custom.api.com',
        }),
        'sk-custom'
      );
    });

    it('should return error on validation failure', async () => {
      const invalidRequest = { displayName: '', type: 'invalid' };

      const handler = handlers[AIChannels.PROVIDER_ADD]!;
      const result = await handler(null, invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle provider service errors', async () => {
      const request = {
        displayName: 'Test',
        type: 'openai' as const,
        apiKey: 'sk-test',
      };

      vi.mocked(services.providerService.addProvider).mockRejectedValue(
        new Error('Provider already exists')
      );

      const handler = handlers[AIChannels.PROVIDER_ADD]!;
      const result = await handler(null, request);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Provider already exists');
    });
  });

  describe('PROVIDER_UPDATE', () => {
    it('should update provider with valid request', async () => {
      const request = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        updates: {
          displayName: 'Updated Name',
        },
      };
      const mockProvider = { ...createMockProviderConfig(), displayName: 'Updated Name' };

      vi.mocked(services.providerService.updateProvider).mockResolvedValue(mockProvider);

      const handler = handlers[AIChannels.PROVIDER_UPDATE]!;
      const result = await handler(null, request);

      expect(result).toEqual({
        success: true,
        provider: mockProvider,
      });
      expect(services.providerService.updateProvider).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        {
          displayName: 'Updated Name',
        }
      );
    });

    it('should handle multiple update fields', async () => {
      const request = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        updates: {
          displayName: 'New Name',
          baseUrl: 'https://new.url.com',
          isActive: true,
        },
      };

      await handlers[AIChannels.PROVIDER_UPDATE]!(null, request);

      expect(services.providerService.updateProvider).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        {
          displayName: 'New Name',
          baseUrl: 'https://new.url.com',
          isActive: true,
        }
      );
    });

    it('should filter out undefined values', async () => {
      const request = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        updates: {
          displayName: 'New Name',
          baseUrl: undefined,
        },
      };

      await handlers[AIChannels.PROVIDER_UPDATE]!(null, request);

      const callArgs = vi.mocked(services.providerService.updateProvider).mock.calls[0]!;
      expect(callArgs[1]).toEqual({ displayName: 'New Name' });
      expect(callArgs[1]).not.toHaveProperty('baseUrl');
    });

    it('should return error on update failure', async () => {
      const request = {
        id: '550e8400-e29b-41d4-a716-446655440099',
        updates: { displayName: 'Test' },
      };

      vi.mocked(services.providerService.updateProvider).mockRejectedValue(
        new Error('Provider not found')
      );

      const handler = handlers[AIChannels.PROVIDER_UPDATE]!;
      const result = await handler(null, request);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Provider not found');
    });
  });

  describe('PROVIDER_REMOVE', () => {
    it('should remove provider with valid ID', async () => {
      const request = { id: '550e8400-e29b-41d4-a716-446655440000' };

      const handler = handlers[AIChannels.PROVIDER_REMOVE]!;
      const result = await handler(null, request);

      expect(result).toEqual({ success: true });
      expect(services.providerService.removeProvider).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000'
      );
    });

    it('should return error when removal fails', async () => {
      const request = { id: '550e8400-e29b-41d4-a716-446655440000' };

      vi.mocked(services.providerService.removeProvider).mockRejectedValue(
        new Error('Cannot remove active provider')
      );

      const handler = handlers[AIChannels.PROVIDER_REMOVE]!;
      const result = await handler(null, request);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Cannot remove active provider');
    });
  });

  describe('PROVIDER_SET_ACTIVE', () => {
    it('should set active provider', async () => {
      const request = { id: '550e8400-e29b-41d4-a716-446655440000' };

      const handler = handlers[AIChannels.PROVIDER_SET_ACTIVE]!;
      const result = await handler(null, request);

      expect(result).toEqual({
        success: true,
        activeProviderId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(services.providerService.setActiveProvider).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000'
      );
    });

    it('should return error when provider not found', async () => {
      const request = { id: '550e8400-e29b-41d4-a716-446655440099' };

      vi.mocked(services.providerService.setActiveProvider).mockRejectedValue(
        new Error('Provider not found')
      );

      const handler = handlers[AIChannels.PROVIDER_SET_ACTIVE]!;
      const result = await handler(null, request);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Provider not found');
    });
  });

  describe('PROVIDER_VALIDATE', () => {
    it('should validate provider successfully', async () => {
      const request = { id: '550e8400-e29b-41d4-a716-446655440000' };

      vi.mocked(services.providerService.validateProvider).mockResolvedValue({
        valid: true,
        status: 'connected',
        models: ['gpt-4', 'gpt-3.5-turbo'],
      });

      const handler = handlers[AIChannels.PROVIDER_VALIDATE]!;
      const result = await handler(null, request);

      expect(result).toEqual({
        success: true,
        status: 'connected',
        models: ['gpt-4', 'gpt-3.5-turbo'],
        error: undefined,
      });
    });

    it('should return validation failure', async () => {
      const request = { id: '550e8400-e29b-41d4-a716-446655440000' };

      vi.mocked(services.providerService.validateProvider).mockResolvedValue({
        valid: false,
        status: 'error',
        error: { code: 'INVALID_KEY', message: 'Invalid API key' },
      });

      const handler = handlers[AIChannels.PROVIDER_VALIDATE]!;
      const result = await handler(null, request);

      expect(result).toEqual({
        success: false,
        status: 'error',
        models: undefined,
        error: {
          code: 'INVALID_KEY',
          message: 'Invalid API key',
        },
      });
    });

    it('should handle validation errors', async () => {
      const request = { id: '550e8400-e29b-41d4-a716-446655440000' };

      vi.mocked(services.providerService.validateProvider).mockRejectedValue(
        new Error('Network error')
      );

      const handler = handlers[AIChannels.PROVIDER_VALIDATE]!;
      const result = await handler(null, request);

      expect(result.success).toBe(false);
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should preserve AI provider error metadata for validation failures', async () => {
      const request = { id: '550e8400-e29b-41d4-a716-446655440000' };

      vi.mocked(services.providerService.validateProvider).mockRejectedValue(
        new AIProviderError('Provider unreachable', 'PROVIDER_UNREACHABLE')
      );

      const handler = handlers[AIChannels.PROVIDER_VALIDATE]!;
      const result = await handler(null, request);

      expect(result).toEqual({
        success: false,
        status: 'error',
        error: {
          code: 'PROVIDER_UNREACHABLE',
          message: 'Provider unreachable',
        },
      });
    });
  });

  describe('SIDECAR_CONFIGURE', () => {
    it('should configure/start sidecar and return lifecycle status', async () => {
      const request = {
        config: {
          modelPath: '/models/test.gguf',
          port: 11470,
        },
      };
      vi.mocked(services.providerService.getActiveProvider).mockResolvedValue({
        ...createMockProviderConfig(),
        type: 'sidecar',
      });

      const handler = handlers[AIChannels.SIDECAR_CONFIGURE]!;
      const result = await handler(null, request);

      expect(services.sidecarService.configure).toHaveBeenCalledWith(request.config);
      expect(services.sidecarService.start).toHaveBeenCalledWith(request.config);
      expect(services.providerService.updateProvider).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        {
          baseUrl: 'http://127.0.0.1:11470',
          sidecarConfig: request.config,
        }
      );
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          status: 'running',
          endpoint: 'http://127.0.0.1:11470',
          pid: 4242,
        })
      );
    });

    it('should return validation error when sidecar config payload is missing', async () => {
      const handler = handlers[AIChannels.SIDECAR_CONFIGURE]!;
      const result = await handler(null, {});

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          status: 'error',
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
      expect(services.sidecarService.configure).not.toHaveBeenCalled();
      expect(services.sidecarService.start).not.toHaveBeenCalled();
    });

    it('should not sync provider endpoint when sidecar start returns stopped status', async () => {
      const request = {
        config: {
          modelPath: '/models/test.gguf',
          port: 11470,
        },
      };

      vi.mocked(services.providerService.getActiveProvider).mockResolvedValue({
        ...createMockProviderConfig(),
        type: 'sidecar',
      });
      vi.mocked(services.sidecarService.start).mockResolvedValue({
        success: true,
        status: 'stopped',
        config: request.config,
      });

      const handler = handlers[AIChannels.SIDECAR_CONFIGURE]!;
      const result = await handler(null, request);

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          status: 'stopped',
        })
      );
      expect(services.providerService.updateProvider).not.toHaveBeenCalled();
    });

    it('should propagate explicit sidecar configure errors', async () => {
      const request = {
        config: {
          modelPath: '/models/test.gguf',
          port: 11470,
        },
      };

      vi.mocked(services.sidecarService.start).mockRejectedValue(
        new AIProviderError('Sidecar failed to start', 'SIDECAR_START_FAILED')
      );

      const handler = handlers[AIChannels.SIDECAR_CONFIGURE]!;
      const result = await handler(null, request);

      expect(result).toEqual({
        success: false,
        status: 'error',
        error: {
          code: 'SIDECAR_START_FAILED',
          message: 'Sidecar failed to start',
        },
      });
    });
  });

  describe('SIDECAR_STATUS', () => {
    it('should return sidecar lifecycle status', async () => {
      const handler = handlers[AIChannels.SIDECAR_STATUS]!;
      const result = await handler();

      expect(services.sidecarService.getStatus).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          status: 'running',
          endpoint: 'http://127.0.0.1:11470',
          pid: 4242,
        })
      );
    });

    it('should return stopped status payload from sidecar service', async () => {
      vi.mocked(services.sidecarService.getStatus).mockReturnValue({
        success: true,
        status: 'stopped',
        config: {
          modelPath: '/models/test.gguf',
          port: 11470,
        },
      });

      const handler = handlers[AIChannels.SIDECAR_STATUS]!;
      const result = await handler();

      expect(result).toEqual({
        success: true,
        status: 'stopped',
        config: {
          modelPath: '/models/test.gguf',
          port: 11470,
        },
      });
    });
  });

  describe('SIDECAR_START', () => {
    it('should start sidecar with provided config and return lifecycle status', async () => {
      const request = {
        config: {
          modelPath: '/models/test.gguf',
          port: 11470,
        },
      };

      const handler = handlers[AIChannels.SIDECAR_START]!;
      const result = await handler(null, request);

      expect(services.sidecarService.start).toHaveBeenCalledWith(request.config);
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          status: 'running',
          endpoint: 'http://127.0.0.1:11470',
          pid: 4242,
        })
      );
    });

    it('should start sidecar without config when request is omitted', async () => {
      const handler = handlers[AIChannels.SIDECAR_START]!;
      const result = await handler();

      expect(services.sidecarService.start).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          status: 'running',
        })
      );
    });

    it('should propagate explicit sidecar start errors', async () => {
      vi.mocked(services.sidecarService.start).mockRejectedValue(
        new AIProviderError('Missing configuration', 'SIDECAR_CONFIG_MISSING')
      );

      const handler = handlers[AIChannels.SIDECAR_START]!;
      const result = await handler();

      expect(result).toEqual({
        success: false,
        status: 'error',
        error: {
          code: 'SIDECAR_CONFIG_MISSING',
          message: 'Missing configuration',
        },
      });
    });
  });

  describe('SIDECAR_STOP', () => {
    it('should stop sidecar and return lifecycle status', async () => {
      const handler = handlers[AIChannels.SIDECAR_STOP]!;
      const result = await handler();

      expect(services.sidecarService.stop).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          status: 'stopped',
        })
      );
    });

    it('should propagate explicit sidecar stop errors', async () => {
      vi.mocked(services.sidecarService.stop).mockRejectedValue(
        new AIProviderError('Sidecar process is not running', 'SIDECAR_NOT_RUNNING')
      );

      const handler = handlers[AIChannels.SIDECAR_STOP]!;
      const result = await handler();

      expect(result).toEqual({
        success: false,
        status: 'error',
        error: {
          code: 'SIDECAR_NOT_RUNNING',
          message: 'Sidecar process is not running',
        },
      });
    });
  });
});

// ============================================================================
// Credential Management Handler Tests
// ============================================================================

describe('Credential Management Handlers', () => {
  let services: AIServices;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockAIServices();
    handlers = {};
    const authorizedEvent = createAuthorizedInvokeEvent(mockWindow);

    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = (...args: unknown[]) => {
        const request = args.length === 0 ? undefined : args[args.length - 1];
        return handler(authorizedEvent, request);
      };
    });

    registerProviderHandlers(services, mockWindow);
  });

  describe('CREDENTIAL_SET', () => {
    it('should set credential successfully', async () => {
      const request = {
        providerId: '550e8400-e29b-41d4-a716-446655440000',
        apiKey: 'sk-test123',
      };

      const handler = handlers[AIChannels.CREDENTIAL_SET]!;
      const result = await handler(null, request);

      expect(result).toEqual({
        success: true,
        storageType: 'persistent',
        keyPreview: '****',
      });
      expect(services.credentialService.setCredential).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        'sk-test123'
      );
    });

    it('should handle credential storage errors', async () => {
      const request = {
        providerId: '550e8400-e29b-41d4-a716-446655440000',
        apiKey: 'sk-test123',
      };

      vi.mocked(services.credentialService.setCredential).mockRejectedValue(
        new Error('Keychain access denied')
      );

      const handler = handlers[AIChannels.CREDENTIAL_SET]!;
      const result = await handler(null, request);

      expect(result.success).toBe(false);
      expect(result.storageType).toBe('session');
      expect(result.error).toBeDefined();
    });
  });

  describe('CREDENTIAL_HAS', () => {
    it('should return true when credential exists', async () => {
      const request = { providerId: '550e8400-e29b-41d4-a716-446655440000' };

      vi.mocked(services.credentialService.hasCredential).mockResolvedValue({
        providerId: '550e8400-e29b-41d4-a716-446655440000',
        storageType: 'persistent',
        keyPreview: '****',
        storedAt: new Date().toISOString(),
      });

      const handler = handlers[AIChannels.CREDENTIAL_HAS]!;
      const result = await handler(null, request);

      expect(result).toEqual({
        exists: true,
        storageType: 'persistent',
        keyPreview: '****',
      });
    });

    it('should return false when credential does not exist', async () => {
      const request = { providerId: '550e8400-e29b-41d4-a716-446655440000' };

      vi.mocked(services.credentialService.hasCredential).mockResolvedValue(null);

      const handler = handlers[AIChannels.CREDENTIAL_HAS]!;
      const result = await handler(null, request);

      expect(result).toEqual({ exists: false });
    });
  });

  describe('CREDENTIAL_CLEAR', () => {
    it('should clear credential successfully', async () => {
      const request = { providerId: '550e8400-e29b-41d4-a716-446655440000' };

      const handler = handlers[AIChannels.CREDENTIAL_CLEAR]!;
      const result = await handler(null, request);

      expect(result).toEqual({ success: true });
      expect(services.credentialService.clearCredential).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000'
      );
    });
  });
});

// ============================================================================
// Capability Detection Handler Tests
// ============================================================================

describe('Capability Detection Handlers', () => {
  let services: AIServices;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockAIServices();
    handlers = {};
    const authorizedEvent = createAuthorizedInvokeEvent(mockWindow);

    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = (...args: unknown[]) => {
        const request = args.length === 0 ? undefined : args[args.length - 1];
        return handler(authorizedEvent, request);
      };
    });

    registerProviderHandlers(services, mockWindow);
  });

  describe('CAPABILITY_GET', () => {
    it('should get model capabilities', async () => {
      const request = {
        providerId: '550e8400-e29b-41d4-a716-446655440000',
        modelId: 'gpt-4',
      };

      const handler = handlers[AIChannels.CAPABILITY_GET]!;
      const result = await handler(null, request);

      expect(result.success).toBe(true);
      expect(result.capabilities).toEqual({
        modelId: 'gpt-4',
        capabilities: ['text-generation'],
        contextWindow: 8192,
        maxOutputTokens: 4096,
        constraints: {},
      });
      expect(services.capabilityService.getCapabilities).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        'gpt-4'
      );
    });

    it('should handle capability fetch errors', async () => {
      const request = {
        providerId: '550e8400-e29b-41d4-a716-446655440000',
        modelId: 'invalid-model',
      };

      vi.mocked(services.capabilityService.getCapabilities).mockRejectedValue(
        new Error('Model not found')
      );

      const handler = handlers[AIChannels.CAPABILITY_GET]!;
      const result = await handler(null, request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should preserve AI provider error details from capability lookups', async () => {
      const request = {
        providerId: '550e8400-e29b-41d4-a716-446655440000',
        modelId: 'gpt-4',
      };

      vi.mocked(services.capabilityService.getCapabilities).mockRejectedValue(
        new AIProviderError('Provider disconnected', 'PROVIDER_DISCONNECTED')
      );

      const handler = handlers[AIChannels.CAPABILITY_GET]!;
      const result = await handler(null, request);

      expect(result).toEqual({
        success: false,
        error: {
          code: 'PROVIDER_DISCONNECTED',
          message: 'Provider disconnected',
        },
      });
    });
  });

  describe('CAPABILITY_LIST_MODELS', () => {
    it('should list available models', async () => {
      const request = { providerId: '550e8400-e29b-41d4-a716-446655440000' };

      const mockModels = [
        { id: 'gpt-4', name: 'GPT-4', capabilities: [ProviderCapability.TEXT_GENERATION] },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          capabilities: [ProviderCapability.TEXT_GENERATION],
        },
      ];

      vi.mocked(services.capabilityService.listModels).mockResolvedValue(mockModels);

      const handler = handlers[AIChannels.CAPABILITY_LIST_MODELS]!;
      const result = await handler(null, request);

      expect(result.success).toBe(true);
      expect(result.models).toEqual([
        { id: 'gpt-4', name: 'GPT-4', capabilities: ['text-generation'] },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', capabilities: ['text-generation'] },
      ]);
    });

    it('should handle model list errors', async () => {
      const request = { providerId: '550e8400-e29b-41d4-a716-446655440000' };

      vi.mocked(services.capabilityService.listModels).mockRejectedValue(new Error('API error'));

      const handler = handlers[AIChannels.CAPABILITY_LIST_MODELS]!;
      const result = await handler(null, request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('CAPABILITY_REFRESH', () => {
    it('should refresh capabilities cache', async () => {
      const request = { providerId: '550e8400-e29b-41d4-a716-446655440000' };

      const handler = handlers[AIChannels.CAPABILITY_REFRESH]!;
      const result = await handler(null, request);

      expect(result).toEqual({ success: true });
      expect(services.capabilityService.refreshCapabilities).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000'
      );
    });

    it('should handle refresh errors', async () => {
      const request = { providerId: '550e8400-e29b-41d4-a716-446655440000' };

      vi.mocked(services.capabilityService.refreshCapabilities).mockRejectedValue(
        new Error('Refresh failed')
      );

      const handler = handlers[AIChannels.CAPABILITY_REFRESH]!;
      const result = await handler(null, request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
