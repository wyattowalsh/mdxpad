/**
 * Tests for frontmatter validation utilities.
 *
 * Tests field validation for all types, schema property conversion,
 * and validation aggregation.
 */

import { describe, it, expect } from 'vitest';
import {
  validateRequired,
  validateDate,
  validateNumber,
  validateString,
  validateArray,
  validateBoolean,
  validateField,
  schemaPropertyToZod,
  validateWithZod,
  validateAllFields,
  getValidationErrorCount,
  hasValidationErrors,
} from '../validation';
import type { FrontmatterField, FieldType, SchemaProperty } from '@shared/types/frontmatter';
import { VALID_RESULT } from '@shared/types/frontmatter';

describe('validateRequired', () => {
  it('should return valid for non-required fields', () => {
    expect(validateRequired(null, false)).toEqual(VALID_RESULT);
    expect(validateRequired('', false)).toEqual(VALID_RESULT);
  });

  it('should return error for null required field', () => {
    const result = validateRequired(null, true);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('REQUIRED');
  });

  it('should return error for empty string required field', () => {
    const result = validateRequired('', true);
    expect(result.valid).toBe(false);
  });

  it('should return error for empty array required field', () => {
    const result = validateRequired([], true);
    expect(result.valid).toBe(false);
  });

  it('should return valid for non-empty required field', () => {
    expect(validateRequired('hello', true)).toEqual(VALID_RESULT);
    expect(validateRequired(42, true)).toEqual(VALID_RESULT);
    expect(validateRequired(['item'], true)).toEqual(VALID_RESULT);
  });
});

describe('validateDate', () => {
  it('should accept null/empty values', () => {
    expect(validateDate(null)).toEqual(VALID_RESULT);
    expect(validateDate('')).toEqual(VALID_RESULT);
  });

  it('should accept valid ISO date strings', () => {
    expect(validateDate('2024-01-15')).toEqual(VALID_RESULT);
  });

  it('should accept valid ISO datetime strings', () => {
    expect(validateDate('2024-01-15T10:30:00Z')).toEqual(VALID_RESULT);
    expect(validateDate('2024-01-15T10:30:00+05:00')).toEqual(VALID_RESULT);
  });

  it('should accept Date objects', () => {
    expect(validateDate(new Date('2024-01-15'))).toEqual(VALID_RESULT);
  });

  it('should reject invalid Date objects', () => {
    const result = validateDate(new Date('invalid'));
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('INVALID_FORMAT');
  });

  it('should reject non-ISO date strings', () => {
    const result = validateDate('Jan 15, 2024');
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('INVALID_FORMAT');
  });

  it('should reject non-date types', () => {
    const result = validateDate(42);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('INVALID_TYPE');
  });
});

describe('validateNumber', () => {
  it('should accept null values', () => {
    expect(validateNumber(null)).toEqual(VALID_RESULT);
  });

  it('should accept empty string', () => {
    expect(validateNumber('')).toEqual(VALID_RESULT);
  });

  it('should accept valid numbers', () => {
    expect(validateNumber(42)).toEqual(VALID_RESULT);
    expect(validateNumber(0)).toEqual(VALID_RESULT);
    expect(validateNumber(-5)).toEqual(VALID_RESULT);
    expect(validateNumber(3.14)).toEqual(VALID_RESULT);
  });

  it('should reject NaN', () => {
    const result = validateNumber(NaN);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('INVALID_FORMAT');
  });

  it('should reject non-number types', () => {
    const result = validateNumber('42');
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('INVALID_TYPE');
  });

  it('should enforce min constraint', () => {
    const result = validateNumber(3, 5);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('MIN_VALUE');
  });

  it('should enforce max constraint', () => {
    const result = validateNumber(10, undefined, 5);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('MAX_VALUE');
  });

  it('should accept number within range', () => {
    expect(validateNumber(5, 1, 10)).toEqual(VALID_RESULT);
  });
});

