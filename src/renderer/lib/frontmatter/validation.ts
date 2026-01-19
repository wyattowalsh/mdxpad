/**
 * Frontmatter Validation Utilities
 *
 * @module renderer/lib/frontmatter/validation
 * @description Validation functions for frontmatter field values.
 * Uses zod for schema-based validation with performance optimizations.
 */

import { z } from 'zod';
import type {
  FieldType,
  FieldValue,
  ValidationResult,
  ValidationError,
  ValidationErrorCode,
  SchemaProperty,
  FrontmatterField,
} from '@shared/types/frontmatter';
import { VALID_RESULT } from '@shared/types/frontmatter';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * ISO 8601 date format regex (YYYY-MM-DD)
 */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ISO 8601 datetime format regex (YYYY-MM-DDTHH:mm:ss)
 */
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Creates a ValidationResult with a single error.
 *
 * @param code - Error code
 * @param message - Error message
 * @param path - Optional field path
 * @returns ValidationResult
 */
function createErrorResult(
  code: ValidationErrorCode,
  message: string,
  path?: readonly string[]
): ValidationResult {
  const error: ValidationError = { code, message };
  if (path !== undefined) {
    // Use type assertion since we're explicitly checking for undefined
    (error as { path?: readonly string[] }).path = path;
  }
  return {
    valid: false,
    errors: [error],
    warnings: [],
  };
}

/**
 * Combines multiple validation results into one.
 *
 * @param results - Array of validation results
 * @returns Combined validation result
 */
function combineResults(...results: ValidationResult[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: { code: 'DEPRECATED' | 'UNKNOWN_FIELD'; message: string }[] = [];

  for (const result of results) {
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validates that a value is present when required.
 *
 * @param value - Value to validate
 * @param isRequired - Whether the field is required
 * @returns ValidationResult
 */
export function validateRequired(
  value: FieldValue,
  isRequired: boolean
): ValidationResult {
  if (!isRequired) {
    return VALID_RESULT;
  }

  /* eslint-disable @typescript-eslint/no-unnecessary-condition -- defensive check for runtime safety */
  const isEmpty =
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */

  if (isEmpty) {
    return createErrorResult('REQUIRED', 'This field is required');
  }

  return VALID_RESULT;
}

/**
 * Validates a date value against ISO 8601 format.
 *
 * @param value - Value to validate
 * @returns ValidationResult
 */
export function validateDate(value: FieldValue): ValidationResult {
  // Null/undefined are valid (handled by required validation)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive check for runtime safety
  if (value === null || value === undefined || value === '') {
    return VALID_RESULT;
  }

  // Handle Date objects
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return createErrorResult('INVALID_FORMAT', 'Invalid date');
    }
    return VALID_RESULT;
  }

  // Handle string dates
  if (typeof value === 'string') {
    // Check ISO 8601 date format (YYYY-MM-DD)
    if (ISO_DATE_REGEX.test(value)) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return createErrorResult('INVALID_FORMAT', 'Invalid date value');
      }
      return VALID_RESULT;
    }

    // Check ISO 8601 datetime format
    if (ISO_DATETIME_REGEX.test(value)) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return createErrorResult('INVALID_FORMAT', 'Invalid datetime value');
      }
      return VALID_RESULT;
    }

    return createErrorResult(
      'INVALID_FORMAT',
      'Date must be in ISO 8601 format (YYYY-MM-DD)'
    );
  }

  return createErrorResult('INVALID_TYPE', 'Expected a date value');
}

/**
 * Validates a number value with optional min/max constraints.
 *
 * @param value - Value to validate
 * @param min - Optional minimum value
 * @param max - Optional maximum value
 * @returns ValidationResult
 */
export function validateNumber(
  value: FieldValue,
  min?: number,
  max?: number
): ValidationResult {
  // Null/undefined are valid (handled by required validation)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive check for runtime safety
  if (value === null || value === undefined) {
    return VALID_RESULT;
  }

  // Allow empty string for number fields
  if (value === '') {
    return VALID_RESULT;
  }

  // Type check
  if (typeof value !== 'number') {
    return createErrorResult('INVALID_TYPE', 'Expected a number');
  }

  // Check for NaN
  if (Number.isNaN(value)) {
    return createErrorResult('INVALID_FORMAT', 'Value is not a valid number');
  }

  // Min constraint
  if (min !== undefined && value < min) {
    return createErrorResult('MIN_VALUE', `Value must be at least ${min}`);
  }

  // Max constraint
  if (max !== undefined && value > max) {
    return createErrorResult('MAX_VALUE', `Value must be at most ${max}`);
  }

  return VALID_RESULT;
}

/**
 * Validates a string value with optional length and pattern constraints.
 *
 * @param value - Value to validate
 * @param minLength - Optional minimum length
 * @param maxLength - Optional maximum length
 * @param pattern - Optional regex pattern
 * @returns ValidationResult
 */
