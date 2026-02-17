/**
 * Provider Validation for AI Provider Connection Testing
 *
 * Handles connection validation, response parsing, and health checking for
 * all supported provider types (OpenAI, Anthropic, Ollama, LM Studio,
 * OpenAI-compatible).
 *
 * @module src/main/services/ai/provider-validation
 */

import type {
  ProviderConfig,
  ConnectionStatus,
} from '../../../shared/ai/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of validating a provider's connection.
 */
export interface ProviderValidationResult {
  /** Whether validation succeeded */
  valid: boolean;
  /** Connection status after validation */
  status: ConnectionStatus;
  /** List of available models (if validation succeeded) */
  models?: string[];
  /** Error details (if validation failed) */
  error?: {
    code: string;
    message: string;
    retryAfterSeconds?: number;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const VALIDATION_TIMEOUT_MS = 10_000;

// =============================================================================
// VALIDATION DISPATCH
// =============================================================================

/**
 * Performs validation based on provider type.
 *
 * @param provider - Provider configuration to validate
 * @param apiKey - API key for the provider (from credential service)
 * @returns Validation result with status and optional models list
 */
export async function performValidation(
  provider: ProviderConfig,
  apiKey: string | null
): Promise<ProviderValidationResult> {
  switch (provider.type) {
    case 'openai':
      return validateOpenAI(apiKey);
    case 'anthropic':
      return validateAnthropic(apiKey);
    case 'ollama':
      return validateOllama(provider.baseUrl);
    case 'lmstudio':
      return validateLMStudio(provider.baseUrl);
    case 'openai-compatible':
      return validateOpenAICompatible(provider.baseUrl, apiKey);
    default:
      return { valid: false, status: 'error', error: { code: 'UNKNOWN_TYPE', message: 'Unknown provider type' } };
  }
}

// =============================================================================
// PROVIDER-SPECIFIC VALIDATION
// =============================================================================

/**
 * Validates an OpenAI provider.
 */
async function validateOpenAI(apiKey: string | null): Promise<ProviderValidationResult> {
  if (!apiKey) {
    return createMissingKeyResult();
  }

  const response = await fetchWithTimeout('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  return parseOpenAIResponse(response);
}

/**
 * Validates an Anthropic provider.
 */
async function validateAnthropic(apiKey: string | null): Promise<ProviderValidationResult> {
  if (!apiKey) {
    return createMissingKeyResult();
  }

  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'test' }],
    }),
  });

  return parseAnthropicResponse(response);
}

/**
 * Validates an Ollama provider.
 */
async function validateOllama(baseUrl?: string): Promise<ProviderValidationResult> {
  if (!baseUrl) {
    return createMissingUrlResult();
  }

  const response = await fetchWithTimeout(`${baseUrl}/api/tags`, {
    method: 'GET',
  });

  return parseOllamaResponse(response);
}

/**
 * Validates an LM Studio provider.
 */
async function validateLMStudio(baseUrl?: string): Promise<ProviderValidationResult> {
  if (!baseUrl) {
    return createMissingUrlResult();
  }

  const response = await fetchWithTimeout(`${baseUrl}/v1/models`, {
    method: 'GET',
  });

  return parseOpenAICompatibleResponse(response);
}

/**
 * Validates an OpenAI-compatible provider.
 */
async function validateOpenAICompatible(
  baseUrl?: string,
  apiKey?: string | null
): Promise<ProviderValidationResult> {
  if (!baseUrl) {
    return createMissingUrlResult();
  }

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetchWithTimeout(`${baseUrl}/v1/models`, {
    method: 'GET',
    headers,
  });

  return parseOpenAICompatibleResponse(response);
}

// =============================================================================
// RESPONSE PARSING
// =============================================================================

/**
 * Parses OpenAI API response.
 */
