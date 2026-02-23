/**
 * AI Generation IPC Handlers
 *
 * Handles text generation (non-streaming and streaming), embedding generation,
 * and image generation.
 *
 * @module src/main/ipc/ai-generation-handlers
 */

import { ipcMain, type IpcMainInvokeEvent, type BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';

import { AIChannels } from '@shared/ai/ipc-channels';
import * as schemas from '@shared/ai/schemas';
import { AIProviderError } from '@shared/ai/errors';
import type { AIServices } from '@main/services/ai';
import type {
  TextGenerationRequest,
  EmbeddingRequest,
  ImageGenerationRequest,
} from '@main/services/ai';

import { toErrorResponse, filterUndefined } from './ai-handler-utils';
import { assertAuthorizedIpcSender } from './ipc-sender-authorization';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum buffer size for stream chunks before forced flush (P1-3 fix) */
const MAX_BUFFER_SIZE = 100;
const STREAM_WATCHDOG_TIMEOUT_MS = 60_000;

interface ActiveStream {
  cancel: () => void;
}

const activeStreams = new Map<string, ActiveStream>();

// =============================================================================
// REQUEST BUILDERS
// =============================================================================

/**
 * Builds a text generation request filtering out undefined values.
 */
function buildTextRequest(request: {
  prompt: string;
  modelId?: string | undefined;
  maxTokens?: number | undefined;
  temperature?: number | undefined;
  systemPrompt?: string | undefined;
}): TextGenerationRequest {
  return filterUndefined(request) as TextGenerationRequest;
}

/**
 * Builds an embedding request filtering out undefined values.
 */
function buildEmbedRequest(request: {
  texts: string[];
  modelId?: string | undefined;
}): EmbeddingRequest {
  return filterUndefined(request) as EmbeddingRequest;
}

/**
 * Builds an image generation request filtering out undefined values.
 */
function buildImageRequest(request: {
  prompt: string;
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792' | undefined;
  quality?: 'standard' | 'hd' | undefined;
  style?: 'natural' | 'vivid' | undefined;
}): ImageGenerationRequest {
  return filterUndefined(request) as ImageGenerationRequest;
}

// =============================================================================
// HANDLER IMPLEMENTATIONS
// =============================================================================

/**
 * Handles GENERATE_TEXT: Generate text (non-streaming).
 */
async function handleGenerateText(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.GenerateTextResponseSchemaType> {
  try {
    const request = schemas.GenerateTextRequestSchema.parse(rawRequest);
    const result = await services.aiService.generateText(
      buildTextRequest(request)
    );

    return schemas.GenerateTextResponseSchema.parse({
      success: true,
      text: result.text,
      usage: result.usage,
    });
  } catch (error) {
    return schemas.GenerateTextResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles GENERATE_STREAM: Generate text with streaming.
 * Returns immediately with streamId, sends chunks via events.
 *
 * Includes MAX_BUFFER_SIZE guard: if the chunk buffer exceeds 100 entries
 * between flush intervals, it is flushed immediately to prevent unbounded
 * memory growth.
 */
// eslint-disable-next-line max-lines-per-function
async function handleGenerateStream(
  services: AIServices,
  event: IpcMainInvokeEvent,
  rawRequest: unknown
): Promise<schemas.StreamInitResponseSchemaType> {
  try {
    const request = schemas.GenerateStreamRequestSchema.parse(rawRequest);
    const streamId = randomUUID();
    const sender = event.sender;

    // Batch streaming chunks with backpressure control
    const chunkBuffer: string[] = [];
    let flushIntervalId: NodeJS.Timeout | null = null;
    let watchdogTimeoutId: NodeJS.Timeout | null = null;
    let abortStream: (() => void) | null = null;
    let settled = false;

    const flushChunks = () => {
      if (chunkBuffer.length > 0 && !sender.isDestroyed()) {
        sender.send(AIChannels.STREAM_CHUNK, {
          streamId,
          chunk: chunkBuffer.join(''),
          isComplete: false,
        });
        chunkBuffer.length = 0;
      }
    };

    const cleanup = (shouldFlush = false) => {
      if (flushIntervalId) {
        clearInterval(flushIntervalId);
        flushIntervalId = null;
      }
      if (watchdogTimeoutId) {
        clearTimeout(watchdogTimeoutId);
        watchdogTimeoutId = null;
      }
      if (shouldFlush) {
        flushChunks();
      }
      activeStreams.delete(streamId);
    };

    const settleWithComplete = (usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    }) => {
      if (settled) return;
      settled = true;
      cleanup(true);
      if (!sender.isDestroyed()) {
        sender.send(AIChannels.STREAM_COMPLETE, {
          streamId,
          usage,
        });
      }
    };

    const settleWithError = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup(true);
      if (!sender.isDestroyed()) {
        sender.send(AIChannels.STREAM_ERROR, {
          streamId,
          error: toErrorResponse(error),
        });
      }
    };

    const controller = await services.aiService.streamText(
      buildTextRequest(request),
      (chunk) => {
        if (settled) {
          return;
        }
        // Check if sender is still valid before buffering
        if (sender.isDestroyed()) {
          settled = true;
          cleanup(false);
          abortStream?.();
          return;
        }
        chunkBuffer.push(chunk);

        // P1-3 fix: flush on overflow to prevent unbounded memory growth
        if (chunkBuffer.length >= MAX_BUFFER_SIZE) {
          flushChunks();
        }
        if (watchdogTimeoutId) {
          clearTimeout(watchdogTimeoutId);
        }
        watchdogTimeoutId = setTimeout(() => {
          abortStream?.();
          settleWithError(
            new AIProviderError(
              'Stream timed out waiting for data',
              'STREAM_TIMEOUT'
            )
          );
        }, STREAM_WATCHDOG_TIMEOUT_MS);
      }
    );
    abortStream = controller.abort;

    // Set up flush interval (50ms batching)
    flushIntervalId = setInterval(flushChunks, 50);

    watchdogTimeoutId = setTimeout(() => {
      abortStream();
      settleWithError(
        new AIProviderError(
          'Stream timed out waiting for data',
          'STREAM_TIMEOUT'
        )
      );
    }, STREAM_WATCHDOG_TIMEOUT_MS);

    activeStreams.set(streamId, {
      cancel: () => {
        settleWithError(
          new AIProviderError(
            'Stream cancelled by client',
            'STREAM_CANCELLED'
          )
        );
        abortStream();
      },
    });

    void controller.completion
      .then((result) => {
        settleWithComplete(result.usage);
      })
      .catch((error: unknown) => {
        settleWithError(error);
      });

    return schemas.StreamInitResponseSchema.parse({
      success: true,
      streamId,
    });
  } catch (error) {
    return schemas.StreamInitResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles CANCEL_STREAM: Cancel active stream by streamId.
 */
function handleCancelStream(
  rawRequest: unknown
): Promise<schemas.StreamCancelResponseSchemaType> {
  try {
    const request = schemas.StreamCancelRequestSchema.parse(rawRequest);
    const stream = activeStreams.get(request.streamId);
    if (!stream) {
      return Promise.resolve(schemas.StreamCancelResponseSchema.parse({
        success: false,
        error: {
          code: 'STREAM_NOT_FOUND',
          message: 'Stream not found or already settled',
        },
      }));
    }

    stream.cancel();
    return Promise.resolve(schemas.StreamCancelResponseSchema.parse({
      success: true,
    }));
  } catch (error) {
    return Promise.resolve(schemas.StreamCancelResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    }));
  }
}

/**
 * Handles GENERATE_EMBED: Generate text embeddings.
 */
async function handleGenerateEmbed(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.GenerateEmbedResponseSchemaType> {
  try {
    const request = schemas.GenerateEmbedRequestSchema.parse(rawRequest);
    const result = await services.aiService.generateEmbedding(
      buildEmbedRequest(request)
    );

    return schemas.GenerateEmbedResponseSchema.parse({
      success: true,
      embeddings: result.embeddings,
      dimensions: result.dimensions,
    });
  } catch (error) {
    return schemas.GenerateEmbedResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

/**
 * Handles GENERATE_IMAGE: Generate an image.
 */
async function handleGenerateImage(
  services: AIServices,
  rawRequest: unknown
): Promise<schemas.GenerateImageResponseSchemaType> {
  try {
    const request = schemas.GenerateImageRequestSchema.parse(rawRequest);
    const result = await services.aiService.generateImage(
      buildImageRequest(request)
    );

    return schemas.GenerateImageResponseSchema.parse({
      success: true,
      imageUrl: result.imageUrl,
      imageBase64: result.imageBase64,
    });
  } catch (error) {
    return schemas.GenerateImageResponseSchema.parse({
      success: false,
      error: toErrorResponse(error),
    });
  }
}

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * Registers all AI generation IPC handlers.
 */
function registerAuthorizedHandler(
  channel: string,
  window: BrowserWindow,
  handler: (event: IpcMainInvokeEvent, request: unknown) => Promise<unknown>
): void {
  ipcMain.handle(channel, (event, request) => {
    assertAuthorizedIpcSender(event, window, channel);
    return handler(event, request);
  });
}

export function registerGenerationHandlers(
  services: AIServices,
  window: BrowserWindow
): void {
  registerAuthorizedHandler(AIChannels.GENERATE_TEXT, window, (_event, request) =>
    handleGenerateText(services, request)
  );
  registerAuthorizedHandler(AIChannels.GENERATE_STREAM, window, (event, request) =>
    handleGenerateStream(services, event, request)
  );
  registerAuthorizedHandler(AIChannels.CANCEL_STREAM, window, (_event, request) =>
    handleCancelStream(request)
  );
  registerAuthorizedHandler(AIChannels.GENERATE_EMBED, window, (_event, request) =>
    handleGenerateEmbed(services, request)
  );
  registerAuthorizedHandler(AIChannels.GENERATE_IMAGE, window, (_event, request) =>
    handleGenerateImage(services, request)
  );
}
