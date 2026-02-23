/**
 * Tests for AI provider Zod schemas.
 *
 * Tests enum schemas, base object schemas, provider management,
 * credential management, AI generation, usage statistics,
 * capability schemas, and validation helpers.
 */

import { describe, it, expect } from 'vitest';

const uuidv4 = () => crypto.randomUUID();
import {
  // Enums
  ProviderTypeSchema,
  ConnectionStatusSchema,
  OperationTypeSchema,
  TimeRangeSchema,
  ProviderCapabilitySchema,
  StorageTypeSchema,
  OnboardingOutcomeSchema,
  OnboardingStepSchema,
  // Base objects
  CapabilityConstraintsSchema,
  ProviderConfigSchema,
  ErrorObjectSchema,
  UsageTokensSchema,
  // Provider management
  ProviderListResponseSchema,
  AddProviderRequestSchema,
  UpdateProviderRequestSchema,
  RemoveProviderRequestSchema,
  SetActiveProviderRequestSchema,
  ValidateProviderRequestSchema,
  ValidateProviderResponseSchema,
  // Credentials
  SetCredentialRequestSchema,
  SetCredentialResponseSchema,
  HasCredentialRequestSchema,
  HasCredentialResponseSchema,
  ClearCredentialRequestSchema,
  ClearCredentialResponseSchema,
  // AI generation
  GenerateTextRequestSchema,
  GenerateTextResponseSchema,
  StreamCancelRequestSchema,
  StreamCancelResponseSchema,
  StreamChunkSchema,
  StreamCompleteSchema,
  StreamErrorSchema,
  GenerateEmbedRequestSchema,
  GenerateEmbedResponseSchema,
  ImageSizeSchema,
  ImageQualitySchema,
  ImageStyleSchema,
  GenerateImageRequestSchema,
  // Usage
  QueryUsageRequestSchema,
  ExportUsageRequestSchema,
  ClearUsageRequestSchema,
  // Capabilities
  GetCapabilityRequestSchema,
  ListModelsRequestSchema,
  ModelInfoSchema,
  RefreshCapabilityRequestSchema,
  // Helpers
  validateRequest,
  validateResponse,
  createValidator,
} from '../schemas';
import { z } from 'zod';

// =============================================================================
// ENUM SCHEMAS
// =============================================================================

describe('ProviderTypeSchema', () => {
  const validTypes = ['openai', 'anthropic', 'ollama', 'lmstudio', 'openai-compatible'];
  for (const type of validTypes) {
    it(`should accept "${type}"`, () => {
      expect(ProviderTypeSchema.safeParse(type).success).toBe(true);
    });
  }
  it('should reject invalid type', () => {
    expect(ProviderTypeSchema.safeParse('google').success).toBe(false);
  });
});

describe('ConnectionStatusSchema', () => {
  for (const status of ['connected', 'disconnected', 'error', 'validating']) {
    it(`should accept "${status}"`, () => {
      expect(ConnectionStatusSchema.safeParse(status).success).toBe(true);
    });
  }
});

describe('OperationTypeSchema', () => {
  for (const op of [
    'text-generation',
    'streaming-generation',
    'embedding',
    'image-generation',
    'agent-execution',
  ]) {
    it(`should accept "${op}"`, () => {
      expect(OperationTypeSchema.safeParse(op).success).toBe(true);
    });
  }
});

describe('TimeRangeSchema', () => {
  for (const range of ['day', 'week', 'month', 'all']) {
    it(`should accept "${range}"`, () => {
      expect(TimeRangeSchema.safeParse(range).success).toBe(true);
    });
  }
});

describe('ProviderCapabilitySchema', () => {
  for (const cap of [
    'text-generation',
    'streaming',
    'vision',
    'embeddings',
    'image-generation',
    'tool-use',
    'agents',
  ]) {
    it(`should accept "${cap}"`, () => {
      expect(ProviderCapabilitySchema.safeParse(cap).success).toBe(true);
    });
  }
});

describe('StorageTypeSchema', () => {
  it('should accept persistent and session', () => {
    expect(StorageTypeSchema.safeParse('persistent').success).toBe(true);
    expect(StorageTypeSchema.safeParse('session').success).toBe(true);
  });
});

