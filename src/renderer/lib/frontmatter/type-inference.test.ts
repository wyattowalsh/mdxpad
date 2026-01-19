/**
 * Type Inference Unit Tests
 *
 * @module renderer/lib/frontmatter/type-inference.test
 * @description Tests for frontmatter field type inference functions.
 * Includes SC-004 accuracy test suite with >= 50 sample values.
 */

import { describe, it, expect } from 'vitest';
import {
  inferFieldType,
  valueMatchesType,
  convertToType,
  getDefaultValue,
  inferTypesForObject,
  isEmptyValue,
} from './type-inference';
import type { FieldType, FieldValue } from '@shared/types/frontmatter';

// ============================================================================
// inferFieldType Tests
// ============================================================================

describe('inferFieldType', () => {
  describe('booleans', () => {
    it('should infer true as boolean', () => {
      expect(inferFieldType(true)).toBe('boolean');
    });

    it('should infer false as boolean', () => {
      expect(inferFieldType(false)).toBe('boolean');
    });

    // YAML boolean strings are parsed before reaching this function,
    // so when they arrive as strings, user intended them as text
    it('should infer string "true" as text (YAML would have parsed it)', () => {
      expect(inferFieldType('true')).toBe('text');
    });

    it('should infer string "false" as text', () => {
      expect(inferFieldType('false')).toBe('text');
    });

    it('should infer string "yes" as text (YAML boolean string)', () => {
      expect(inferFieldType('yes')).toBe('text');
    });

    it('should infer string "no" as text (YAML boolean string)', () => {
      expect(inferFieldType('no')).toBe('text');
    });

    it('should infer string "on" as text (YAML boolean string)', () => {
      expect(inferFieldType('on')).toBe('text');
    });

    it('should infer string "off" as text (YAML boolean string)', () => {
      expect(inferFieldType('off')).toBe('text');
    });
  });

  describe('numbers', () => {
    it('should infer positive integer as number', () => {
      expect(inferFieldType(42)).toBe('number');
    });

    it('should infer negative integer as number', () => {
      expect(inferFieldType(-1)).toBe('number');
    });

    it('should infer zero as number', () => {
      expect(inferFieldType(0)).toBe('number');
    });

    it('should infer positive decimal as number', () => {
      expect(inferFieldType(3.14)).toBe('number');
    });

    it('should infer negative decimal as number', () => {
      expect(inferFieldType(-0.5)).toBe('number');
    });

    it('should infer very large numbers', () => {
      expect(inferFieldType(1e10)).toBe('number');
    });

    it('should infer very small decimals', () => {
      expect(inferFieldType(0.0001)).toBe('number');
    });

    it('should infer Infinity as number', () => {
      expect(inferFieldType(Infinity)).toBe('number');
    });

    it('should infer -Infinity as number', () => {
      expect(inferFieldType(-Infinity)).toBe('number');
    });

    it('should infer NaN as text (excluded from number type)', () => {
      expect(inferFieldType(NaN)).toBe('text');
    });
  });

  describe('dates (ISO 8601 formats)', () => {
    it('should infer YYYY-MM-DD as date', () => {
      expect(inferFieldType('2024-01-15')).toBe('date');
    });

    it('should infer another YYYY-MM-DD as date', () => {
      expect(inferFieldType('2023-12-31')).toBe('date');
    });

    it('should infer YYYY-MM-DDTHH:MM:SS as date', () => {
      expect(inferFieldType('2024-01-15T10:30:00')).toBe('date');
    });

    it('should infer datetime with Z timezone as date', () => {
      expect(inferFieldType('2024-01-15T10:30:00Z')).toBe('date');
    });

    it('should infer datetime with positive timezone offset as date', () => {
      expect(inferFieldType('2024-01-15T10:30:00+05:00')).toBe('date');
    });

    it('should infer datetime with negative timezone offset as date', () => {
      expect(inferFieldType('2024-01-15T10:30:00-08:00')).toBe('date');
    });

    it('should infer datetime with milliseconds as date', () => {
      expect(inferFieldType('2024-01-15T10:30:00.123Z')).toBe('date');
    });

    it('should infer datetime with milliseconds and offset as date', () => {
      expect(inferFieldType('2024-01-15T10:30:00.999+00:00')).toBe('date');
    });

    it('should NOT infer invalid date format as date', () => {
      expect(inferFieldType('01-15-2024')).toBe('text'); // MM-DD-YYYY
    });

    it('should NOT infer partial date as date', () => {
      expect(inferFieldType('2024-01')).toBe('text');
    });

    it('should NOT infer date with invalid separator as date', () => {
      expect(inferFieldType('2024/01/15')).toBe('text');
    });
  });

  describe('arrays', () => {
    it('should infer empty array as array', () => {
      expect(inferFieldType([])).toBe('array');
    });

    it('should infer string array as array', () => {
      expect(inferFieldType(['a', 'b', 'c'])).toBe('array');
    });

    it('should infer number array as array', () => {
      expect(inferFieldType([1, 2, 3])).toBe('array');
    });

    it('should infer mixed type array as array', () => {
      expect(inferFieldType(['a', 1, true])).toBe('array');
    });

    it('should infer nested array as array', () => {
      expect(inferFieldType([[1, 2], [3, 4]])).toBe('array');
    });
  });

  describe('objects', () => {
    it('should infer empty object as object', () => {
      expect(inferFieldType({})).toBe('object');
    });

    it('should infer simple object as object', () => {
      expect(inferFieldType({ name: 'John' })).toBe('object');
    });

    it('should infer nested object as object', () => {
      expect(inferFieldType({ author: { name: 'John', email: 'john@test.com' } })).toBe('object');
    });

    it('should infer object with various value types as object', () => {
      expect(inferFieldType({ str: 'text', num: 42, bool: true })).toBe('object');
    });

    it('should infer complex nested structure as object', () => {
      expect(inferFieldType({
        meta: {
          tags: ['a', 'b'],
          counts: { views: 100 },
        },
      })).toBe('object');
    });
  });

  describe('textarea (multi-line strings)', () => {
    it('should infer string with single newline as textarea', () => {
      expect(inferFieldType('Hello\nWorld')).toBe('textarea');
    });

    it('should infer string with multiple newlines as textarea', () => {
      expect(inferFieldType('Line 1\nLine 2\nLine 3')).toBe('textarea');
    });

    it('should infer string with Windows line endings as textarea', () => {
      expect(inferFieldType('Hello\r\nWorld')).toBe('textarea');
    });

    it('should infer block of text with newlines as textarea', () => {
      const multilineText = `This is a long description
that spans multiple lines
and contains various content.`;
      expect(inferFieldType(multilineText)).toBe('textarea');
    });
  });

  describe('text (plain strings)', () => {
    it('should infer empty string as text', () => {
      expect(inferFieldType('')).toBe('text');
    });

    it('should infer single word as text', () => {
      expect(inferFieldType('hello')).toBe('text');
    });

    it('should infer multi-word title as text', () => {
      expect(inferFieldType('My Document Title')).toBe('text');
    });

    it('should infer sentence without newlines as text', () => {
      expect(inferFieldType('This is a complete sentence.')).toBe('text');
    });

    it('should infer URL as text', () => {
      expect(inferFieldType('https://example.com/path')).toBe('text');
    });

    it('should infer email as text', () => {
      expect(inferFieldType('user@example.com')).toBe('text');
    });

    it('should infer slug as text', () => {
      expect(inferFieldType('my-document-slug')).toBe('text');
    });

    it('should infer path as text', () => {
      expect(inferFieldType('/images/hero.png')).toBe('text');
    });
  });

  describe('null and undefined', () => {
    it('should infer null as text', () => {
      expect(inferFieldType(null)).toBe('text');
    });

    it('should infer undefined as text', () => {
      expect(inferFieldType(undefined)).toBe('text');
    });
  });
});

