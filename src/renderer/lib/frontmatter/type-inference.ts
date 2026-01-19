/**
 * Frontmatter Type Inference
 *
 * @module renderer/lib/frontmatter/type-inference
 * @description Infers field types from YAML values using pattern-based heuristics.
 * Follows priority order: boolean > number > date > array > object > textarea > text
 */

import type { FieldType, FieldValue } from '@shared/types/frontmatter';

/** ISO 8601 date pattern (YYYY-MM-DD) */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** ISO 8601 datetime pattern (YYYY-MM-DDTHH:MM:SS with optional timezone) */
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

/** YAML boolean strings (case-insensitive in YAML but we receive parsed values) */
const YAML_BOOLEAN_STRINGS = new Set(['true', 'false', 'yes', 'no', 'on', 'off']);

/**
 * Infers the field type from a value
 *
 * @param value - The value to analyze
 * @returns The inferred field type
 *
 * @example
 * inferFieldType(true) // 'boolean'
 * inferFieldType(42) // 'number'
 * inferFieldType('2024-01-15') // 'date'
 * inferFieldType(['tag1', 'tag2']) // 'array'
 * inferFieldType({ name: 'John' }) // 'object'
 * inferFieldType('Hello\nWorld') // 'textarea'
 * inferFieldType('Hello World') // 'text'
 */
export function inferFieldType(value: unknown): FieldType {
  // Null/undefined defaults to text
  if (value === null || value === undefined) {
    return 'text';
  }

  // Boolean (highest priority for primitives)
  if (typeof value === 'boolean') {
    return 'boolean';
  }

  // Number (includes integers and floats)
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return 'number';
  }

  // Array (before object check since arrays are objects in JS)
  if (Array.isArray(value)) {
    return 'array';
  }

  // Object (nested structure)
  if (typeof value === 'object') {
    return 'object';
  }

  // String-based type inference
  if (typeof value === 'string') {
    return inferStringType(value);
  }

  // Fallback
  return 'text';
}

/**
 * Infers type from a string value
 *
 * @param value - String value to analyze
 * @returns Inferred field type
 */
function inferStringType(value: string): FieldType {
  // Check for YAML boolean strings that may not have been parsed
  if (YAML_BOOLEAN_STRINGS.has(value.toLowerCase())) {
    // Return text since these would be parsed as boolean if valid YAML
    // If they're strings, user intended them as strings
    return 'text';
  }

  // Check for date formats
  if (ISO_DATE_REGEX.test(value) || ISO_DATETIME_REGEX.test(value)) {
    return 'date';
  }

  // Check for multi-line strings
  if (value.includes('\n')) {
    return 'textarea';
  }

  // Default to text
  return 'text';
}

/**
 * Checks if a value matches a specific field type
 *
 * @param value - Value to check
 * @param type - Expected field type
 * @returns True if value matches the type
 */
export function valueMatchesType(value: FieldValue, type: FieldType): boolean {
  if (value === null || value === undefined) {
    return type === 'text';
  }

  switch (type) {
    case 'boolean':
      return typeof value === 'boolean';

    case 'number':
      return typeof value === 'number' && !Number.isNaN(value);

    case 'date':
      if (typeof value !== 'string') return false;
      return ISO_DATE_REGEX.test(value) || ISO_DATETIME_REGEX.test(value);

    case 'array':
      return Array.isArray(value);

    case 'object':
      return typeof value === 'object' && !Array.isArray(value) && value !== null;

    case 'textarea':
      return typeof value === 'string' && value.includes('\n');

    case 'text':
      return typeof value === 'string';

    default:
      return false;
  }
}

/**
 * Converts a value to match a target field type
 *
 * @param value - Value to convert
 * @param targetType - Target field type
 * @returns Converted value or null if conversion fails
 */
export function convertToType(value: FieldValue, targetType: FieldType): FieldValue | null {
  if (value === null || value === undefined) {
    return getDefaultValue(targetType);
  }

  switch (targetType) {
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === 'yes' || lower === 'on') return true;
        if (lower === 'false' || lower === 'no' || lower === 'off') return false;
      }
      if (typeof value === 'number') return value !== 0;
      return null;

    case 'number':
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const num = Number(value);
        return Number.isNaN(num) ? null : num;
      }
      if (typeof value === 'boolean') return value ? 1 : 0;
      return null;

    case 'date':
      if (typeof value === 'string') {
        if (ISO_DATE_REGEX.test(value) || ISO_DATETIME_REGEX.test(value)) {
          return value;
        }
        // Try to parse as date
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
          const dateStr = date.toISOString().split('T')[0];
          return dateStr ?? '';
        }
      }
      if (value instanceof Date) {
        const dateStr = value.toISOString().split('T')[0];
        return dateStr ?? '';
      }
      return null;

    case 'array':
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        // Split comma-separated string
        return value.split(',').map((s) => s.trim()).filter(Boolean);
      }
      return [value];

    case 'object':
      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        return value;
      }
      return null;

    case 'textarea':
    case 'text':
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return null;

    default:
      return null;
  }
}

/**
 * Gets the default value for a field type
 *
 * @param type - Field type
 * @returns Default value for the type
 */
export function getDefaultValue(type: FieldType): FieldValue {
  switch (type) {
    case 'boolean':
      return false;
    case 'number':
      return 0;
    case 'date': {
      const dateStr = new Date().toISOString().split('T')[0];
      return dateStr ?? '';
    }
    case 'array':
      return [];
    case 'object':
      return {};
    case 'textarea':
    case 'text':
    default:
      return '';
  }
}

/**
 * Infers types for all values in an object
 *
 * @param data - Object with values to analyze
 * @returns Map of field names to inferred types
 */
export function inferTypesForObject(
  data: Record<string, unknown>
): Map<string, FieldType> {
  const types = new Map<string, FieldType>();

  for (const [key, value] of Object.entries(data)) {
    types.set(key, inferFieldType(value));
  }

  return types;
}

/**
 * Determines if a value is considered "empty" for its type
 *
 * @param value - Value to check
 * @param type - Field type
 * @returns True if value is empty
 */
export function isEmptyValue(value: FieldValue, type: FieldType): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  switch (type) {
    case 'text':
    case 'textarea':
      return typeof value === 'string' && value.trim() === '';

    case 'array':
      return Array.isArray(value) && value.length === 0;

    case 'object':
      return typeof value === 'object' &&
        !Array.isArray(value) &&
        value !== null &&
        Object.keys(value).length === 0;

    case 'boolean':
    case 'number':
    case 'date':
      // These types are never considered "empty" if they have a value
      return false;

    default:
      return false;
  }
}