describe('OnboardingOutcomeSchema', () => {
  for (const outcome of ['success', 'failure', 'abandoned']) {
    it(`should accept "${outcome}"`, () => {
      expect(OnboardingOutcomeSchema.safeParse(outcome).success).toBe(true);
    });
  }
});

describe('OnboardingStepSchema', () => {
  for (const step of ['provider-selection', 'credential-entry', 'validation', 'save']) {
    it(`should accept "${step}"`, () => {
      expect(OnboardingStepSchema.safeParse(step).success).toBe(true);
    });
  }
});

// =============================================================================
// BASE OBJECT SCHEMAS
// =============================================================================

describe('CapabilityConstraintsSchema', () => {
  it('should accept empty constraints', () => {
    expect(CapabilityConstraintsSchema.safeParse({}).success).toBe(true);
  });

  it('should accept full constraints', () => {
    const result = CapabilityConstraintsSchema.safeParse({
      maxImageSize: 4096,
      maxImageCount: 5,
      supportedImageFormats: ['png', 'jpg'],
      embeddingDimensions: 1536,
      maxToolCount: 10,
    });
    expect(result.success).toBe(true);
  });
});

describe('ProviderConfigSchema', () => {
  const validConfig = {
    id: uuidv4(),
    displayName: 'Test Provider',
    type: 'openai',
    isActive: true,
    status: 'connected',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('should accept valid config', () => {
    expect(ProviderConfigSchema.safeParse(validConfig).success).toBe(true);
  });

  it('should accept config with optional fields', () => {
    const result = ProviderConfigSchema.safeParse({
      ...validConfig,
      baseUrl: 'https://api.openai.com',
      lastConnectedAt: new Date().toISOString(),
      errorMessage: 'Rate limited',
    });
    expect(result.success).toBe(true);
  });
});

describe('ErrorObjectSchema', () => {
  it('should accept basic error', () => {
    const result = ErrorObjectSchema.safeParse({
      code: 'RATE_LIMIT',
      message: 'Too many requests',
    });
    expect(result.success).toBe(true);
  });

  it('should accept error with retry info', () => {
    const result = ErrorObjectSchema.safeParse({
      code: 'RATE_LIMIT',
      message: 'Too many requests',
      retryAfterSeconds: 30,
      alternateProviders: ['anthropic'],
    });
    expect(result.success).toBe(true);
  });
});

describe('UsageTokensSchema', () => {
  it('should accept valid token counts', () => {
    const result = UsageTokensSchema.safeParse({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// PROVIDER MANAGEMENT
// =============================================================================

describe('AddProviderRequestSchema', () => {
  it('should accept valid request', () => {
    const result = AddProviderRequestSchema.safeParse({
      displayName: 'My OpenAI',
      type: 'openai',
      apiKey: 'sk-test123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty display name', () => {
    const result = AddProviderRequestSchema.safeParse({
      displayName: '',
      type: 'openai',
    });
    expect(result.success).toBe(false);
  });

  it('should reject display name over 50 chars', () => {
    const result = AddProviderRequestSchema.safeParse({
      displayName: 'a'.repeat(51),
      type: 'openai',
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdateProviderRequestSchema', () => {
  it('should accept valid update', () => {
    const result = UpdateProviderRequestSchema.safeParse({
      id: uuidv4(),
      updates: { displayName: 'Updated Name' },
    });
    expect(result.success).toBe(true);
  });
});

describe('RemoveProviderRequestSchema', () => {
  it('should accept valid UUID', () => {
    expect(RemoveProviderRequestSchema.safeParse({ id: uuidv4() }).success).toBe(true);
  });
});

describe('ValidateProviderResponseSchema', () => {
  it('should accept success response', () => {
    const result = ValidateProviderResponseSchema.safeParse({
      success: true,
      status: 'connected',
      models: ['gpt-4', 'gpt-3.5-turbo'],
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// CREDENTIAL MANAGEMENT
// =============================================================================

describe('SetCredentialRequestSchema', () => {
  it('should accept valid credential', () => {
    const result = SetCredentialRequestSchema.safeParse({
      providerId: uuidv4(),
      apiKey: 'sk-test123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty API key', () => {
    const result = SetCredentialRequestSchema.safeParse({
      providerId: uuidv4(),
      apiKey: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('SetCredentialResponseSchema', () => {
  it('should accept valid response', () => {
    const result = SetCredentialResponseSchema.safeParse({
      success: true,
      storageType: 'persistent',
      keyPreview: 'sk-t',
    });
    expect(result.success).toBe(true);
  });

  it('should reject keyPreview not exactly 4 chars', () => {
    const result = SetCredentialResponseSchema.safeParse({
      success: true,
      storageType: 'persistent',
      keyPreview: 'sk',
    });
    expect(result.success).toBe(false);
  });
});

describe('HasCredentialResponseSchema', () => {
  it('should accept exists: true with details', () => {
    const result = HasCredentialResponseSchema.safeParse({
      exists: true,
      storageType: 'persistent',
      keyPreview: 'sk-t',
    });
    expect(result.success).toBe(true);
  });

  it('should accept exists: false without details', () => {
    expect(HasCredentialResponseSchema.safeParse({ exists: false }).success).toBe(true);
  });
});

describe('ClearCredentialResponseSchema', () => {
  it('should accept success response', () => {
    expect(ClearCredentialResponseSchema.safeParse({ success: true }).success).toBe(true);
  });
});

// =============================================================================
// AI GENERATION
// =============================================================================

describe('GenerateTextRequestSchema', () => {
  it('should accept minimal request', () => {
    expect(GenerateTextRequestSchema.safeParse({ prompt: 'Hello' }).success).toBe(true);
  });

  it('should accept full request', () => {
    const result = GenerateTextRequestSchema.safeParse({
      prompt: 'Hello',
      modelId: 'gpt-4',
      maxTokens: 1000,
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant.',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty prompt', () => {
    expect(GenerateTextRequestSchema.safeParse({ prompt: '' }).success).toBe(false);
  });

  it('should reject temperature above 2', () => {
    const result = GenerateTextRequestSchema.safeParse({ prompt: 'Hi', temperature: 2.1 });
    expect(result.success).toBe(false);
  });

  it('should reject negative temperature', () => {
    const result = GenerateTextRequestSchema.safeParse({ prompt: 'Hi', temperature: -0.1 });
    expect(result.success).toBe(false);
  });
});

describe('StreamChunkSchema', () => {
  it('should accept valid chunk', () => {
    const result = StreamChunkSchema.safeParse({
      streamId: uuidv4(),
      chunk: 'Hello ',
      isComplete: false,
    });
    expect(result.success).toBe(true);
  });
});

describe('StreamCancelRequestSchema', () => {
  it('should accept valid stream cancel request', () => {
    const result = StreamCancelRequestSchema.safeParse({
      streamId: uuidv4(),
    });
    expect(result.success).toBe(true);
  });
});

describe('StreamCancelResponseSchema', () => {
  it('should accept successful cancel response', () => {
    const result = StreamCancelResponseSchema.safeParse({
      success: true,
    });
    expect(result.success).toBe(true);
  });
});

describe('StreamCompleteSchema', () => {
  it('should accept complete event', () => {
    const result = StreamCompleteSchema.safeParse({
      streamId: uuidv4(),
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    });
    expect(result.success).toBe(true);
  });
});

describe('StreamErrorSchema', () => {
  it('should accept error event', () => {
    const result = StreamErrorSchema.safeParse({
      streamId: uuidv4(),
      error: { code: 'TIMEOUT', message: 'Request timed out' },
    });
    expect(result.success).toBe(true);
  });
});

describe('GenerateEmbedRequestSchema', () => {
  it('should accept valid request', () => {
    const result = GenerateEmbedRequestSchema.safeParse({
      texts: ['Hello', 'World'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty texts array', () => {
    expect(GenerateEmbedRequestSchema.safeParse({ texts: [] }).success).toBe(false);
  });

  it('should reject more than 100 texts', () => {
    const texts = Array.from({ length: 101 }, (_, i) => `text ${i}`);
    expect(GenerateEmbedRequestSchema.safeParse({ texts }).success).toBe(false);
  });
});

describe('Image schemas', () => {
  it('ImageSizeSchema should accept valid sizes', () => {
    for (const size of ['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792']) {
      expect(ImageSizeSchema.safeParse(size).success).toBe(true);
    }
  });

  it('ImageQualitySchema should accept standard and hd', () => {
    expect(ImageQualitySchema.safeParse('standard').success).toBe(true);
    expect(ImageQualitySchema.safeParse('hd').success).toBe(true);
  });

  it('ImageStyleSchema should accept natural and vivid', () => {
    expect(ImageStyleSchema.safeParse('natural').success).toBe(true);
    expect(ImageStyleSchema.safeParse('vivid').success).toBe(true);
  });

  it('GenerateImageRequestSchema should accept valid request', () => {
    const result = GenerateImageRequestSchema.safeParse({
      prompt: 'A cat',
      size: '1024x1024',
      quality: 'hd',
      style: 'vivid',
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// USAGE STATISTICS
// =============================================================================

describe('QueryUsageRequestSchema', () => {
  it('should accept minimal request', () => {
    expect(QueryUsageRequestSchema.safeParse({ timeRange: 'week' }).success).toBe(true);
  });

  it('should accept full request', () => {
    const result = QueryUsageRequestSchema.safeParse({
      timeRange: 'month',
      providerId: uuidv4(),
      operationType: 'text-generation',
    });
    expect(result.success).toBe(true);
  });
});

describe('ExportUsageRequestSchema', () => {
  it('should accept json format', () => {
    const result = ExportUsageRequestSchema.safeParse({ timeRange: 'all', format: 'json' });
    expect(result.success).toBe(true);
  });

  it('should accept csv format', () => {
    const result = ExportUsageRequestSchema.safeParse({ timeRange: 'day', format: 'csv' });
    expect(result.success).toBe(true);
  });
});

describe('ClearUsageRequestSchema', () => {
  it('should accept empty request', () => {
    expect(ClearUsageRequestSchema.safeParse({}).success).toBe(true);
  });

  it('should accept request with providerId', () => {
    expect(ClearUsageRequestSchema.safeParse({ providerId: uuidv4() }).success).toBe(true);
  });
});

// =============================================================================
// CAPABILITY SCHEMAS
// =============================================================================

describe('GetCapabilityRequestSchema', () => {
  it('should accept valid request', () => {
    const result = GetCapabilityRequestSchema.safeParse({
      providerId: uuidv4(),
      modelId: 'gpt-4',
    });
    expect(result.success).toBe(true);
  });
});

describe('ListModelsRequestSchema', () => {
  it('should accept valid request', () => {
    expect(ListModelsRequestSchema.safeParse({ providerId: uuidv4() }).success).toBe(true);
  });
});

describe('ModelInfoSchema', () => {
  it('should accept valid model info', () => {
    const result = ModelInfoSchema.safeParse({
      id: 'gpt-4',
      name: 'GPT-4',
      capabilities: ['text-generation', 'streaming', 'tool-use'],
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

describe('validateRequest', () => {
  it('should return parsed data on valid input', () => {
    const schema = z.object({ name: z.string() });
    const result = validateRequest(schema, { name: 'test' });
    expect(result).toEqual({ name: 'test' });
  });

  it('should throw on invalid input', () => {
    const schema = z.object({ name: z.string() });
    expect(() => validateRequest(schema, { name: 123 })).toThrow();
  });
});

describe('validateResponse', () => {
  it('should return success result on valid input', () => {
    const schema = z.object({ ok: z.boolean() });
    const result = validateResponse(schema, { ok: true });
    expect(result.success).toBe(true);
  });

  it('should return error result on invalid input', () => {
    const schema = z.object({ ok: z.boolean() });
    const result = validateResponse(schema, { ok: 'not-boolean' });
    expect(result.success).toBe(false);
  });
});

describe('createValidator', () => {
  const schema = z.object({ value: z.number() });
  const validator = createValidator(schema);

  it('parse should return parsed data', () => {
    expect(validator.parse({ value: 42 })).toEqual({ value: 42 });
  });

  it('parse should throw on invalid input', () => {
    expect(() => validator.parse({ value: 'not-number' })).toThrow();
  });

  it('safeParse should return success result', () => {
    const result = validator.safeParse({ value: 42 });
    expect(result.success).toBe(true);
  });

  it('safeParse should return error result', () => {
    const result = validator.safeParse({ value: 'bad' });
    expect(result.success).toBe(false);
  });

  it('isValid should return true for valid data', () => {
    expect(validator.isValid({ value: 42 })).toBe(true);
  });

  it('isValid should return false for invalid data', () => {
    expect(validator.isValid({ value: 'bad' })).toBe(false);
  });
});