export function validateString(
  value: FieldValue,
  minLength?: number,
  maxLength?: number,
  pattern?: string
): ValidationResult {
  // Null/undefined are valid (handled by required validation)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive check for runtime safety
  if (value === null || value === undefined) {
    return VALID_RESULT;
  }

  // Type check
  if (typeof value !== 'string') {
    return createErrorResult('INVALID_TYPE', 'Expected a string');
  }

  // Min length constraint
  if (minLength !== undefined && value.length < minLength) {
    return createErrorResult(
      'MIN_LENGTH',
      `Must be at least ${minLength} characters`
    );
  }

  // Max length constraint
  if (maxLength !== undefined && value.length > maxLength) {
    return createErrorResult(
      'MAX_LENGTH',
      `Must be at most ${maxLength} characters`
    );
  }

  // Pattern constraint
  if (pattern !== undefined) {
    try {
      const regex = new RegExp(pattern);
      if (!regex.test(value)) {
        return createErrorResult('PATTERN_MISMATCH', 'Value does not match required pattern');
      }
    } catch {
      // Invalid regex pattern - skip validation
      console.warn(`Invalid regex pattern in schema: ${pattern}`);
    }
  }

  return VALID_RESULT;
}

/**
 * Validates an array value.
 *
 * @param value - Value to validate
 * @param minItems - Optional minimum items
 * @param maxItems - Optional maximum items
 * @returns ValidationResult
 */
export function validateArray(
  value: FieldValue,
  minItems?: number,
  maxItems?: number
): ValidationResult {
  // Null/undefined are valid (handled by required validation)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive check for runtime safety
  if (value === null || value === undefined) {
    return VALID_RESULT;
  }

  // Type check
  if (!Array.isArray(value)) {
    return createErrorResult('INVALID_TYPE', 'Expected an array');
  }

  // Min items constraint
  if (minItems !== undefined && value.length < minItems) {
    return createErrorResult(
      'MIN_LENGTH',
      `Must have at least ${minItems} items`
    );
  }

  // Max items constraint
  if (maxItems !== undefined && value.length > maxItems) {
    return createErrorResult(
      'MAX_LENGTH',
      `Must have at most ${maxItems} items`
    );
  }

  return VALID_RESULT;
}

/**
 * Validates a boolean value.
 *
 * @param value - Value to validate
 * @returns ValidationResult
 */
export function validateBoolean(value: FieldValue): ValidationResult {
  // Null/undefined are valid (handled by required validation)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive check for runtime safety
  if (value === null || value === undefined) {
    return VALID_RESULT;
  }

  if (typeof value !== 'boolean') {
    return createErrorResult('INVALID_TYPE', 'Expected a boolean');
  }

  return VALID_RESULT;
}

/**
 * Validates a field value based on its type and optional schema constraints.
 *
 * @param value - Value to validate
 * @param type - Field type
 * @param schema - Optional schema property for additional constraints
 * @returns ValidationResult
 */
// eslint-disable-next-line max-lines-per-function -- comprehensive switch statement for all field types
export function validateField(
  value: FieldValue,
  type: FieldType,
  schema?: SchemaProperty
): ValidationResult {
  const results: ValidationResult[] = [];

  // Check required (from schema if provided)
  // Note: Required is typically checked at the form level, but included for completeness

  // Type-specific validation
  switch (type) {
    case 'text':
    case 'textarea':
      results.push(
        validateString(
          value,
          schema?.minLength,
          schema?.maxLength,
          schema?.pattern
        )
      );
      break;

    case 'number':
      results.push(validateNumber(value, schema?.minimum, schema?.maximum));
      break;

    case 'boolean':
      results.push(validateBoolean(value));
      break;

    case 'date':
      results.push(validateDate(value));
      break;

    case 'array':
      results.push(validateArray(value));
      // Validate individual items if item schema exists
      if (Array.isArray(value) && schema?.items) {
        for (let i = 0; i < value.length; i++) {
          const itemResult = validateString(value[i] as FieldValue);
          if (!itemResult.valid) {
            results.push({
              ...itemResult,
              errors: itemResult.errors.map((e) => ({
                ...e,
                message: `Item ${i + 1}: ${e.message}`,
              })),
            });
          }
        }
      }
      break;

    case 'object':
      // Object validation is recursive and handled separately
      if (value !== null && typeof value !== 'object') {
        results.push(createErrorResult('INVALID_TYPE', 'Expected an object'));
      }
      break;
  }

  return combineResults(...results);
}

/**
 * Creates a zod schema from a SchemaProperty for more complex validation.
 *
 * @param property - Schema property definition
 * @returns Zod schema
 */
