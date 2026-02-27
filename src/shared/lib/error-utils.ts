import { ZodError, type z } from 'zod';

import {
  AIErrorCodes,
  isAIProviderError,
  serializeAIError,
  type SerializedAIError,
} from '@shared/ai/errors';
import type { FileExportError } from '@shared/contracts/file-schemas';
import {
  ValidationBoundaryErrorSchema,
  createValidationBoundaryError,
  safeParseWithValidationBoundary,
  type ValidationBoundaryError,
} from '@shared/types/root';

export const USER_FACING_ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  WORKSPACE_ACCESS_DENIED: 'WORKSPACE_ACCESS_DENIED',
  WORKSPACE_INVALID_STATE: 'WORKSPACE_INVALID_STATE',
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  EXPORT_UNSUPPORTED_FORMAT: 'EXPORT_UNSUPPORTED_FORMAT',
  EXPORT_WRITE_FAILED: 'EXPORT_WRITE_FAILED',
  EXPORT_CANCELLED: 'EXPORT_CANCELLED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type UserFacingErrorCode =
  (typeof USER_FACING_ERROR_CODES)[keyof typeof USER_FACING_ERROR_CODES];

export const USER_FACING_ERROR_MESSAGES: Readonly<Record<UserFacingErrorCode, string>> = {
  VALIDATION_FAILED: 'Some data is invalid. Please review and try again.',
  WORKSPACE_NOT_FOUND: 'The requested workspace could not be found.',
  WORKSPACE_ACCESS_DENIED: 'MDXPad does not have permission to access that workspace.',
  WORKSPACE_INVALID_STATE: 'The workspace is in an invalid state.',
  AI_PROVIDER_ERROR: 'The AI request failed. Please try again.',
  AI_RATE_LIMITED: 'The AI provider is rate limited. Please wait and retry.',
  EXPORT_UNSUPPORTED_FORMAT: 'This export format is not currently supported.',
  EXPORT_WRITE_FAILED: 'The exported file could not be written to disk.',
  EXPORT_CANCELLED: 'The export was cancelled.',
  UNKNOWN_ERROR: 'An unexpected error occurred.',
};

export type IpcSafePrimitive = string | number | boolean | null;
export type IpcSafeValue =
  | IpcSafePrimitive
  | readonly IpcSafeValue[]
  | { readonly [key: string]: IpcSafeValue };
export type IpcSafeRecord = Readonly<Record<string, IpcSafeValue>>;

export interface UserFacingError<TCode extends string = UserFacingErrorCode> {
  readonly code: TCode;
  readonly message: string;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly details?: string;
  readonly metadata?: IpcSafeRecord;
}

export interface ValidationUserFacingError extends UserFacingError<
  typeof USER_FACING_ERROR_CODES.VALIDATION_FAILED
> {
  readonly validation: ValidationBoundaryError;
}

type AIUserFacingErrorCode =
  | typeof USER_FACING_ERROR_CODES.AI_PROVIDER_ERROR
  | typeof USER_FACING_ERROR_CODES.AI_RATE_LIMITED;

export interface AIUserFacingError extends UserFacingError<AIUserFacingErrorCode> {
  readonly ai: SerializedAIError;
}

export type ExportUserFacingErrorCode =
  | typeof USER_FACING_ERROR_CODES.EXPORT_UNSUPPORTED_FORMAT
  | typeof USER_FACING_ERROR_CODES.EXPORT_WRITE_FAILED
  | typeof USER_FACING_ERROR_CODES.EXPORT_CANCELLED
  | typeof USER_FACING_ERROR_CODES.UNKNOWN_ERROR;

export interface SerializedIpcError extends UserFacingError<string> {
  readonly ai?: SerializedAIError;
  readonly validation?: ValidationBoundaryError;
}

export interface CreateUserFacingErrorOptions {
  userMessage?: string;
  details?: string;
  metadata?: Record<string, unknown>;
  retryable?: boolean;
}

export interface SerializeErrorForIpcOptions {
  readonly schemaName?: string;
}

export type UserFacingValidationResult<TOutput> =
  | { readonly ok: true; readonly data: TOutput }
  | { readonly ok: false; readonly error: ValidationUserFacingError };

export function createUserFacingError<TCode extends UserFacingErrorCode>(
  code: TCode,
  message: string,
  options: CreateUserFacingErrorOptions = {}
): UserFacingError<TCode> {
  const safeMetadata = toIpcSafeRecord(options.metadata);

  return {
    code,
    message,
    userMessage: options.userMessage ?? USER_FACING_ERROR_MESSAGES[code],
    retryable: options.retryable ?? false,
    ...(options.details !== undefined ? { details: options.details } : {}),
    ...(safeMetadata !== undefined ? { metadata: safeMetadata } : {}),
  };
}

export function createWorkspaceUserFacingError(
  code:
    | typeof USER_FACING_ERROR_CODES.WORKSPACE_NOT_FOUND
    | typeof USER_FACING_ERROR_CODES.WORKSPACE_ACCESS_DENIED
    | typeof USER_FACING_ERROR_CODES.WORKSPACE_INVALID_STATE,
  message: string,
  options: CreateUserFacingErrorOptions = {}
): UserFacingError<typeof code> {
  return createUserFacingError(code, message, options);
}

export function createValidationUserFacingError(
  schemaName: string,
  error: ZodError
): ValidationUserFacingError {
  const validation = createValidationBoundaryError(schemaName, error);
  return createValidationUserFacingErrorFromBoundary(validation);
}