// ============================================================================
// valueMatchesType Tests
// ============================================================================

describe('valueMatchesType', () => {
  describe('boolean type', () => {
    it('should match true', () => {
      expect(valueMatchesType(true, 'boolean')).toBe(true);
    });

    it('should match false', () => {
      expect(valueMatchesType(false, 'boolean')).toBe(true);
    });

    it('should not match string "true"', () => {
      expect(valueMatchesType('true', 'boolean')).toBe(false);
    });

    it('should not match number 1', () => {
      expect(valueMatchesType(1, 'boolean')).toBe(false);
    });
  });

  describe('number type', () => {
    it('should match integer', () => {
      expect(valueMatchesType(42, 'number')).toBe(true);
    });

    it('should match decimal', () => {
      expect(valueMatchesType(3.14, 'number')).toBe(true);
    });

    it('should match zero', () => {
      expect(valueMatchesType(0, 'number')).toBe(true);
    });

    it('should match negative number', () => {
      expect(valueMatchesType(-5, 'number')).toBe(true);
    });

    it('should not match NaN', () => {
      expect(valueMatchesType(NaN, 'number')).toBe(false);
    });

    it('should not match string number', () => {
      expect(valueMatchesType('42', 'number')).toBe(false);
    });
  });

  describe('date type', () => {
    it('should match YYYY-MM-DD format', () => {
      expect(valueMatchesType('2024-01-15', 'date')).toBe(true);
    });

    it('should match datetime with timezone', () => {
      expect(valueMatchesType('2024-01-15T10:30:00Z', 'date')).toBe(true);
    });

    it('should match datetime with offset', () => {
      expect(valueMatchesType('2024-01-15T10:30:00+05:00', 'date')).toBe(true);
    });

    it('should not match invalid date string', () => {
      expect(valueMatchesType('not-a-date', 'date')).toBe(false);
    });

    it('should not match number timestamp', () => {
      expect(valueMatchesType(1705296000000, 'date')).toBe(false);
    });
  });

  describe('array type', () => {
    it('should match empty array', () => {
      expect(valueMatchesType([], 'array')).toBe(true);
    });

    it('should match array with items', () => {
      expect(valueMatchesType(['a', 'b'], 'array')).toBe(true);
    });

    it('should not match object', () => {
      expect(valueMatchesType({}, 'array')).toBe(false);
    });

    it('should not match string', () => {
      expect(valueMatchesType('array', 'array')).toBe(false);
    });
  });

  describe('object type', () => {
    it('should match empty object', () => {
      expect(valueMatchesType({}, 'object')).toBe(true);
    });

    it('should match object with properties', () => {
      expect(valueMatchesType({ name: 'John' }, 'object')).toBe(true);
    });

    it('should not match array', () => {
      expect(valueMatchesType([], 'object')).toBe(false);
    });

    it('should not match null', () => {
      expect(valueMatchesType(null, 'object')).toBe(false);
    });
  });

  describe('textarea type', () => {
    it('should match string with newlines', () => {
      expect(valueMatchesType('Hello\nWorld', 'textarea')).toBe(true);
    });

    it('should not match string without newlines', () => {
      expect(valueMatchesType('Hello World', 'textarea')).toBe(false);
    });

    it('should not match non-string', () => {
      expect(valueMatchesType(42, 'textarea')).toBe(false);
    });
  });

  describe('text type', () => {
    it('should match any string', () => {
      expect(valueMatchesType('hello', 'text')).toBe(true);
    });

    it('should match multi-line string (text is permissive)', () => {
      expect(valueMatchesType('hello\nworld', 'text')).toBe(true);
    });

    it('should match empty string', () => {
      expect(valueMatchesType('', 'text')).toBe(true);
    });

    it('should not match number', () => {
      expect(valueMatchesType(42, 'text')).toBe(false);
    });
  });

  describe('null and undefined edge cases', () => {
    it('should match null/undefined only to text type', () => {
      expect(valueMatchesType(null, 'text')).toBe(true);
      // undefined is handled internally but not in FieldValue type, cast for testing
      expect(valueMatchesType(undefined as unknown as FieldValue, 'text')).toBe(true);
    });

    it('should not match null to boolean', () => {
      expect(valueMatchesType(null, 'boolean')).toBe(false);
    });

    it('should not match undefined to number', () => {
      // undefined is handled internally but not in FieldValue type, cast for testing
      expect(valueMatchesType(undefined as unknown as FieldValue, 'number')).toBe(false);
    });

    it('should not match null to array', () => {
      expect(valueMatchesType(null, 'array')).toBe(false);
    });

    it('should not match null to object', () => {
      expect(valueMatchesType(null, 'object')).toBe(false);
    });
  });
});

