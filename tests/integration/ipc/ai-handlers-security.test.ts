import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { BrowserWindow } from 'electron';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

import { ipcMain } from 'electron';
import { AIChannels } from '@shared/ai/ipc-channels';
import type { AIServices } from '@main/services/ai';
import { registerAIHandlers } from '@main/ipc/ai-handlers';

const mockIpcMain = ipcMain as unknown as {
  handle: Mock;
};

function createMockWindow(): BrowserWindow {
  return {
    webContents: {
      id: 42,
      mainFrame: { routingId: 99 },
    },
  } as unknown as BrowserWindow;
}

function createInvokeEvent(
  window: BrowserWindow,
  overrides?: { senderId?: number; senderFrameRoutingId?: number }
) {
  return {
    sender: {
      id: overrides?.senderId ?? window.webContents.id,
      mainFrame: { routingId: window.webContents.mainFrame.routingId },
    },
    senderFrame: {
      routingId: overrides?.senderFrameRoutingId ?? window.webContents.mainFrame.routingId,
    },
  };
}

describe('AI IPC sender authorization integration', () => {
  let registeredHandlers: Map<string, (event: unknown, args?: unknown) => Promise<unknown>>;
  let mockWindow: BrowserWindow;
  let services: AIServices;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers = new Map();
    mockWindow = createMockWindow();

    mockIpcMain.handle.mockImplementation(
      (channel: string, handler: (event: unknown, args?: unknown) => Promise<unknown>) => {
        registeredHandlers.set(channel, handler);
      }
    );

    services = {
      providerService: {
        getProviders: vi.fn().mockResolvedValue([]),
        getActiveProvider: vi.fn().mockResolvedValue(null),
      },
      aiService: {
        generateText: vi.fn().mockResolvedValue({
          text: 'Generated text',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        }),
      },
      usageService: {
        queryStats: vi.fn().mockResolvedValue({
          totalRequests: 1,
          successfulRequests: 1,
          failedRequests: 0,
          totalTokens: 2,
          inputTokens: 1,
          outputTokens: 1,
          estimatedCostUsd: 0.001,
          byProvider: {
            provider1: {
              providerId: 'provider-1',
              requestCount: 1,
              totalTokens: 2,
              estimatedCostUsd: 0.001,
            },
          },
        }),
      },
      credentialService: {},
      capabilityService: {},
      onboardingService: {},
    } as unknown as AIServices;

    registerAIHandlers(services, mockWindow);
  });

  it('registers channels across provider/generation/usage domains', () => {
    expect(registeredHandlers.has(AIChannels.PROVIDER_LIST)).toBe(true);
    expect(registeredHandlers.has(AIChannels.GENERATE_TEXT)).toBe(true);
    expect(registeredHandlers.has(AIChannels.USAGE_QUERY)).toBe(true);
  });

  it('rejects unauthorized sender for provider channel', () => {
    const handler = registeredHandlers.get(AIChannels.PROVIDER_LIST);
    const unauthorizedEvent = createInvokeEvent(mockWindow, {
      senderId: mockWindow.webContents.id + 1,
    });

    expect(() => handler!(unauthorizedEvent, undefined)).toThrow('Unauthorized IPC sender');
    expect(services.providerService.getProviders).not.toHaveBeenCalled();
  });

  it('rejects non-main-frame sender for generation channel', () => {
    const handler = registeredHandlers.get(AIChannels.GENERATE_TEXT);
    const unauthorizedEvent = createInvokeEvent(mockWindow, {
      senderFrameRoutingId: mockWindow.webContents.mainFrame.routingId + 1,
    });

    expect(() =>
      handler!(unauthorizedEvent, { prompt: 'Generate this text' })
    ).toThrow('Unauthorized IPC sender');
    expect(services.aiService.generateText).not.toHaveBeenCalled();
  });

  it('rejects unauthorized sender for usage channel', () => {
    const handler = registeredHandlers.get(AIChannels.USAGE_QUERY);
    const unauthorizedEvent = createInvokeEvent(mockWindow, {
      senderId: mockWindow.webContents.id + 10,
    });

    expect(() => handler!(unauthorizedEvent, { timeRange: 'day' })).toThrow(
      'Unauthorized IPC sender'
    );
    expect(services.usageService.queryStats).not.toHaveBeenCalled();
  });

  it('allows authorized sender for representative channels', async () => {
    const event = createInvokeEvent(mockWindow);

    const providerListHandler = registeredHandlers.get(AIChannels.PROVIDER_LIST);
    const providerList = await providerListHandler!(event, undefined);
    expect(providerList).toEqual({ providers: [], activeProviderId: null });

    const generateTextHandler = registeredHandlers.get(AIChannels.GENERATE_TEXT);
    const textResult = await generateTextHandler!(event, { prompt: 'Hello' });
    expect(textResult).toMatchObject({ success: true, text: 'Generated text' });

    const usageQueryHandler = registeredHandlers.get(AIChannels.USAGE_QUERY);
    const usageResult = await usageQueryHandler!(event, { timeRange: 'day' });
    expect(usageResult).toMatchObject({
      success: true,
      stats: { totalRequests: 1, successfulRequests: 1 },
    });
  });
});
