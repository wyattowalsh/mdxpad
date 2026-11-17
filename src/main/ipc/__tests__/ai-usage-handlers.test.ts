/**
 * AI Usage Statistics Handlers Tests
 *
 * Tests usage query, export, and clear handlers.
 * Tests statistics aggregation, time range filtering, and export formats.
 *
 * @see src/main/ipc/ai-usage-handlers.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';

import { AIChannels } from '@shared/ai/ipc-channels';
import type { UsageStats } from '@shared/ai/types';
import { registerUsageHandlers } from '../ai-usage-handlers';
import type { AIServices } from '@main/services/ai';

// ============================================================================
// Mock Setup
// ============================================================================

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// ============================================================================
// Test Constants
// ============================================================================

const PROVIDER_1_UUID = '550e8400-e29b-41d4-a716-446655440001';
const PROVIDER_2_UUID = '550e8400-e29b-41d4-a716-446655440002';

// ============================================================================
// Test Utilities
// ============================================================================

function createMockUsageStats(): UsageStats {
  return {
    timeRange: 'all' as const,
    totalRequests: 100,
    successfulRequests: 95,
    failedRequests: 5,
    totalTokens: 10000,
    inputTokens: 4000,
    outputTokens: 6000,
    estimatedCostUsd: 0.15,
    avgDurationMs: 250,
    byProvider: {
      [PROVIDER_1_UUID]: {
        providerId: PROVIDER_1_UUID,
        requestCount: 60,
        totalTokens: 6000,
        estimatedCostUsd: 0.09,
      },
      [PROVIDER_2_UUID]: {
        providerId: PROVIDER_2_UUID,
        requestCount: 40,
        totalTokens: 4000,
        estimatedCostUsd: 0.06,
      },
    },
    byModel: {
      'gpt-4': {
        modelId: 'gpt-4',
        providerId: PROVIDER_1_UUID,
        requestCount: 50,
        totalTokens: 5000,
        estimatedCostUsd: 0.08,
      },
      'gpt-3.5-turbo': {
        modelId: 'gpt-3.5-turbo',
        providerId: PROVIDER_2_UUID,
        requestCount: 50,
        totalTokens: 5000,
        estimatedCostUsd: 0.07,
      },
    },
    byOperation: {
      'text-generation': {
        operationType: 'text-generation' as const,
        requestCount: 100,
        avgDurationMs: 250,
      },
    },
  };
}

function createMockAIServices(): AIServices {
  return {
    usageService: {
      queryStats: vi.fn().mockResolvedValue(createMockUsageStats()),
      exportData: vi.fn().mockResolvedValue('{"data": "usage stats"}'),
      clearHistory: vi.fn().mockResolvedValue(undefined),
    },
    providerService: {} as any,
    credentialService: {} as any,
    capabilityService: {} as any,
    aiService: {} as any,
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

function createMockIpcEvent(overrides?: {
  senderId?: number;
  senderFrameRoutingId?: number;
}): IpcMainInvokeEvent {
  const senderId = overrides?.senderId ?? 1;
  const senderFrameRoutingId = overrides?.senderFrameRoutingId ?? 10;

  return {
    sender: {
      id: senderId,
      mainFrame: { routingId: 10 },
    },
    senderFrame: {
      routingId: senderFrameRoutingId,
    },
  } as unknown as IpcMainInvokeEvent;
}

// ============================================================================
// Handler Registration Tests
// ============================================================================

describe('registerUsageHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register all usage handlers', () => {
    const services = createMockAIServices();
    const window = createMockWindow();
    registerUsageHandlers(services, window);

    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.USAGE_QUERY, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.USAGE_EXPORT, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.USAGE_CLEAR, expect.any(Function));
  });

  it('should reject unauthorized sender for privileged usage handlers', async () => {
    const services = createMockAIServices();
    const window = createMockWindow();
    registerUsageHandlers(services, window);

    const usageQueryCall = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === AIChannels.USAGE_QUERY);
    const usageQueryHandler = usageQueryCall?.[1] as
      | ((event: IpcMainInvokeEvent, request: unknown) => Promise<unknown>)
      | undefined;

    expect(usageQueryHandler).toBeDefined();

    expect(() =>
      usageQueryHandler!(createMockIpcEvent({ senderId: 2 }), { timeRange: 'all' })
    ).toThrow('Unauthorized IPC sender');
  });
});

// ============================================================================
// Usage Query Handler Tests
// ============================================================================

describe('USAGE_QUERY Handler', () => {
  let services: AIServices;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockAIServices();
    handlers = {};
    const authorizedEvent = createMockIpcEvent();

    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = (event: unknown, request: unknown) =>
        handler((event as IpcMainInvokeEvent) ?? authorizedEvent, request);
    });

    registerUsageHandlers(services, createMockWindow());
  });

  it('should query usage statistics for all time', async () => {
    const request = { timeRange: 'all' as const };

    const handler = handlers[AIChannels.USAGE_QUERY]!;
    const result = await handler(null, request);

    expect(result.success).toBe(true);
    expect(result.stats).toEqual({
      totalRequests: 100,
      successfulRequests: 95,
      failedRequests: 5,
      totalTokens: 10000,
      inputTokens: 4000,
      outputTokens: 6000,
      estimatedCostUsd: 0.15,
      byProvider: expect.arrayContaining([
        expect.objectContaining({
          providerId: PROVIDER_1_UUID,
          requestCount: 60,
          tokenCount: 6000,
          estimatedCostUsd: 0.09,
        }),
      ]),
      byOperation: expect.any(Array),
    });
    expect(services.usageService.queryStats).toHaveBeenCalledWith({
      timeRange: 'all',
    });
  });

  it('should query usage for specific time range', async () => {
    const request = { timeRange: 'day' as const };

    await handlers[AIChannels.USAGE_QUERY]!(null, request);

    expect(services.usageService.queryStats).toHaveBeenCalledWith({
      timeRange: 'day',
    });
  });

  it('should filter by provider ID', async () => {
    const request = {
      timeRange: 'week' as const,
      providerId: PROVIDER_1_UUID,
    };

    await handlers[AIChannels.USAGE_QUERY]!(null, request);

    expect(services.usageService.queryStats).toHaveBeenCalledWith({
      timeRange: 'week',
      providerId: PROVIDER_1_UUID,
    });
  });

  it('should filter by operation type', async () => {
    const request = {
      timeRange: 'month' as const,
      operationType: 'text-generation' as const,
    };

    await handlers[AIChannels.USAGE_QUERY]!(null, request);

    expect(services.usageService.queryStats).toHaveBeenCalledWith({
      timeRange: 'month',
      operationType: 'text-generation',
    });
  });

  it('should filter out undefined query parameters', async () => {
    const request = {
      timeRange: 'all' as const,
      providerId: undefined,
      operationType: undefined,
    };

    await handlers[AIChannels.USAGE_QUERY]!(null, request);

    const callArgs = vi.mocked(services.usageService.queryStats).mock.calls[0]![0];
    expect(callArgs).toEqual({ timeRange: 'all' });
    expect(callArgs).not.toHaveProperty('providerId');
    expect(callArgs).not.toHaveProperty('operationType');
  });

  it('should include provider breakdown in response', async () => {
    const request = { timeRange: 'all' as const };

    const handler = handlers[AIChannels.USAGE_QUERY]!;
    const result = await handler(null, request);

    expect(result.stats?.byProvider).toHaveLength(2);
    expect(result.stats?.byProvider).toEqual(
      expect.arrayContaining([
        {
          providerId: PROVIDER_1_UUID,
          providerName: PROVIDER_1_UUID,
          requestCount: 60,
          tokenCount: 6000,
          estimatedCostUsd: 0.09,
        },
        {
          providerId: PROVIDER_2_UUID,
          providerName: PROVIDER_2_UUID,
          requestCount: 40,
          tokenCount: 4000,
          estimatedCostUsd: 0.06,
        },
      ])
    );
  });

  it('should return empty byOperation when no operation data exists', async () => {
    const emptyStats = {
      ...createMockUsageStats(),
      byOperation: {},
    };

    vi.mocked(services.usageService.queryStats).mockResolvedValue(emptyStats);

    const request = { timeRange: 'all' as const };
    const handler = handlers[AIChannels.USAGE_QUERY]!;
    const result = await handler(null, request);

    expect(result.stats?.byOperation).toEqual([]);
  });

  it('should aggregate byOperation from usage records', async () => {
    const request = { timeRange: 'all' as const };
    const handler = handlers[AIChannels.USAGE_QUERY]!;
    const result = await handler(null, request);

    expect(result.stats?.byOperation).toEqual([
      {
        operationType: 'text-generation',
        requestCount: 100,
        avgDurationMs: 250,
      },
    ]);
  });

  it('should return error false on query failure', async () => {
    const request = { timeRange: 'all' as const };

    vi.mocked(services.usageService.queryStats).mockRejectedValue(new Error('Database error'));

    const handler = handlers[AIChannels.USAGE_QUERY]!;
    const result = await handler(null, request);

    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Usage Export Handler Tests
// ============================================================================

describe('USAGE_EXPORT Handler', () => {
  let services: AIServices;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockAIServices();
    handlers = {};
    const authorizedEvent = createMockIpcEvent();

    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = (event: unknown, request: unknown) =>
        handler((event as IpcMainInvokeEvent) ?? authorizedEvent, request);
    });

    registerUsageHandlers(services, createMockWindow());
  });

  it('should export usage data as JSON by default', async () => {
    const request = { timeRange: 'all' as const };

    const handler = handlers[AIChannels.USAGE_EXPORT]!;
    const result = await handler(null, request);

    expect(result.success).toBe(true);
    expect(result.data).toBe('{"data": "usage stats"}');
    expect(result.filename).toMatch(/^mdxpad-usage-all-\d+\.json$/);
    expect(services.usageService.exportData).toHaveBeenCalledWith('all', 'json');
  });

  it('should export as CSV when specified', async () => {
    const request = {
      timeRange: 'month' as const,
      format: 'csv' as const,
    };

    vi.mocked(services.usageService.exportData).mockResolvedValue('col1,col2\nval1,val2');

    const handler = handlers[AIChannels.USAGE_EXPORT]!;
    const result = await handler(null, request);

    expect(result.success).toBe(true);
    expect(result.filename).toMatch(/\.csv$/);
    expect(services.usageService.exportData).toHaveBeenCalledWith('month', 'csv');
  });

  it('should generate unique filename with timestamp', async () => {
    const request = { timeRange: 'day' as const };

    const handler1 = handlers[AIChannels.USAGE_EXPORT]!;
    const result1 = await handler1(null, request);

    // Wait a bit to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 5));

    const handler2 = handlers[AIChannels.USAGE_EXPORT]!;
    const result2 = await handler2(null, request);

    expect(result1.filename).not.toBe(result2.filename);
  });

  it('should return error on export failure', async () => {
    const request = { timeRange: 'all' as const };

    vi.mocked(services.usageService.exportData).mockRejectedValue(new Error('Export failed'));

    const handler = handlers[AIChannels.USAGE_EXPORT]!;
    const result = await handler(null, request);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Export failed');
  });
});

// ============================================================================
// Usage Clear Handler Tests
// ============================================================================

describe('USAGE_CLEAR Handler', () => {
  let services: AIServices;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockAIServices();
    handlers = {};
    const authorizedEvent = createMockIpcEvent();

    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = (event: unknown, request: unknown) =>
        handler((event as IpcMainInvokeEvent) ?? authorizedEvent, request);
    });

    registerUsageHandlers(services, createMockWindow());
  });

  it('should clear all usage history', async () => {
    const request = {};

    const handler = handlers[AIChannels.USAGE_CLEAR]!;
    const result = await handler(null, request);

    expect(result).toEqual({
      success: true,
      deletedCount: 0,
    });
    expect(services.usageService.clearHistory).toHaveBeenCalledWith(undefined);
  });

  it('should clear usage older than specific date', async () => {
    const olderThan = '2024-01-01T00:00:00.000Z';
    const request = { olderThan };

    await handlers[AIChannels.USAGE_CLEAR]!(null, request);

    expect(services.usageService.clearHistory).toHaveBeenCalledWith(new Date(olderThan));
  });

  it('should return error on clear failure', async () => {
    const request = {};

    vi.mocked(services.usageService.clearHistory).mockRejectedValue(new Error('Clear failed'));

    const handler = handlers[AIChannels.USAGE_CLEAR]!;
    const result = await handler(null, request);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Clear failed');
  });
});
