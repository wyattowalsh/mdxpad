/**
 * AI Provider Error Types
 *
 * Custom error classes for the AI Provider Abstraction Layer.
 * All errors extend AIProviderError for consistent error handling.
 *
 * @module src/shared/ai/errors
 */

import type { ProviderCapability } from './types';

/**
 * Base error for AI provider operations.
 * All AI-related errors should extend this class.
 */
export class AIProviderError extends Error {
  constructor(
    message: string,
    /** Unique error code for programmatic handling */
    public readonly code: string,
    /** Provider ID related to the error (if applicable) */
    public readonly providerId?: string
  ) {
    super(message);
    this.name = 'AIProviderError';
    // Maintains proper stack trace for where error was thrown (V8 engines)
    Error.captureStackTrace(this, AIProviderError);
  }
}

/**
 * No active provider is configured.
 * Thrown when attempting AI operations without an active provider.
 */
export class NoActiveProviderError extends AIProviderError {
  constructor() {
    super('No active AI provider configured', 'NO_ACTIVE_PROVIDER');
    this.name = 'NoActiveProviderError';
    Error.captureStackTrace(this, NoActiveProviderError);
  }
}

/**
 * Provider not found.
 * Thrown when referencing a provider ID that doesn't exist.
 */
export class ProviderNotFoundError extends AIProviderError {
  constructor(providerId: string) {
    super(`Provider not found: ${providerId}`, 'PROVIDER_NOT_FOUND', providerId);
    this.name = 'ProviderNotFoundError';
    Error.captureStackTrace(this, ProviderNotFoundError);
  }
}

/**
 * Provider is disconnected.
 * Thrown when attempting operations on a disconnected provider.
 */
export class ProviderDisconnectedError extends AIProviderError {
  constructor(providerId: string) {
    super(`Provider is disconnected: ${providerId}`, 'PROVIDER_DISCONNECTED', providerId);
    this.name = 'ProviderDisconnectedError';
    Error.captureStackTrace(this, ProviderDisconnectedError);
  }
}

/**
 * Capability not supported by model.
 * Thrown when requesting a feature the model doesn't support.
 */
export class CapabilityNotSupportedError extends AIProviderError {
  constructor(
    /** The capability that was requested but not supported */
    public readonly capability: ProviderCapability,
    /** The model that doesn't support the capability */
    public readonly modelId: string,
    providerId: string
  ) {
    super(
      `Model ${modelId} does not support ${capability}`,
      'CAPABILITY_NOT_SUPPORTED',
      providerId
    );
    this.name = 'CapabilityNotSupportedError';
    Error.captureStackTrace(this, CapabilityNotSupportedError);
  }
}

/**
 * Rate limit exceeded.
 * Thrown when the provider's rate limit has been reached.
 */
export class RateLimitError extends AIProviderError {
  constructor(
    providerId: string,
    /** Number of seconds to wait before retrying */
    public readonly retryAfterSeconds: number,
    /** List of alternate provider IDs that could be used */
    public readonly alternateProviders: string[]
  ) {
    super(
      `Rate limit exceeded. Retry after ${retryAfterSeconds}s`,
      'RATE_LIMITED',
      providerId
    );
    this.name = 'RateLimitError';
    Error.captureStackTrace(this, RateLimitError);
  }
}

/**
 * Credential storage error.
 * Thrown when credential storage or retrieval fails.
 */
export class CredentialStorageError extends AIProviderError {
  constructor(message: string, providerId?: string) {
    super(message, 'CREDENTIAL_STORAGE_ERROR', providerId);
    this.name = 'CredentialStorageError';
    Error.captureStackTrace(this, CredentialStorageError);
  }
}

/**
 * Invalid API key.
 * Thrown when the API key validation fails.
 */
export class InvalidApiKeyError extends AIProviderError {
  constructor(providerId: string) {
    super('Invalid API key', 'INVALID_API_KEY', providerId);
    this.name = 'InvalidApiKeyError';
    Error.captureStackTrace(this, InvalidApiKeyError);
  }
}

/**
 * Type guard to check if an error is an AIProviderError
 */
export function isAIProviderError(error: unknown): error is AIProviderError {
  return error instanceof AIProviderError;
}

/**
 * Error code constants for programmatic error handling
 */
export const AIErrorCodes = {
  NO_ACTIVE_PROVIDER: 'NO_ACTIVE_PROVIDER',
  PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
  PROVIDER_DISCONNECTED: 'PROVIDER_DISCONNECTED',
  CAPABILITY_NOT_SUPPORTED: 'CAPABILITY_NOT_SUPPORTED',
  RATE_LIMITED: 'RATE_LIMITED',
  CREDENTIAL_STORAGE_ERROR: 'CREDENTIAL_STORAGE_ERROR',
  INVALID_API_KEY: 'INVALID_API_KEY',
} as const;

export type AIErrorCode = (typeof AIErrorCodes)[keyof typeof AIErrorCodes];

/**
 * Serialized AI error for IPC transmission.
 * Contains all error properties in a plain object format.
 */
export interface SerializedAIError {
  type: string;
  code: string;
  message: string;
  providerId?: string;
  [key: string]: unknown;
}

/**
 * Serializes an AIProviderError for IPC transmission.
 * Converts error instances to plain objects that can be sent across process boundaries.
 *
 * @param error - The AIProviderError to serialize
 * @returns A plain object representation of the error
 */
export function serializeAIError(error: AIProviderError): SerializedAIError {
  const base: SerializedAIError = {
    type: error.name,
    code: error.code,
    message: error.message,
  };

  if (error.providerId) {
    base.providerId = error.providerId;
  }

  // Add type-specific fields
  if (error instanceof RateLimitError) {
    base.retryAfterSeconds = error.retryAfterSeconds;
    base.alternateProviders = error.alternateProviders;
  } else if (error instanceof CapabilityNotSupportedError) {
    base.capability = error.capability;
    base.modelId = error.modelId;
  }

  return base;
}

/**
 * Deserializes a SerializedAIError back into an AIProviderError instance.
 * Reconstructs the proper error class based on the type field.
 *
 * @param json - The serialized error object
 * @returns The reconstructed AIProviderError instance
 */
export function deserializeAIError(json: SerializedAIError): AIProviderError {
  switch (json.type) {
    case 'NoActiveProviderError':
      return new NoActiveProviderError();

    case 'ProviderNotFoundError':
      return new ProviderNotFoundError(json.providerId ?? 'unknown');

    case 'ProviderDisconnectedError':
      return new ProviderDisconnectedError(json.providerId ?? 'unknown');

    case 'CapabilityNotSupportedError':
      return new CapabilityNotSupportedError(
        json.capability as ProviderCapability,
        json.modelId as string,
        json.providerId ?? 'unknown'
      );

    case 'RateLimitError':
      return new RateLimitError(
        json.providerId ?? 'unknown',
        (json.retryAfterSeconds as number | undefined) ?? 60,
        (json.alternateProviders as string[] | undefined) ?? []
      );

    case 'CredentialStorageError':
      return new CredentialStorageError(json.message, json.providerId);

    case 'InvalidApiKeyError':
      return new InvalidApiKeyError(json.providerId ?? 'unknown');

    default:
      // Fallback to base AIProviderError for unknown types
      return new AIProviderError(json.message, json.code, json.providerId);
  }
}