async function parseOpenAIResponse(response: Response): Promise<ProviderValidationResult> {
  if (response.status === 401) {
    return { valid: false, status: 'error', error: { code: 'INVALID_API_KEY', message: 'Invalid API key' } };
  }

  if (response.status === 429) {
    const retryAfter = parseRetryAfter(response);
    return { valid: false, status: 'error', error: { code: 'RATE_LIMITED', message: 'Rate limited', retryAfterSeconds: retryAfter } };
  }

  if (!response.ok) {
    return { valid: false, status: 'error', error: { code: 'API_ERROR', message: `API error: ${response.status}` } };
  }

  const data = (await response.json()) as { data?: { id: string }[] };
  const models = data.data?.map((m) => m.id) ?? [];
  return { valid: true, status: 'connected', models };
}

/**
 * Parses Anthropic API response.
 */
function parseAnthropicResponse(response: Response): ProviderValidationResult {
  if (response.status === 401) {
    return { valid: false, status: 'error', error: { code: 'INVALID_API_KEY', message: 'Invalid API key' } };
  }

  if (response.status === 429) {
    const retryAfter = parseRetryAfter(response);
    return { valid: false, status: 'error', error: { code: 'RATE_LIMITED', message: 'Rate limited', retryAfterSeconds: retryAfter } };
  }

  // Anthropic returns 200 for valid key (we made a valid request)
  // or 400 for invalid request structure (but valid key)
  if (response.ok || response.status === 400) {
    return { valid: true, status: 'connected' };
  }

  return { valid: false, status: 'error', error: { code: 'API_ERROR', message: `API error: ${response.status}` } };
}

/**
 * Parses Ollama API response.
 */
async function parseOllamaResponse(response: Response): Promise<ProviderValidationResult> {
  if (!response.ok) {
    return { valid: false, status: 'error', error: { code: 'CONNECTION_ERROR', message: 'Failed to connect to Ollama' } };
  }

  const data = (await response.json()) as { models?: { name: string }[] };
  const models = data.models?.map((m) => m.name) ?? [];
  return { valid: true, status: 'connected', models };
}

/**
 * Parses OpenAI-compatible API response (LM Studio, etc.).
 */
async function parseOpenAICompatibleResponse(response: Response): Promise<ProviderValidationResult> {
  if (response.status === 401) {
    return { valid: false, status: 'error', error: { code: 'INVALID_API_KEY', message: 'Invalid API key' } };
  }

  if (!response.ok) {
    return { valid: false, status: 'error', error: { code: 'CONNECTION_ERROR', message: `Connection error: ${response.status}` } };
  }

  const data = (await response.json()) as { data?: { id: string }[] };
  const models = data.data?.map((m) => m.id) ?? [];
  return { valid: true, status: 'connected', models };
}

// =============================================================================
// RESULT FACTORIES
// =============================================================================

/**
 * Creates a validation result for missing API key.
 */
function createMissingKeyResult(): ProviderValidationResult {
  return { valid: false, status: 'error', error: { code: 'MISSING_API_KEY', message: 'API key not configured' } };
}

/**
 * Creates a validation result for missing baseUrl.
 */
function createMissingUrlResult(): ProviderValidationResult {
  return { valid: false, status: 'error', error: { code: 'MISSING_BASE_URL', message: 'Base URL not configured' } };
}

/**
 * Creates an error validation result from an unknown error.
 */
export function createErrorResult(error: unknown): ProviderValidationResult {
  if (error instanceof Error && error.name === 'AbortError') {
    return { valid: false, status: 'error', error: { code: 'TIMEOUT', message: 'Connection timed out' } };
  }

  const message = error instanceof Error ? error.message : String(error);
  return { valid: false, status: 'error', error: { code: 'UNKNOWN_ERROR', message } };
}

// =============================================================================
// UTILITY
// =============================================================================

/**
 * Fetches a URL with timeout.
 */
async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parses Retry-After header.
 */
function parseRetryAfter(response: Response): number {
  const header = response.headers.get('Retry-After');
  if (!header) {
    return 60;
  }
  const parsed = parseInt(header, 10);
  return isNaN(parsed) ? 60 : parsed;
}