export function createAIUserFacingError(
  error: Parameters<typeof serializeAIError>[0]
): AIUserFacingError {
  const ai = serializeAIError(error);
  const code = mapAiCodeToUserFacingCode(ai.code);
  const metadata: Record<string, unknown> = {
    aiCode: ai.code,
  };

  if (ai.providerId !== undefined) {
    metadata.providerId = ai.providerId;
  }

  return {
    ...createUserFacingError(code, ai.message, {
      retryable: ai.code === AIErrorCodes.RATE_LIMITED,
      metadata,
    }),
    ai,
  };
}

export function createExportUserFacingError(
  error: FileExportError
): UserFacingError<ExportUserFacingErrorCode> {
  switch (error.code) {
    case 'CANCELLED':
      return createUserFacingError(USER_FACING_ERROR_CODES.EXPORT_CANCELLED, 'Export cancelled');

    case 'UNSUPPORTED_FORMAT':
      return createUserFacingError(
        USER_FACING_ERROR_CODES.EXPORT_UNSUPPORTED_FORMAT,
        error.message,
        {
          metadata: { format: error.format },
        }
      );

    case 'WRITE_FAILED':
      return createUserFacingError(USER_FACING_ERROR_CODES.EXPORT_WRITE_FAILED, error.message);

    case 'UNKNOWN':
      return createUserFacingError(USER_FACING_ERROR_CODES.UNKNOWN_ERROR, error.message);
  }
}

export function serializeErrorForIPC(
  error: unknown,
  options: SerializeErrorForIpcOptions = {}
): SerializedIpcError {
  if (isAIProviderError(error)) {
    return createAIUserFacingError(error);
  }

  if (error instanceof ZodError) {
    return createValidationUserFacingError(options.schemaName ?? 'IPC payload', error);
  }

  if (isValidationBoundaryError(error)) {
    return createValidationUserFacingErrorFromBoundary(error);
  }

  if (isFileExportError(error)) {
    return createExportUserFacingError(error);
  }

  if (isUserFacingError(error)) {
    const safeMetadata = toIpcSafeRecord(error.metadata as Record<string, unknown> | undefined);
    return {
      code: error.code,
      message: error.message,
      userMessage: error.userMessage,
      retryable: error.retryable,
      ...(error.details !== undefined ? { details: error.details } : {}),
      ...(safeMetadata !== undefined ? { metadata: safeMetadata } : {}),
    };
  }

  if (error instanceof Error) {
    const options: CreateUserFacingErrorOptions = {};
    if (error.stack !== undefined) {
      options.details = error.stack;
    }

    return createUserFacingError(USER_FACING_ERROR_CODES.UNKNOWN_ERROR, error.message, options);
  }

  return createUserFacingError(USER_FACING_ERROR_CODES.UNKNOWN_ERROR, String(error));
}

export function safeParseWithUserFacingValidation<TOutput>(
  schemaName: string,
  schema: z.ZodType<TOutput, z.ZodTypeDef, unknown>,
  input: unknown
): UserFacingValidationResult<TOutput> {
  const result = safeParseWithValidationBoundary(schemaName, schema, input);
  if (result.ok) {
    return { ok: true, data: result.data };
  }

  return {
    ok: false,
    error: createValidationUserFacingErrorFromBoundary(result.error),
  };
}

export function isValidationBoundaryError(error: unknown): error is ValidationBoundaryError {
  return ValidationBoundaryErrorSchema.safeParse(error).success;
}

function createValidationUserFacingErrorFromBoundary(
  validation: ValidationBoundaryError
): ValidationUserFacingError {
  const details =
    validation.issues.length === 0
      ? undefined
      : validation.issues
          .map((issue) => {
            const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
            return `${path}: ${issue.message}`;
          })
          .join('; ');

  const options: CreateUserFacingErrorOptions = {
    metadata: { schema: validation.schema },
  };

  if (details !== undefined) {
    options.details = details;
  }

  return {
    ...createUserFacingError(
      USER_FACING_ERROR_CODES.VALIDATION_FAILED,
      validation.message,
      options
    ),
    validation,
  };
}

function mapAiCodeToUserFacingCode(code: string): AIUserFacingErrorCode {
  return code === AIErrorCodes.RATE_LIMITED
    ? USER_FACING_ERROR_CODES.AI_RATE_LIMITED
    : USER_FACING_ERROR_CODES.AI_PROVIDER_ERROR;
}

function isUserFacingError(error: unknown): error is UserFacingError<string> {
  if (!isPlainObject(error)) {
    return false;
  }

  return (
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    typeof error.userMessage === 'string' &&
    typeof error.retryable === 'boolean'
  );
}

function isFileExportError(error: unknown): error is FileExportError {
  if (!isPlainObject(error)) {
    return false;
  }

  return (
    error.code === 'CANCELLED' ||
    error.code === 'UNSUPPORTED_FORMAT' ||
    error.code === 'WRITE_FAILED' ||
    error.code === 'UNKNOWN'
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

function toIpcSafeRecord(metadata: Record<string, unknown> | undefined): IpcSafeRecord | undefined {
  if (metadata === undefined) {
    return undefined;
  }

  const result: Record<string, IpcSafeValue> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined) {
      result[key] = toIpcSafeValue(value);
    }
  }

  return result;
}

function toIpcSafeValue(value: unknown): IpcSafeValue {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return value.message;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toIpcSafeValue(item));
  }

  if (isPlainObject(value)) {
    const nested: Record<string, IpcSafeValue> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (nestedValue !== undefined) {
        nested[key] = toIpcSafeValue(nestedValue);
      }
    }
    return nested;
  }

  return Object.prototype.toString.call(value);
}
