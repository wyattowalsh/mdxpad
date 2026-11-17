/**
 * Decides whether semantic search may call an embedding provider.
 *
 * Keyed cloud providers need a stored credential and an embedding-capable API.
 * Local providers that do not require a key stay eligible.
 */

import type { ProviderConfig, ProviderType } from '@shared/ai/types';

import { requiresApiKey } from './ai-helpers';

const EMBEDDING_CAPABLE_KEYED_TYPES = new Set<ProviderType>(['openai']);

export class EmbeddingsUnavailableError extends Error {
  readonly code = 'EMBEDDINGS_UNAVAILABLE';

  constructor(message = 'Embeddings are unavailable') {
    super(message);
    this.name = 'EmbeddingsUnavailableError';
  }
}

export interface EmbeddingAvailabilitySource {
  getActiveProvider(): Promise<ProviderConfig | null>;
  getCredential(providerId: string): Promise<string | null>;
}

export async function assertEmbeddingsAvailable(
  source: EmbeddingAvailabilitySource
): Promise<void> {
  const provider = await source.getActiveProvider();
  if (!provider) {
    throw new EmbeddingsUnavailableError('No active provider');
  }

  if (!requiresApiKey(provider.type)) {
    return;
  }

  const credential = await source.getCredential(provider.id);
  if (!credential || !EMBEDDING_CAPABLE_KEYED_TYPES.has(provider.type)) {
    throw new EmbeddingsUnavailableError('Active provider cannot embed');
  }
}
