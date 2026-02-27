/**
 * Shared AI session type definitions.
 *
 * Provides metadata models for AI sessions and their prompt/instruction files.
 */

import type { ProviderCapability, ProviderType } from '@shared/ai/types';
import type { AISession as RootAISession } from './root';

/**
 * Canonical AI session model from root shared types.
 * Re-exported here so AI-session-specific models can compose from one source of truth.
 */
export type AISession = RootAISession;

/** Unique AI session identifier. */
export type AISessionId = AISession['id'];

/** Document identifier used in an AI session context. */
export type AISessionDocumentId = AISession['contextDocumentIds'][number];

/**
 * Session model/provider selection metadata.
 * Uses session provider/model ids and optionally enriches with provider catalog data.
 */
export interface AISessionModelSelection {
  readonly providerId: AISession['provider'];
  readonly modelId: AISession['model'];
  readonly providerType?: ProviderType;
  readonly capabilities?: readonly ProviderCapability[];
}

/** Shared metadata for AI prompt and instruction files. */
export interface AIFileMetadata {
  readonly id: string;
  readonly filePath: string;
  readonly fileName: string;
  readonly checksum?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Scope target for instruction files. */
export type AIInstructionScope = 'global' | 'workspace' | 'document';

/** Metadata for instruction files used to guide AI behavior. */
export interface AIInstructionFileMetadata extends AIFileMetadata {
  readonly kind: 'instruction';
  readonly scope: AIInstructionScope;
  readonly appliesToDocumentIds?: readonly AISessionDocumentId[];
  readonly version?: string;
}

/** Metadata for reusable prompt files. */
export interface AIPromptFileMetadata extends AIFileMetadata {
  readonly kind: 'prompt';
  readonly title: string;
  readonly description?: string;
  readonly variables: readonly string[];
  readonly systemPrompt?: string;
  readonly modelSelection?: Partial<AISessionModelSelection>;
}

/** Session-level prompt/instruction attachment metadata. */
export interface AISessionPromptContext {
  readonly sessionId: AISessionId;
  readonly promptFile?: AIPromptFileMetadata;
  readonly instructionFile?: AIInstructionFileMetadata;
}
