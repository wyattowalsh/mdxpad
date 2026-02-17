/**
 * Text Generation Module
 *
 * Provides text generation and streaming operations using the Vercel AI SDK.
 * Called by the AIService facade, receiving all dependencies as parameters.
 *
 * @module src/main/services/ai/text-generation
 */

import { generateText, streamText } from 'ai';

import type { ProviderConfig } from '@shared/ai/types';
import { ProviderCapability as Capability } from '@shared/ai/types';
import { RateLimitError } from '@shared/ai/errors';

import type { IUsageService } from './usage-service';
import type {
  TextGenerationRequest,
  TextGenerationResponse,
  StreamController,
  ProviderResolver,
  ModelFactory,
  AlternateProvidersFn,
} from './ai-types';
import {
  getDefaultModel,
  validateCapability,
  isRateLimitError,
  extractRetryAfter,
  wrapError,
} from './ai-helpers';

// =============================================================================
// TEXT GENERATION
// =============================================================================

/**
 * Generates text (non-streaming) using the active provider.
 */
export async function performTextGeneration(
  request: TextGenerationRequest,
  resolveProvider: ProviderResolver,
  createModel: ModelFactory,
  usageService: IUsageService,
  getAlternates: AlternateProvidersFn
): Promise<TextGenerationResponse> {
  const { provider, apiKey } = await resolveProvider();
  const modelId = request.modelId ?? getDefaultModel(provider.type);

  validateCapability(provider, modelId, Capability.TEXT_GENERATION);

  const model = createModel(provider, apiKey, modelId);
  const startTime = Date.now();

  try {
    const result = await generateText({
      model,
      prompt: request.prompt,
      ...(request.maxTokens !== undefined && { maxOutputTokens: request.maxTokens }),
      ...(request.temperature !== undefined && { temperature: request.temperature }),
      ...(request.systemPrompt !== undefined && { system: request.systemPrompt }),
    });

    const response = buildTextResponse(result, modelId, startTime);
    await recordTextUsage(usageService, provider.id, modelId, 'text-generation', response, true);
    return response;
  } catch (error) {
    // handleGenerationError always throws; the await is typed as Promise<never>
    return await handleGenerationError(error, provider, modelId, startTime, usageService, getAlternates);
  }
}

// =============================================================================
// STREAMING TEXT GENERATION
// =============================================================================

/**
 * Streams text generation using the active provider.
 */
export async function performStreamText(
  request: TextGenerationRequest,
  onChunk: (chunk: string) => void,
  resolveProvider: ProviderResolver,
  createModel: ModelFactory,
  usageService: IUsageService,
  getAlternates: AlternateProvidersFn
): Promise<StreamController> {
  const { provider, apiKey } = await resolveProvider();
  const modelId = request.modelId ?? getDefaultModel(provider.type);

  validateCapability(provider, modelId, Capability.STREAMING);

  const model = createModel(provider, apiKey, modelId);
  const abortController = new AbortController();
  const startTime = Date.now();

  const stream = streamText({
    model,
    prompt: request.prompt,
    abortSignal: abortController.signal,
    ...(request.maxTokens !== undefined && { maxOutputTokens: request.maxTokens }),
    ...(request.temperature !== undefined && { temperature: request.temperature }),
    ...(request.systemPrompt !== undefined && { system: request.systemPrompt }),
  });

  const completion = processStream(
    stream,
    onChunk,
    provider,
    modelId,
    startTime,
    usageService,
    getAlternates
  );

  return {
    abort: () => abortController.abort(),
    completion,
  };
}

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/**
 * Builds a text generation response from the AI SDK result.
 */
function buildTextResponse(
  result: Awaited<ReturnType<typeof generateText>>,
  modelId: string,
  startTime: number
): TextGenerationResponse {
  return {
    text: result.text,
    usage: {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      totalTokens: result.usage.totalTokens ?? 0,
    },
    modelId,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Processes a text stream and returns the completion.
 */
async function processStream(
  stream: ReturnType<typeof streamText>,
  onChunk: (chunk: string) => void,
  provider: ProviderConfig,
  modelId: string,
  startTime: number,
  usageService: IUsageService,
  getAlternates: AlternateProvidersFn
): Promise<TextGenerationResponse> {
  let fullText = '';

  try {
    for await (const chunk of stream.textStream) {
      fullText += chunk;
      onChunk(chunk);
    }

    const usage = await stream.usage;
    const response: TextGenerationResponse = {
      text: fullText,
      usage: {
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      },
      modelId,
      durationMs: Date.now() - startTime,
    };

    await recordTextUsage(
      usageService, provider.id, modelId, 'streaming-generation', response, true
    );
    return response;
  } catch (error) {
    // handleGenerationError always throws; the await is typed as Promise<never>
    return await handleGenerationError(error, provider, modelId, startTime, usageService, getAlternates);
  }
}

/**
 * Records text generation usage.
 */
async function recordTextUsage(
  usageService: IUsageService,
  providerId: string,
  modelId: string,
  operationType: 'text-generation' | 'streaming-generation',
  response: TextGenerationResponse,
  success: boolean
): Promise<void> {
  await usageService.recordUsage({
    providerId,
    modelId,
    operationType,
    inputTokens: response.usage.inputTokens,
    outputTokens: response.usage.outputTokens,
    totalTokens: response.usage.totalTokens,
    durationMs: response.durationMs,
    success,
  });
}

/**
 * Handles generation errors, including rate limiting.
 */
async function handleGenerationError(
  error: unknown,
  provider: ProviderConfig,
  modelId: string,
  startTime: number,
  usageService: IUsageService,
  getAlternates: AlternateProvidersFn
): Promise<never> {
  const durationMs = Date.now() - startTime;

  try {
    await usageService.recordUsage({
      providerId: provider.id,
      modelId,
      operationType: 'text-generation',
      durationMs,
      success: false,
      errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
    });
  } catch (recordError) {
    console.error('[AI] Failed to record usage:', recordError);
  }

  if (isRateLimitError(error)) {
    const alternates = await getAlternates(provider.id);
    throw new RateLimitError(provider.id, extractRetryAfter(error), alternates);
  }

  throw wrapError(error, provider);
}