describe('validateString', () => {
  it('should accept null values', () => {
    expect(validateString(null)).toEqual(VALID_RESULT);
  });

  it('should reject non-string types', () => {
    const result = validateString(42);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('INVALID_TYPE');
  });

  it('should enforce minLength', () => {
    const result = validateString('ab', 3);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('MIN_LENGTH');
  });

  it('should enforce maxLength', () => {
    const result = validateString('hello world', undefined, 5);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('MAX_LENGTH');
  });

  it('should enforce pattern', () => {
    const result = validateString('hello', undefined, undefined, '^[0-9]+$');
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('PATTERN_MISMATCH');
  });

  it('should accept string matching pattern', () => {
    expect(validateString('123', undefined, undefined, '^[0-9]+$')).toEqual(VALID_RESULT);
  });

  it('should handle invalid regex gracefully', () => {
    // Invalid regex should not crash
    const result = validateString('test', undefined, undefined, '[invalid');
    expect(result).toEqual(VALID_RESULT);
  });
});

describe('validateArray', () => {
  it('should accept null values', () => {
    expect(validateArray(null)).toEqual(VALID_RESULT);
  });

  it('should reject non-array types', () => {
    const result = validateArray('not array');
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('INVALID_TYPE');
  });

  it('should enforce minItems', () => {
    const result = validateArray(['a'], 2);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('MIN_LENGTH');
  });

  it('should enforce maxItems', () => {
    const result = validateArray(['a', 'b', 'c'], undefined, 2);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('MAX_LENGTH');
  });

  it('should accept array within bounds', () => {
    expect(validateArray(['a', 'b'], 1, 3)).toEqual(VALID_RESULT);
  });
});

describe('validateBoolean', () => {
  it('should accept null values', () => {
    expect(validateBoolean(null)).toEqual(VALID_RESULT);
  });

  it('should accept boolean values', () => {
    expect(validateBoolean(true)).toEqual(VALID_RESULT);
    expect(validateBoolean(false)).toEqual(VALID_RESULT);
  });

  it('should reject non-boolean types', () => {
    const result = validateBoolean('true');
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('INVALID_TYPE');
  });
});

describe('validateField', () => {
  it('should validate text fields', () => {
    expect(validateField('hello', 'text')).toEqual(VALID_RESULT);
  });

  it('should validate number fields', () => {
    expect(validateField(42, 'number')).toEqual(VALID_RESULT);
  });

  it('should validate boolean fields', () => {
    expect(validateField(true, 'boolean')).toEqual(VALID_RESULT);
  });

  it('should validate date fields', () => {
    expect(validateField('2024-01-15', 'date')).toEqual(VALID_RESULT);
  });

  it('should validate array fields', () => {
    expect(validateField(['a', 'b'], 'array')).toEqual(VALID_RESULT);
  });

  it('should validate object fields', () => {
    expect(validateField({ key: 'val' }, 'object')).toEqual(VALID_RESULT);
  });

  it('should reject non-object for object type', () => {
    const result = validateField('string', 'object');
    expect(result.valid).toBe(false);
  });

  it('should use schema constraints for string validation', () => {
    const schema: SchemaProperty = { type: 'string', minLength: 5 };
    const result = validateField('hi', 'text', schema);
    expect(result.valid).toBe(false);
  });

  it('should use schema constraints for number validation', () => {
    const schema: SchemaProperty = { type: 'number', minimum: 10 };
    const result = validateField(5, 'number', schema);
    expect(result.valid).toBe(false);
  });
});