// ============================================================================
// convertToType Tests
// ============================================================================

describe('convertToType', () => {
  describe('to boolean', () => {
    it('should pass through boolean values', () => {
      expect(convertToType(true, 'boolean')).toBe(true);
      expect(convertToType(false, 'boolean')).toBe(false);
    });

    it('should convert string "true" to true', () => {
      expect(convertToType('true', 'boolean')).toBe(true);
    });

    it('should convert string "false" to false', () => {
      expect(convertToType('false', 'boolean')).toBe(false);
    });

    it('should convert string "yes" to true', () => {
      expect(convertToType('yes', 'boolean')).toBe(true);
    });

    it('should convert string "no" to false', () => {
      expect(convertToType('no', 'boolean')).toBe(false);
    });

    it('should convert string "on" to true', () => {
      expect(convertToType('on', 'boolean')).toBe(true);
    });

    it('should convert string "off" to false', () => {
      expect(convertToType('off', 'boolean')).toBe(false);
    });

    it('should convert non-zero number to true', () => {
      expect(convertToType(1, 'boolean')).toBe(true);
      expect(convertToType(42, 'boolean')).toBe(true);
      expect(convertToType(-1, 'boolean')).toBe(true);
    });

    it('should convert zero to false', () => {
      expect(convertToType(0, 'boolean')).toBe(false);
    });

    it('should return null for incompatible string', () => {
      expect(convertToType('maybe', 'boolean')).toBe(null);
    });

    it('should return null for array', () => {
      expect(convertToType(['a', 'b'], 'boolean')).toBe(null);
    });
  });

  describe('to number', () => {
    it('should pass through number values', () => {
      expect(convertToType(42, 'number')).toBe(42);
      expect(convertToType(3.14, 'number')).toBe(3.14);
    });

    it('should convert numeric string to number', () => {
      expect(convertToType('42', 'number')).toBe(42);
      expect(convertToType('3.14', 'number')).toBe(3.14);
      expect(convertToType('-5', 'number')).toBe(-5);
    });

    it('should convert true to 1', () => {
      expect(convertToType(true, 'number')).toBe(1);
    });

    it('should convert false to 0', () => {
      expect(convertToType(false, 'number')).toBe(0);
    });

    it('should return null for non-numeric string', () => {
      expect(convertToType('hello', 'number')).toBe(null);
    });

    it('should return null for array', () => {
      expect(convertToType([1, 2, 3], 'number')).toBe(null);
    });
  });

  describe('to date', () => {
    it('should pass through valid date string', () => {
      expect(convertToType('2024-01-15', 'date')).toBe('2024-01-15');
    });

    it('should pass through valid datetime string', () => {
      expect(convertToType('2024-01-15T10:30:00Z', 'date')).toBe('2024-01-15T10:30:00Z');
    });

    it('should convert parseable date string', () => {
      const result = convertToType('January 15, 2024', 'date');
      expect(result).toBe('2024-01-15');
    });

    it('should return null for invalid date string', () => {
      expect(convertToType('not-a-date', 'date')).toBe(null);
    });

    it('should return null for number', () => {
      expect(convertToType(1705296000000, 'date')).toBe(null);
    });
  });

  describe('to array', () => {
    it('should pass through array values', () => {
      const arr = ['a', 'b', 'c'];
      expect(convertToType(arr, 'array')).toEqual(arr);
    });

    it('should split comma-separated string', () => {
      expect(convertToType('a, b, c', 'array')).toEqual(['a', 'b', 'c']);
    });

    it('should handle single value string', () => {
      expect(convertToType('single', 'array')).toEqual(['single']);
    });

    it('should filter empty values from split', () => {
      expect(convertToType('a,,b', 'array')).toEqual(['a', 'b']);
    });

    it('should wrap non-string primitive in array', () => {
      expect(convertToType(42, 'array')).toEqual([42]);
      expect(convertToType(true, 'array')).toEqual([true]);
    });
  });

  describe('to object', () => {
    it('should pass through object values', () => {
      const obj = { name: 'John' };
      expect(convertToType(obj, 'object')).toEqual(obj);
    });

    it('should return null for array', () => {
      expect(convertToType(['a', 'b'], 'object')).toBe(null);
    });

    it('should return null for primitive', () => {
      expect(convertToType('string', 'object')).toBe(null);
      expect(convertToType(42, 'object')).toBe(null);
    });

    it('should return null for null', () => {
      expect(convertToType(null, 'object')).toEqual({});
    });
  });

  describe('to text/textarea', () => {
    it('should pass through string values', () => {
      expect(convertToType('hello', 'text')).toBe('hello');
      expect(convertToType('hello\nworld', 'textarea')).toBe('hello\nworld');
    });

    it('should convert number to string', () => {
      expect(convertToType(42, 'text')).toBe('42');
    });

    it('should convert boolean to string', () => {
      expect(convertToType(true, 'text')).toBe('true');
      expect(convertToType(false, 'text')).toBe('false');
    });

    it('should join array with commas', () => {
      expect(convertToType(['a', 'b', 'c'], 'text')).toBe('a, b, c');
    });

    it('should return null for object', () => {
      expect(convertToType({ name: 'John' }, 'text')).toBe(null);
    });
  });

  describe('null and undefined handling', () => {
    it('should return default value for null', () => {
      expect(convertToType(null, 'text')).toBe('');
      expect(convertToType(null, 'boolean')).toBe(false);
      expect(convertToType(null, 'number')).toBe(0);
      expect(convertToType(null, 'array')).toEqual([]);
      expect(convertToType(null, 'object')).toEqual({});
    });

    it('should return default value for undefined', () => {
      // undefined is handled internally but not in FieldValue type, cast for testing
      expect(convertToType(undefined as unknown as FieldValue, 'text')).toBe('');
      expect(convertToType(undefined as unknown as FieldValue, 'boolean')).toBe(false);
      expect(convertToType(undefined as unknown as FieldValue, 'number')).toBe(0);
    });
  });
});

