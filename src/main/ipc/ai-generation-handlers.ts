/**
 * AI Generation IPC Handlers
 *
 * Handles text generation (non-streaming and streaming), embedding generation,
 * and image generation.
 *
 * @module src/main/ipc/ai-generation-handlers
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { randomUUID } from 'node:crypto';

import { AIChannels } from '@shared/ai/ipc-channels';
import * as schemas from '@shared/ai/schemas';
import type { AIServices } from '@main/services/ai';
import type {
  TextGenerationRequest,
  EmbeddingRequest,
  ImageGenerationRequest,
} from '@main/services/ai';

import { toErrorResponse, filterUndefined } from './ai-handler-utils';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum buffer size for stream chunks before forced flush (P1-3 fix) */
const MAX_BUFFER_SIZE = 100;

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

    // Set up flush interval (50ms batching)
    flushIntervalId = setInterval(flushChunks, 50);

    const controller = await services.aiService.streamText(
      buildTextRequest(request),
      (chunk) => {
        // Check if sender is still valid before buffering
        if (!sender.isDestroyed()) {
          chunkBuffer.push(chunk);

          // P1-3 fix: flush on overflow to prevent unbounded memory growth
          if (chunkBuffer.length >= MAX_BUFFER_SIZE) {
            flushChunks();
          }
        }
      }
    );

    // Handle completion in background (don't await)
    handleStreamCompletion(controller.completion, streamId, sender, () => {
      if (flushIntervalId) {
        clearInterval(flushIntervalId);
        flushIntervalId = null;
        flushChunks(); // Final flush
      }
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
 * Handles stream completion in background.
 */
function handleStreamCompletion(
  completion: Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }>,
  streamId: string,
  sender: Electron.WebContents,
  onComplete?: () => void
): void {
  completion
    .then((result) => {
      if (onComplete) onComplete();
      if (!sender.isDestroyed()) {
        sender.send(AIChannels.STREAM_COMPLETE, {
          streamId,
          usage: result.usage,
        });
      }
    })
    .catch((error: unknown) => {
      if (onComplete) onComplete();
      if (!sender.isDestroyed()) {
        sender.send(AIChannels.STREAM_ERROR, {
          streamId,
          error: toErrorResponse(error),
        });
      }
    });
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
export function registerGenerationHandlers(services: AIServices): void {
  ipcMain.handle(AIChannels.GENERATE_TEXT, (_, request) =>
    handleGenerateText(services, request)
  );
  ipcMain.handle(AIChannels.GENERATE_STREAM, (event, request) =>
    handleGenerateStream(services, event, request)
  );
  ipcMain.handle(AIChannels.GENERATE_EMBED, (_, request) =>
    handleGenerateEmbed(services, request)
  );
  ipcMain.handle(AIChannels.GENERATE_IMAGE, (_, request) =>
    handleGenerateImage(services, request)
  );
}
