/**
 * AI Generation Handlers Tests
 *
 * Tests text generation (streaming and non-streaming), embedding, and image generation handlers.
 * Tests streaming backpressure control, MAX_BUFFER_SIZE overflow protection, and error handling.
 *
 * @see src/main/ipc/ai-generation-handlers.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain, type IpcMainInvokeEvent, type BrowserWindow } from 'electron';

import { AIChannels } from '@shared/ai/ipc-channels';
import { registerGenerationHandlers } from '../ai-generation-handlers';
import type { AIServices } from '@main/services/ai';
import type { StreamController } from '@main/services/ai/ai-types';

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

function createMockAIServices(): AIServices {
  return {
    aiService: {
      generateText: vi.fn().mockResolvedValue({
        text: 'Generated response',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      }),
      streamText: vi.fn().mockResolvedValue({
        abort: vi.fn(),
        completion: Promise.resolve({
          text: 'Complete stream',
          usage: { inputTokens: 10, outputTokens: 50, totalTokens: 60 },
        }),
      }),
      generateEmbedding: vi.fn().mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        dimensions: 3,
      }),
      generateImage: vi.fn().mockResolvedValue({
        imageUrl: 'https://example.com/image.png',
        imageBase64: 'base64data',
      }),
    },
    providerService: {} as any,
    credentialService: {} as any,
    capabilityService: {} as any,
    usageService: {} as any,
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

function createMockIpcEvent(
  overrides?: { senderId?: number; senderFrameRoutingId?: number }
): IpcMainInvokeEvent {
  const senderId = overrides?.senderId ?? 1;
  const senderFrameRoutingId = overrides?.senderFrameRoutingId ?? 10;

  return {
    sender: {
      id: senderId,
      mainFrame: { routingId: 10 },
      send: vi.fn(),
      isDestroyed: vi.fn().mockReturnValue(false),
    },
    senderFrame: {
      routingId: senderFrameRoutingId,
    },
  } as unknown as IpcMainInvokeEvent;
}

// ============================================================================
// Handler Registration Tests
// ============================================================================

describe('registerGenerationHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register all generation handlers', () => {
    const services = createMockAIServices();
    const window = createMockWindow();
    registerGenerationHandlers(services, window);

    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.GENERATE_TEXT, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.GENERATE_STREAM, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.CANCEL_STREAM, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.GENERATE_EMBED, expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith(AIChannels.GENERATE_IMAGE, expect.any(Function));
  });

  it('should reject unauthorized sender for privileged generation handlers', async () => {
    const services = createMockAIServices();
    const window = createMockWindow();
    registerGenerationHandlers(services, window);

    const generateTextCall = vi
      .mocked(ipcMain.handle)
      .mock.calls
      .find(([channel]) => channel === AIChannels.GENERATE_TEXT);
    const generateTextHandler = generateTextCall?.[1] as
      | ((event: IpcMainInvokeEvent, request: unknown) => Promise<unknown>)
      | undefined;

    expect(generateTextHandler).toBeDefined();

    expect(() =>
      generateTextHandler!(
        createMockIpcEvent({ senderId: 2 }),
        { prompt: 'Hello, world!' }
      )
    ).toThrow('Unauthorized IPC sender');
  });
});

// ============================================================================
// Text Generation Handler Tests
// ============================================================================

describe('GENERATE_TEXT Handler', () => {
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

    registerGenerationHandlers(services, createMockWindow());
  });

  it('should generate text successfully', async () => {
    const request = {
      prompt: 'Hello, world!',
    };

    const handler = handlers[AIChannels.GENERATE_TEXT]!;
    const result = await handler(null, request);

    expect(result).toEqual({
      success: true,
      text: 'Generated response',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    });
    expect(services.aiService.generateText).toHaveBeenCalledWith({
      prompt: 'Hello, world!',
    });
  });

  it('should pass optional parameters to service', async () => {
    const request = {
      prompt: 'Test prompt',
      modelId: 'gpt-4',
      maxTokens: 1000,
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant',
    };

    await handlers[AIChannels.GENERATE_TEXT]!(null, request);

    expect(services.aiService.generateText).toHaveBeenCalledWith({
      prompt: 'Test prompt',
      modelId: 'gpt-4',
      maxTokens: 1000,
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant',
    });
  });

  it('should filter out undefined optional parameters', async () => {
    const request = {
      prompt: 'Test',
      modelId: undefined,
      maxTokens: 500,
    };

    await handlers[AIChannels.GENERATE_TEXT]!(null, request);

    const callArgs = vi.mocked(services.aiService.generateText).mock.calls[0]![0];
    expect(callArgs).toEqual({
      prompt: 'Test',
      maxTokens: 500,
    });
    expect(callArgs).not.toHaveProperty('modelId');
  });

  it('should return error on validation failure', async () => {
    const invalidRequest = {};

    const handler = handlers[AIChannels.GENERATE_TEXT]!;
    const result = await handler(null, invalidRequest);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle generation errors', async () => {
    const request = { prompt: 'Test' };

    vi.mocked(services.aiService.generateText).mockRejectedValue(
      new Error('API rate limit exceeded')
    );

    const handler = handlers[AIChannels.GENERATE_TEXT]!;
    const result = await handler(null, request);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('API rate limit exceeded');
  });
});

// ============================================================================
// Stream Generation Handler Tests
// ============================================================================

describe('GENERATE_STREAM Handler', () => {
  let services: AIServices;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    services = createMockAIServices();
    handlers = {};
    const authorizedEvent = createMockIpcEvent();

    vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = (event: unknown, request: unknown) =>
        handler((event as IpcMainInvokeEvent) ?? authorizedEvent, request);
    });

    registerGenerationHandlers(services, createMockWindow());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize stream and return streamId', async () => {
    const event = createMockIpcEvent();
    const request = { prompt: 'Stream test' };

    const mockController: StreamController = {
      abort: vi.fn(),
      completion: Promise.resolve({
        text: 'Complete',
        usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
        modelId: 'gpt-4',
        durationMs: 100,
      }),
    };

    vi.mocked(services.aiService.streamText).mockResolvedValue(mockController);

    const handler = handlers[AIChannels.GENERATE_STREAM]!;
    const result = await handler(event, request);

    expect(result.success).toBe(true);
    expect(result.streamId).toBeDefined();
    expect(typeof result.streamId).toBe('string');
  });

  it('should batch stream chunks with 50ms interval', async () => {
    const event = createMockIpcEvent();
    const request = { prompt: 'Batch test' };

    let onChunk: ((chunk: string) => void) | undefined;
    const mockController: StreamController = {
      abort: vi.fn(),
      completion: new Promise(() => {}), // Never resolves for this test
    };

    vi.mocked(services.aiService.streamText).mockImplementation(async (_req, callback) => {
      onChunk = callback;
      return mockController;
    });

    await handlers[AIChannels.GENERATE_STREAM]!(event, request);

    // Send multiple chunks quickly
    onChunk?.('Hello');
    onChunk?.(' ');
    onChunk?.('world');

    // No sends yet (waiting for batch interval)
    expect(event.sender.send).not.toHaveBeenCalled();

    // Advance timer to trigger batch flush
    vi.advanceTimersByTime(50);

    // Should have sent batched chunks
    expect(event.sender.send).toHaveBeenCalledWith(AIChannels.STREAM_CHUNK, {
      streamId: expect.any(String),
      chunk: 'Hello world',
      isComplete: false,
    });
  });

  it('should flush buffer when MAX_BUFFER_SIZE is reached', async () => {
    const event = createMockIpcEvent();
    const request = { prompt: 'Overflow test' };

    let onChunk: ((chunk: string) => void) | undefined;
    const mockController: StreamController = {
      abort: vi.fn(),
      completion: new Promise(() => {}),
    };

    vi.mocked(services.aiService.streamText).mockImplementation(async (_req, callback) => {
      onChunk = callback;
      return mockController;
    });

    await handlers[AIChannels.GENERATE_STREAM]!(event, request);

    // Send 100 chunks to hit MAX_BUFFER_SIZE
    for (let i = 0; i < 100; i++) {
      onChunk?.('x');
    }

    // Should have flushed immediately without waiting for interval
    expect(event.sender.send).toHaveBeenCalled();
  });

  it('should not send chunks if sender is destroyed', async () => {
    const event = createMockIpcEvent();
    const request = { prompt: 'Destroyed test' };

    let onChunk: ((chunk: string) => void) | undefined;
    const mockController: StreamController = {
      abort: vi.fn(),
      completion: new Promise(() => {}),
    };

    vi.mocked(services.aiService.streamText).mockImplementation(async (_req, callback) => {
      onChunk = callback;
      return mockController;
    });

    await handlers[AIChannels.GENERATE_STREAM]!(event, request);

    // Mark sender as destroyed
    vi.mocked(event.sender.isDestroyed).mockReturnValue(true);

    onChunk?.('test');
    vi.advanceTimersByTime(50);

    // Should not send to destroyed sender
    expect(event.sender.send).not.toHaveBeenCalled();
  });

  it('should send completion event when stream finishes', async () => {
    const event = createMockIpcEvent();
    const request = { prompt: 'Completion test' };

    const mockController: StreamController = {
      abort: vi.fn(),
      completion: Promise.resolve({
        text: 'Complete',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        modelId: 'gpt-4',
        durationMs: 200,
      }),
    };

    vi.mocked(services.aiService.streamText).mockResolvedValue(mockController);

    const handler = handlers[AIChannels.GENERATE_STREAM]!;
    const result = await handler(event, request);
    const streamId = result.streamId;

    // Wait for completion
    await mockController.completion;
    await vi.runAllTimersAsync();

    // Should have sent completion event
    expect(event.sender.send).toHaveBeenCalledWith(AIChannels.STREAM_COMPLETE, {
      streamId,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    });
  });

  it('should send error event on stream failure', async () => {
    const event = createMockIpcEvent();
    const request = { prompt: 'Error test' };

    const mockController: StreamController = {
      abort: vi.fn(),
      completion: Promise.reject(new Error('Stream error')),
    };

    vi.mocked(services.aiService.streamText).mockResolvedValue(mockController);

    const handler = handlers[AIChannels.GENERATE_STREAM]!;
    const result = await handler(event, request);
    const streamId = result.streamId;

    // Wait for error
    await expect(mockController.completion).rejects.toThrow();
    await vi.runAllTimersAsync();

    // Should have sent error event
    expect(event.sender.send).toHaveBeenCalledWith(AIChannels.STREAM_ERROR, {
      streamId,
      error: expect.objectContaining({
        message: 'Stream error',
      }),
    });
  });

  it('should return error on initialization failure', async () => {
    const event = createMockIpcEvent();
    const request = { prompt: 'Init error' };

    vi.mocked(services.aiService.streamText).mockRejectedValue(
      new Error('Failed to start stream')
    );

    const handler = handlers[AIChannels.GENERATE_STREAM]!;
    const result = await handler(event, request);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Failed to start stream');
  });

  it('should cancel an active stream and emit deterministic terminal error', async () => {
    const event = createMockIpcEvent();
    const request = { prompt: 'Cancel test' };

    const abortSpy = vi.fn();
    const mockController: StreamController = {
      abort: abortSpy,
      completion: new Promise(() => {}),
    };

    vi.mocked(services.aiService.streamText).mockResolvedValue(mockController);

    const startResult = await handlers[AIChannels.GENERATE_STREAM]!(event, request);
    const streamId = startResult.streamId;
    const cancelResult = await handlers[AIChannels.CANCEL_STREAM]!(event, { streamId });

    expect(cancelResult).toEqual({ success: true });
    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(event.sender.send).toHaveBeenCalledWith(AIChannels.STREAM_ERROR, {
      streamId,
      error: expect.objectContaining({
        code: 'STREAM_CANCELLED',
      }),
    });
  });

  it('should return stream not found for cancel of unknown stream', async () => {
    const event = createMockIpcEvent();
    const result = await handlers[AIChannels.CANCEL_STREAM]!(event, {
      streamId: '00000000-0000-4000-8000-000000000000',
    });

    expect(result).toEqual({
      success: false,
      error: expect.objectContaining({
        code: 'STREAM_NOT_FOUND',
      }),
    });
  });

  it('should emit timeout terminal error and abort stalled stream', async () => {
    const event = createMockIpcEvent();
    const request = { prompt: 'Timeout test' };

    const abortSpy = vi.fn();
    const mockController: StreamController = {
      abort: abortSpy,
      completion: new Promise(() => {}),
    };

    vi.mocked(services.aiService.streamText).mockResolvedValue(mockController);

    const startResult = await handlers[AIChannels.GENERATE_STREAM]!(event, request);
    const streamId = startResult.streamId;

    await vi.advanceTimersByTimeAsync(60_000);

    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(event.sender.send).toHaveBeenCalledWith(AIChannels.STREAM_ERROR, {
      streamId,
      error: expect.objectContaining({
        code: 'STREAM_TIMEOUT',
      }),
    });
  });

  it('should settle stream exactly once when canceled before late completion failure', async () => {
    const event = createMockIpcEvent();
    const request = { prompt: 'Settle once test' };

    let rejectCompletion: ((error: unknown) => void) | undefined;
    const completion = new Promise<{
      text: string;
      usage: { inputTokens: number; outputTokens: number; totalTokens: number };
      modelId: string;
      durationMs: number;
    }>((_resolve, reject) => {
      rejectCompletion = reject;
    });

    const mockController: StreamController = {
      abort: vi.fn(),
      completion,
    };

    vi.mocked(services.aiService.streamText).mockResolvedValue(mockController);

    const startResult = await handlers[AIChannels.GENERATE_STREAM]!(event, request);
    const streamId = startResult.streamId;
    await handlers[AIChannels.CANCEL_STREAM]!(event, { streamId });

    rejectCompletion?.(new Error('late completion failure'));
    await Promise.resolve();
    await Promise.resolve();

    const streamErrorCalls = vi
      .mocked(event.sender.send)
      .mock.calls
      .filter(([channel]) => channel === AIChannels.STREAM_ERROR);
    expect(streamErrorCalls).toHaveLength(1);
  });
});

// ============================================================================
// Embedding Generation Handler Tests
// ============================================================================

describe('GENERATE_EMBED Handler', () => {
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

    registerGenerationHandlers(services, createMockWindow());
  });

  it('should generate embeddings successfully', async () => {
    const request = {
      texts: ['Hello', 'World'],
    };

    const handler = handlers[AIChannels.GENERATE_EMBED]!;
    const result = await handler(null, request);

    expect(result).toEqual({
      success: true,
      embeddings: [[0.1, 0.2, 0.3]],
      dimensions: 3,
    });
    expect(services.aiService.generateEmbedding).toHaveBeenCalledWith({
      texts: ['Hello', 'World'],
    });
  });

  it('should pass modelId when provided', async () => {
    const request = {
      texts: ['Test'],
      modelId: 'text-embedding-3-small',
    };

    await handlers[AIChannels.GENERATE_EMBED]!(null, request);

    expect(services.aiService.generateEmbedding).toHaveBeenCalledWith({
      texts: ['Test'],
      modelId: 'text-embedding-3-small',
    });
  });

  it('should return error on embedding failure', async () => {
    const request = { texts: ['Test'] };

    vi.mocked(services.aiService.generateEmbedding).mockRejectedValue(
      new Error('Embedding service unavailable')
    );

    const handler = handlers[AIChannels.GENERATE_EMBED]!;
    const result = await handler(null, request);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Embedding service unavailable');
  });
});

// ============================================================================
// Image Generation Handler Tests
// ============================================================================

describe('GENERATE_IMAGE Handler', () => {
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

    registerGenerationHandlers(services, createMockWindow());
  });

  it('should generate image successfully', async () => {
    const request = {
      prompt: 'A cat sitting on a mat',
    };

    const handler = handlers[AIChannels.GENERATE_IMAGE]!;
    const result = await handler(null, request);

    expect(result).toEqual({
      success: true,
      imageUrl: 'https://example.com/image.png',
      imageBase64: 'base64data',
    });
    expect(services.aiService.generateImage).toHaveBeenCalledWith({
      prompt: 'A cat sitting on a mat',
    });
  });

  it('should pass all image options', async () => {
    const request = {
      prompt: 'Test image',
      size: '1024x1024' as const,
      quality: 'hd' as const,
      style: 'vivid' as const,
    };

    await handlers[AIChannels.GENERATE_IMAGE]!(null, request);

    expect(services.aiService.generateImage).toHaveBeenCalledWith({
      prompt: 'Test image',
      size: '1024x1024',
      quality: 'hd',
      style: 'vivid',
    });
  });

  it('should filter out undefined options', async () => {
    const request = {
      prompt: 'Test',
      size: '512x512' as const,
      quality: undefined,
    };

    await handlers[AIChannels.GENERATE_IMAGE]!(null, request);

    const callArgs = vi.mocked(services.aiService.generateImage).mock.calls[0]![0];
    expect(callArgs).toEqual({
      prompt: 'Test',
      size: '512x512',
    });
    expect(callArgs).not.toHaveProperty('quality');
  });

  it('should return error on image generation failure', async () => {
    const request = { prompt: 'Test' };

    vi.mocked(services.aiService.generateImage).mockRejectedValue(
      new Error('Content policy violation')
    );

    const handler = handlers[AIChannels.GENERATE_IMAGE]!;
    const result = await handler(null, request);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Content policy violation');
  });
});