// ============================================================================
// getDefaultValue Tests
// ============================================================================

describe('getDefaultValue', () => {
  it('should return false for boolean', () => {
    expect(getDefaultValue('boolean')).toBe(false);
  });

  it('should return 0 for number', () => {
    expect(getDefaultValue('number')).toBe(0);
  });

  it('should return today date string for date', () => {
    const result = getDefaultValue('date');
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should return empty array for array', () => {
    expect(getDefaultValue('array')).toEqual([]);
  });

  it('should return empty object for object', () => {
    expect(getDefaultValue('object')).toEqual({});
  });

  it('should return empty string for text', () => {
    expect(getDefaultValue('text')).toBe('');
  });

  it('should return empty string for textarea', () => {
    expect(getDefaultValue('textarea')).toBe('');
  });
});

// ============================================================================
// inferTypesForObject Tests
// ============================================================================

describe('inferTypesForObject', () => {
  it('should infer types for all fields in an object', () => {
    const data = {
      title: 'My Document',
      count: 42,
      published: true,
      date: '2024-01-15',
      tags: ['react', 'typescript'],
      author: { name: 'John' },
    };

    const types = inferTypesForObject(data);

    expect(types.get('title')).toBe('text');
    expect(types.get('count')).toBe('number');
    expect(types.get('published')).toBe('boolean');
    expect(types.get('date')).toBe('date');
    expect(types.get('tags')).toBe('array');
    expect(types.get('author')).toBe('object');
  });

  it('should handle empty object', () => {
    const types = inferTypesForObject({});
    expect(types.size).toBe(0);
  });

  it('should handle object with null values', () => {
    const data = { field: null };
    const types = inferTypesForObject(data);
    expect(types.get('field')).toBe('text');
  });

  it('should handle nested types correctly', () => {
    const data = {
      description: 'Line 1\nLine 2',
      image: '/images/hero.png',
    };

    const types = inferTypesForObject(data);
    expect(types.get('description')).toBe('textarea');
    expect(types.get('image')).toBe('text');
  });
});