describe('schemaPropertyToZod', () => {
  it('should create string schema', () => {
    const schema = schemaPropertyToZod({ type: 'string' });
    expect(schema.safeParse('hello').success).toBe(true);
    expect(schema.safeParse(42).success).toBe(false);
  });

  it('should create string schema with minLength', () => {
    const schema = schemaPropertyToZod({ type: 'string', minLength: 3 });
    expect(schema.safeParse('hi').success).toBe(false);
    expect(schema.safeParse('hello').success).toBe(true);
  });

  it('should create number schema', () => {
    const schema = schemaPropertyToZod({ type: 'number' });
    expect(schema.safeParse(42).success).toBe(true);
    expect(schema.safeParse('42').success).toBe(false);
  });

  it('should create boolean schema', () => {
    const schema = schemaPropertyToZod({ type: 'boolean' });
    expect(schema.safeParse(true).success).toBe(true);
    expect(schema.safeParse('true').success).toBe(false);
  });

  it('should create array schema', () => {
    const schema = schemaPropertyToZod({ type: 'array' });
    expect(schema.safeParse([1, 2, 3]).success).toBe(true);
  });

  it('should create object schema', () => {
    const schema = schemaPropertyToZod({ type: 'object' });
    expect(schema.safeParse({ key: 'val' }).success).toBe(true);
  });

  it('should handle email format', () => {
    const schema = schemaPropertyToZod({ type: 'string', format: 'email' });
    expect(schema.safeParse('test@example.com').success).toBe(true);
    expect(schema.safeParse('not-email').success).toBe(false);
  });

  it('should handle url format', () => {
    const schema = schemaPropertyToZod({ type: 'string', format: 'url' });
    expect(schema.safeParse('https://example.com').success).toBe(true);
    expect(schema.safeParse('not-url').success).toBe(false);
  });
});

describe('validateWithZod', () => {
  it('should return valid for passing schema', () => {
    const schema = schemaPropertyToZod({ type: 'string' });
    const result = validateWithZod('hello', schema);
    expect(result).toEqual(VALID_RESULT);
  });

  it('should return errors for failing schema', () => {
    const schema = schemaPropertyToZod({ type: 'number' });
    const result = validateWithZod('not a number', schema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('validateAllFields', () => {
  it('should validate all fields and return results map', () => {
    const fields: FrontmatterField[] = [
      {
        name: 'title',
        type: 'text' as FieldType,
        value: 'Hello',
        path: ['title'],
        validation: VALID_RESULT,
        isFromSchema: false,
        order: 0,
      },
      {
        name: 'count',
        type: 'number' as FieldType,
        value: 'not-a-number',
        path: ['count'],
        validation: VALID_RESULT,
        isFromSchema: false,
        order: 1,
      },
    ];

    const results = validateAllFields(fields);

    expect(results.get('title')?.valid).toBe(true);
    expect(results.get('count')?.valid).toBe(false);
  });

  it('should check required fields', () => {
    const fields: FrontmatterField[] = [
      {
        name: 'title',
        type: 'text' as FieldType,
        value: '',
        path: ['title'],
        validation: VALID_RESULT,
        isFromSchema: false,
        order: 0,
      },
    ];

    const results = validateAllFields(fields, ['title']);

    expect(results.get('title')?.valid).toBe(false);
  });
});

describe('getValidationErrorCount', () => {
  it('should count fields with errors', () => {
    const fields: FrontmatterField[] = [
      {
        name: 'a',
        type: 'text',
        value: '',
        path: ['a'],
        validation: VALID_RESULT,
        isFromSchema: false,
        order: 0,
      },
      {
        name: 'b',
        type: 'text',
        value: '',
        path: ['b'],
        validation: {
          valid: false,
          errors: [{ code: 'REQUIRED', message: 'Required' }],
          warnings: [],
        },
        isFromSchema: false,
        order: 1,
      },
    ];

    expect(getValidationErrorCount(fields)).toBe(1);
  });
});

describe('hasValidationErrors', () => {
  it('should return false when all valid', () => {
    const fields: FrontmatterField[] = [
      {
        name: 'a',
        type: 'text',
        value: 'x',
        path: ['a'],
        validation: VALID_RESULT,
        isFromSchema: false,
        order: 0,
      },
    ];
    expect(hasValidationErrors(fields)).toBe(false);
  });

  it('should return true when any field has errors', () => {
    const fields: FrontmatterField[] = [
      {
        name: 'a',
        type: 'text',
        value: 'x',
        path: ['a'],
        validation: VALID_RESULT,
        isFromSchema: false,
        order: 0,
      },
      {
        name: 'b',
        type: 'text',
        value: '',
        path: ['b'],
        validation: {
          valid: false,
          errors: [{ code: 'REQUIRED', message: 'Required' }],
          warnings: [],
        },
        isFromSchema: false,
        order: 1,
      },
    ];
    expect(hasValidationErrors(fields)).toBe(true);
  });
});
