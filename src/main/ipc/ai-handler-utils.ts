/**
 * Shared utilities for AI IPC handlers.
 *
 * Contains error conversion and the generic filterUndefined utility
 * used across all AI handler modules.
 *
 * @module src/main/ipc/ai-handler-utils
 */

import { ZodError } from 'zod';

import {
  serializeAIError,
  isAIProviderError,
} from '@shared/ai/errors';

// =============================================================================
// TYPES
// =============================================================================

/** Error response object for IPC handlers */
export interface ErrorResponse {
  code: string;
  message: string;
  retryAfterSeconds?: number;
  alternateProviders?: string[];
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Generic utility to filter undefined values from an object.
 * Returns a new object with only defined properties.
 *
 * Replaces 6 near-identical "build request" functions that manually
 * filtered undefined values (P0-8 fix).
 */
export function filterUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

// =============================================================================
// ERROR HELPERS
// =============================================================================

/**
 * Converts an error to a standard error response object.
 */
export function toErrorResponse(error: unknown): ErrorResponse {
  // Handle AIProviderError with serialization
  if (isAIProviderError(error)) {
    return serializeAIError(error);
  }

  // Handle ZodError
  if (error instanceof ZodError) {
    return { code: 'VALIDATION_ERROR', message: error.message };
  }

  // Handle generic Error
  if (error instanceof Error) {
    return { code: 'UNKNOWN_ERROR', message: error.message };
  }

  // Fallback for unknown error types
  return { code: 'UNKNOWN_ERROR', message: String(error) };
}