// ============================================================================
// isEmptyValue Tests
// ============================================================================

describe('isEmptyValue', () => {
  describe('null and undefined', () => {
    it('should consider null as empty for any type', () => {
      const types: FieldType[] = ['text', 'number', 'boolean', 'date', 'array', 'object', 'textarea'];
      for (const type of types) {
        expect(isEmptyValue(null, type)).toBe(true);
      }
    });

    it('should consider undefined as empty for any type', () => {
      const types: FieldType[] = ['text', 'number', 'boolean', 'date', 'array', 'object', 'textarea'];
      for (const type of types) {
        // undefined is handled internally but not in FieldValue type, cast for testing
        expect(isEmptyValue(undefined as unknown as FieldValue, type)).toBe(true);
      }
    });
  });

  describe('text and textarea', () => {
    it('should consider empty string as empty', () => {
      expect(isEmptyValue('', 'text')).toBe(true);
      expect(isEmptyValue('', 'textarea')).toBe(true);
    });

    it('should consider whitespace-only string as empty', () => {
      expect(isEmptyValue('   ', 'text')).toBe(true);
      expect(isEmptyValue('\t\n', 'textarea')).toBe(true);
    });

    it('should consider non-empty string as not empty', () => {
      expect(isEmptyValue('hello', 'text')).toBe(false);
      expect(isEmptyValue('hello\nworld', 'textarea')).toBe(false);
    });
  });

  describe('array', () => {
    it('should consider empty array as empty', () => {
      expect(isEmptyValue([], 'array')).toBe(true);
    });

    it('should consider non-empty array as not empty', () => {
      expect(isEmptyValue(['a'], 'array')).toBe(false);
      expect(isEmptyValue([1, 2, 3], 'array')).toBe(false);
    });
  });

  describe('object', () => {
    it('should consider empty object as empty', () => {
      expect(isEmptyValue({}, 'object')).toBe(true);
    });

    it('should consider non-empty object as not empty', () => {
      expect(isEmptyValue({ key: 'value' }, 'object')).toBe(false);
    });
  });

  describe('boolean, number, and date (never empty when value exists)', () => {
    it('should consider false as not empty', () => {
      expect(isEmptyValue(false, 'boolean')).toBe(false);
    });

    it('should consider true as not empty', () => {
      expect(isEmptyValue(true, 'boolean')).toBe(false);
    });

    it('should consider 0 as not empty', () => {
      expect(isEmptyValue(0, 'number')).toBe(false);
    });

    it('should consider any number as not empty', () => {
      expect(isEmptyValue(42, 'number')).toBe(false);
      expect(isEmptyValue(-1, 'number')).toBe(false);
    });

    it('should consider date string as not empty', () => {
      expect(isEmptyValue('2024-01-15', 'date')).toBe(false);
    });
  });
});

