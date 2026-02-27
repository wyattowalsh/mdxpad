import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { RateLimitError } from '@shared/ai/errors';
import type { FileExportError } from '@shared/contracts/file-schemas';
import {
  USER_FACING_ERROR_CODES,
  createAIUserFacingError,
  createExportUserFacingError,
  createUserFacingError,
  createValidationUserFacingError,
  safeParseWithUserFacingValidation,
  serializeErrorForIPC,
} from '../error-utils';

describe('error-utils', () => {
  it('creates user-facing errors with IPC-safe metadata', () => {
    const createdAt = new Date('2026-02-01T12:00:00.000Z');
    const error = createUserFacingError(USER_FACING_ERROR_CODES.UNKNOWN_ERROR, 'Boom', {
      metadata: {
        createdAt,
        nested: { reason: new Error('test failure') },
      },
    });

    expect(error.code).toBe(USER_FACING_ERROR_CODES.UNKNOWN_ERROR);
    expect(error.metadata).toEqual({
      createdAt: '2026-02-01T12:00:00.000Z',
      nested: { reason: 'test failure' },
    });
  });

  it('creates typed validation boundary errors from zod failures', () => {
    const schema = z.object({ workspaceId: z.string().uuid() });
    const parseResult = schema.safeParse({ workspaceId: 'invalid' });
    expect(parseResult.success).toBe(false);

    if (parseResult.success) {
      return;
    }

    const error = createValidationUserFacingError('WorkspacePayload', parseResult.error);
    expect(error.code).toBe(USER_FACING_ERROR_CODES.VALIDATION_FAILED);
    expect(error.validation.schema).toBe('WorkspacePayload');
    expect(error.validation.issues[0]?.path).toEqual(['workspaceId']);
  });

  it('maps AI provider errors into user-facing AI error codes', () => {
    const error = new RateLimitError('openai', 30, ['anthropic']);
    const userFacingError = createAIUserFacingError(error);

    expect(userFacingError.code).toBe(USER_FACING_ERROR_CODES.AI_RATE_LIMITED);
    expect(userFacingError.ai?.code).toBe('RATE_LIMITED');
    expect(userFacingError.metadata).toMatchObject({
      providerId: 'openai',
      aiCode: 'RATE_LIMITED',
    });
  });

  it('maps export errors into user-facing export error codes', () => {
    const exportError: FileExportError = {
      code: 'UNSUPPORTED_FORMAT',
      format: 'pdf',
      message: 'Format is disabled',
    };

    const userFacingError = createExportUserFacingError(exportError);
    expect(userFacingError.code).toBe(USER_FACING_ERROR_CODES.EXPORT_UNSUPPORTED_FORMAT);
    expect(userFacingError.metadata).toMatchObject({ format: 'pdf' });
  });

  it('serializes validation and export errors for IPC transport', () => {
    const payloadSchema = z.object({ name: z.string().min(1) });
    const parseResult = payloadSchema.safeParse({ name: '' });
    expect(parseResult.success).toBe(false);

    if (parseResult.success) {
      return;
    }

    const validationError = serializeErrorForIPC(parseResult.error, {
      schemaName: 'TemplatePayload',
    });
    expect(validationError.code).toBe(USER_FACING_ERROR_CODES.VALIDATION_FAILED);
    expect(validationError.validation?.schema).toBe('TemplatePayload');

    const exportError = serializeErrorForIPC({
      code: 'WRITE_FAILED',
      message: 'Disk full',
    } satisfies FileExportError);
    expect(exportError.code).toBe(USER_FACING_ERROR_CODES.EXPORT_WRITE_FAILED);
  });

  it('safe parse helper returns typed validation boundary errors', () => {
    const schema = z.object({ id: z.string().uuid() });

    const validResult = safeParseWithUserFacingValidation('WorkspaceRequest', schema, {
      id: '4f0fcc8a-6ec5-4f2a-8b56-8bbf95ef12cf',
    });
    expect(validResult).toEqual({
      ok: true,
      data: { id: '4f0fcc8a-6ec5-4f2a-8b56-8bbf95ef12cf' },
    });

    const invalidResult = safeParseWithUserFacingValidation('WorkspaceRequest', schema, {
      id: 'invalid',
    });
    expect(invalidResult.ok).toBe(false);
    if (!invalidResult.ok) {
      expect(invalidResult.error.code).toBe(USER_FACING_ERROR_CODES.VALIDATION_FAILED);
      expect(invalidResult.error.validation.schema).toBe('WorkspaceRequest');
    }
  });
});