// eslint-disable-next-line max-lines-per-function -- comprehensive switch statement for all schema types
export function schemaPropertyToZod(property: SchemaProperty): z.ZodType {
  let schema: z.ZodType;

  switch (property.type) {
    case 'string':
      {
        let stringSchema = z.string();

        if (property.minLength !== undefined) {
          stringSchema = stringSchema.min(property.minLength);
        }
        if (property.maxLength !== undefined) {
          stringSchema = stringSchema.max(property.maxLength);
        }
        if (property.pattern !== undefined) {
          try {
            stringSchema = stringSchema.regex(new RegExp(property.pattern));
          } catch {
            // Invalid regex, skip
          }
        }

        // Handle format hints
        if (property.format === 'date') {
          stringSchema = stringSchema.regex(
            ISO_DATE_REGEX,
            'Must be a valid date (YYYY-MM-DD)'
          );
        } else if (property.format === 'email') {
          stringSchema = stringSchema.email();
        } else if (property.format === 'uri' || property.format === 'url') {
          stringSchema = stringSchema.url();
        }

        schema = stringSchema;
      }
      break;

    case 'number':
      {
        let numberSchema = z.number();

        if (property.minimum !== undefined) {
          numberSchema = numberSchema.min(property.minimum);
        }
        if (property.maximum !== undefined) {
          numberSchema = numberSchema.max(property.maximum);
        }

        schema = numberSchema;
      }
      break;

    case 'boolean':
      schema = z.boolean();
      break;

    case 'array':
      if (property.items) {
        schema = z.array(schemaPropertyToZod(property.items));
      } else {
        schema = z.array(z.unknown());
      }
      break;

    case 'object':
      if (property.properties) {
        const shape: Record<string, z.ZodType> = {};
        for (const [key, propSchema] of Object.entries(property.properties)) {
          shape[key] = schemaPropertyToZod(propSchema);
        }
        schema = z.object(shape).passthrough();
      } else {
        schema = z.record(z.unknown());
      }
      break;

    default:
      schema = z.unknown();
  }

  return schema;
}

/**
 * Validates a value using a zod schema and converts to ValidationResult.
 *
 * @param value - Value to validate
 * @param zodSchema - Zod schema
 * @returns ValidationResult
 */
export function validateWithZod(
  value: FieldValue,
  zodSchema: z.ZodType
): ValidationResult {
  const result = zodSchema.safeParse(value);

  if (result.success) {
    return VALID_RESULT;
  }

  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    code: mapZodIssueToErrorCode(issue.code),
    message: issue.message,
    path: issue.path.map(String),
  }));

  return {
    valid: false,
    errors,
    warnings: [],
  };
}

/**
 * Maps a zod issue code to a ValidationErrorCode.
 *
 * @param zodCode - Zod issue code
 * @returns ValidationErrorCode
 */
function mapZodIssueToErrorCode(zodCode: z.ZodIssueCode): ValidationErrorCode {
  switch (zodCode) {
    case 'invalid_type':
      return 'INVALID_TYPE';
    case 'too_small':
      return 'MIN_LENGTH';
    case 'too_big':
      return 'MAX_LENGTH';
    case 'invalid_string':
      return 'PATTERN_MISMATCH';
    default:
      return 'INVALID_FORMAT';
  }
}

/**
 * Validates all fields and returns a map of field paths to validation results.
 *
 * @param fields - Array of frontmatter fields
 * @param requiredFields - Optional array of required field names
 * @param schemaProperties - Optional schema properties for validation rules
 * @returns Map of field path strings to validation results
 */
export function validateAllFields(
  fields: FrontmatterField[],
  requiredFields: readonly string[] = [],
  schemaProperties: Record<string, SchemaProperty> = {}
): Map<string, ValidationResult> {
  const results = new Map<string, ValidationResult>();

  for (const field of fields) {
    const pathKey = field.path.join('.');
    const isRequired = requiredFields.includes(field.name);
    const schema = schemaProperties[field.name];

    const validationResults: ValidationResult[] = [];

    // Required validation
    if (isRequired) {
      validationResults.push(validateRequired(field.value, true));
    }

    // Type-based validation
    validationResults.push(validateField(field.value, field.type, schema));

    results.set(pathKey, combineResults(...validationResults));
  }

  return results;
}

/**
 * Gets the count of validation errors from a set of fields.
 *
 * @param fields - Array of frontmatter fields
 * @returns Number of fields with validation errors
 */
export function getValidationErrorCount(fields: FrontmatterField[]): number {
  return fields.filter((f) => !f.validation.valid).length;
}

/**
 * Checks if any field has validation errors.
 *
 * @param fields - Array of frontmatter fields
 * @returns True if any field has errors
 */
export function hasValidationErrors(fields: FrontmatterField[]): boolean {
  return fields.some((f) => !f.validation.valid);
}