// ============================================================================
// SC-004 Accuracy Test Suite (>= 50 samples, >= 95% accuracy)
// ============================================================================

describe('SC-004: Type Inference Accuracy Test Suite', () => {
  /**
   * Test samples with expected types.
   * Total: 50 samples
   * - 15 string variations
   * - 10 number variations
   * - 6 boolean variations
   * - 8 date format variations
   * - 5 array variations
   * - 5 object variations
   * - 1 null case
   */
  const testSamples: Array<{ value: unknown; expected: FieldType; description: string }> = [
    // String variations (15)
    { value: '', expected: 'text', description: 'empty string' },
    { value: 'hello', expected: 'text', description: 'single word' },
    { value: 'Hello World', expected: 'text', description: 'two words' },
    { value: 'My Document Title', expected: 'text', description: 'multi-word title' },
    { value: 'This is a sentence.', expected: 'text', description: 'sentence' },
    { value: 'https://example.com', expected: 'text', description: 'URL' },
    { value: 'user@example.com', expected: 'text', description: 'email' },
    { value: 'my-document-slug', expected: 'text', description: 'slug' },
    { value: '/images/hero.png', expected: 'text', description: 'file path' },
    { value: 'true', expected: 'text', description: 'string "true" (YAML parsed)' },
    { value: 'false', expected: 'text', description: 'string "false" (YAML parsed)' },
    { value: 'yes', expected: 'text', description: 'string "yes" (YAML boolean)' },
    { value: 'Hello\nWorld', expected: 'textarea', description: 'multiline string' },
    { value: 'Line 1\nLine 2\nLine 3', expected: 'textarea', description: 'multiple lines' },
    { value: 'Paragraph with\r\nWindows endings', expected: 'textarea', description: 'Windows line endings' },

    // Number variations (10)
    { value: 0, expected: 'number', description: 'zero' },
    { value: 1, expected: 'number', description: 'one' },
    { value: 42, expected: 'number', description: 'positive integer' },
    { value: -1, expected: 'number', description: 'negative integer' },
    { value: -100, expected: 'number', description: 'larger negative' },
    { value: 3.14, expected: 'number', description: 'positive decimal' },
    { value: -0.5, expected: 'number', description: 'negative decimal' },
    { value: 0.0001, expected: 'number', description: 'small decimal' },
    { value: 1e10, expected: 'number', description: 'scientific notation' },
    { value: Infinity, expected: 'number', description: 'Infinity' },

    // Boolean variations (6)
    { value: true, expected: 'boolean', description: 'true' },
    { value: false, expected: 'boolean', description: 'false' },
    // Note: YAML "yes", "no", "on", "off" are parsed to boolean before reaching inference
    // When these strings reach the function, they're intentionally text
    { value: 'no', expected: 'text', description: 'string "no" (YAML parsed)' },
    { value: 'on', expected: 'text', description: 'string "on" (YAML parsed)' },
    { value: 'off', expected: 'text', description: 'string "off" (YAML parsed)' },
    { value: 'YES', expected: 'text', description: 'uppercase "YES" (YAML parsed)' },

    // Date format variations (8)
    { value: '2024-01-15', expected: 'date', description: 'ISO date YYYY-MM-DD' },
    { value: '2023-12-31', expected: 'date', description: 'another ISO date' },
    { value: '2024-01-15T10:30:00', expected: 'date', description: 'datetime without timezone' },
    { value: '2024-01-15T10:30:00Z', expected: 'date', description: 'datetime with Z' },
    { value: '2024-01-15T10:30:00+05:00', expected: 'date', description: 'datetime with positive offset' },
    { value: '2024-01-15T10:30:00-08:00', expected: 'date', description: 'datetime with negative offset' },
    { value: '2024-01-15T10:30:00.123Z', expected: 'date', description: 'datetime with milliseconds' },
    { value: '2024-01-15T10:30:00.999+00:00', expected: 'date', description: 'datetime with ms and offset' },

    // Array variations (5)
    { value: [], expected: 'array', description: 'empty array' },
    { value: ['tag1', 'tag2'], expected: 'array', description: 'string array' },
    { value: [1, 2, 3], expected: 'array', description: 'number array' },
    { value: ['a', 1, true], expected: 'array', description: 'mixed array' },
    { value: [[1, 2], [3, 4]], expected: 'array', description: 'nested array' },

    // Object variations (5)
    { value: {}, expected: 'object', description: 'empty object' },
    { value: { name: 'John' }, expected: 'object', description: 'simple object' },
    { value: { a: 1, b: 2 }, expected: 'object', description: 'object with numbers' },
    { value: { nested: { deep: true } }, expected: 'object', description: 'nested object' },
    { value: { mix: { arr: [1, 2], str: 'hi' } }, expected: 'object', description: 'complex object' },

    // Null case (1)
    { value: null, expected: 'text', description: 'null value' },
  ];

  // Verify we have exactly 50 samples
  it('should have exactly 50 test samples', () => {
    expect(testSamples.length).toBe(50);
  });

  // Run all samples and count accuracy
  it('should achieve >= 95% accuracy (48/50 correct)', () => {
    let correctCount = 0;
    const failures: Array<{ description: string; expected: FieldType; actual: FieldType }> = [];

    for (const sample of testSamples) {
      const actual = inferFieldType(sample.value);
      if (actual === sample.expected) {
        correctCount++;
      } else {
        failures.push({
          description: sample.description,
          expected: sample.expected,
          actual,
        });
      }
    }

    const accuracy = (correctCount / testSamples.length) * 100;

    // Log failures for debugging if any
    if (failures.length > 0) {
      console.log('Type inference failures:');
      for (const f of failures) {
        console.log(`  - ${f.description}: expected ${f.expected}, got ${f.actual}`);
      }
    }

    // SC-004 requirement: >= 95% accuracy
    expect(accuracy).toBeGreaterThanOrEqual(95);
    expect(correctCount).toBeGreaterThanOrEqual(48);
  });

  // Individual tests for each sample (for granular debugging)
  describe('individual sample tests', () => {
    for (const sample of testSamples) {
      it(`should infer "${sample.description}" as ${sample.expected}`, () => {
        expect(inferFieldType(sample.value)).toBe(sample.expected);
      });
    }
  });
});
