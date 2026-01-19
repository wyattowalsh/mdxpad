/**
 * Template Error Responses
 *
 * Feature: 016-template-library
 *
 * Factory functions for creating standardized error responses.
 *
 * @module template/errors
 */

import type { TemplateErrorResponse } from '@shared/contracts/template-schemas';

/**
 * Creates a validation error response.
 */
export function validationError(message: string): TemplateErrorResponse {
  return { success: false, error: message, code: 'VALIDATION_ERROR' };
}

/**
 * Creates a not found error response.
 */
export function notFoundError(message: string): TemplateErrorResponse {
  return { success: false, error: message, code: 'NOT_FOUND' };
}

/**
 * Creates a permission denied error response.
 */
export function permissionError(message: string): TemplateErrorResponse {
  return { success: false, error: message, code: 'PERMISSION_DENIED' };
}

/**
 * Creates a file error response.
 */
export function fileError(message: string): TemplateErrorResponse {
  return { success: false, error: message, code: 'FILE_ERROR' };
}

/**
 * Creates a parse error response.
 */
export function parseError(message: string): TemplateErrorResponse {
  return { success: false, error: message, code: 'PARSE_ERROR' };
}

/**
 * Creates an already exists error response.
 */
export function alreadyExistsError(message: string): TemplateErrorResponse {
  return { success: false, error: message, code: 'ALREADY_EXISTS' };
}
