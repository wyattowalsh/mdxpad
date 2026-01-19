/**
 * Schema Module Unit Tests
 *
 * Tests for frontmatter schema loading, validation, parsing,
 * and zod converter utilities.
 *
 * @module renderer/lib/frontmatter/schema.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  SCHEMA_FILENAME,
  SCHEMA_LOAD_TIMEOUT_MS,
  validateSchemaFile,
  parseSchemaFile,
  clearSchemaCache,
  getWorkspaceRoot,
  getSchemaPath,
  loadSchemaFromFile,
  loadSchemaForWorkspace,
  schemaPropertyToZod,
  schemaToZodValidator,
  validateFieldValue,
  getSuggestedFields,
  sortFieldsBySchemaOrder,
  getFieldPlaceholder,
  isFieldHidden,
  getFieldDescription,
} from './schema';
import type { FrontmatterSchema, SchemaProperty } from '@shared/types/frontmatter';
import { EMPTY_SCHEMA, VALID_RESULT } from '@shared/types/frontmatter';

// ============================================================================
// Mock Setup
// ============================================================================

/**
 * Mock the window.mdxpad API for file reading tests.
 */
function mockMdxpadApi(implementation?: {
  readFile?: (path: string) => Promise<{ ok: true; value: string } | { ok: false; error: { code: string; message: string } }>;
}): void {
  const defaultReadFile = async () => ({ ok: false as const, error: { code: 'NOT_FOUND', message: 'File not found' } });

  (globalThis as unknown as { window: unknown }).window = {
    mdxpad: {
      readFile: implementation?.readFile ?? defaultReadFile,
    },
  };
}

function clearMdxpadApi(): void {
  (globalThis as unknown as { window: unknown }).window = {};
}

// ============================================================================
// validateSchemaFile Tests
// ============================================================================

describe('validateSchemaFile', () => {
  describe('valid schemas', () => {
    it('should validate empty schema', () => {
      const result = validateSchemaFile({});
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate schema with $schema field', () => {
      const result = validateSchemaFile({
        $schema: 'http://json-schema.org/draft-07/schema#',
      });
      expect(result.valid).toBe(true);
    });

    it('should validate schema with properties', () => {
      const result = validateSchemaFile({
        properties: {
          title: { type: 'string' },
          count: { type: 'number' },
        },
      });
      expect(result.valid).toBe(true);
    });

    it('should validate schema with required array', () => {
      const result = validateSchemaFile({
        properties: {
          title: { type: 'string' },
        },
        required: ['title'],
      });
      expect(result.valid).toBe(true);
    });

    it('should validate schema with all property types', () => {
      const result = validateSchemaFile({
        properties: {
          text: { type: 'string' },
          num: { type: 'number' },
          flag: { type: 'boolean' },
          list: { type: 'array' },
          obj: { type: 'object' },
        },
      });
      expect(result.valid).toBe(true);
    });

    it('should validate schema with format hints', () => {
      const result = validateSchemaFile({
        properties: {
          date: { type: 'string', format: 'date' },
          datetime: { type: 'string', format: 'date-time' },
          email: { type: 'string', format: 'email' },
          url: { type: 'string', format: 'uri' },
          id: { type: 'string', format: 'uuid' },
        },
      });
      expect(result.valid).toBe(true);
    });

    it('should validate schema with x-frontmatter extensions', () => {
      const result = validateSchemaFile({
        properties: {
          title: {
            type: 'string',
            'x-frontmatter': {
              suggested: true,
              order: 1,
              hidden: false,
              placeholder: 'Enter title',
            },
          },
        },
      });
      expect(result.valid).toBe(true);
    });

    it('should validate schema with nested object properties', () => {
      const result = validateSchemaFile({
        properties: {
          author: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string', format: 'email' },
            },
          },
        },
      });
      expect(result.valid).toBe(true);
    });

    it('should validate schema with array items', () => {
      const result = validateSchemaFile({
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      });
      expect(result.valid).toBe(true);
    });

    it('should validate schema with constraints', () => {
      const result = validateSchemaFile({
        properties: {
          title: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            pattern: '^[A-Z]',
          },
          rating: {
            type: 'number',
            minimum: 0,
            maximum: 5,
          },
        },
      });
      expect(result.valid).toBe(true);
    });

    it('should validate schema with enum', () => {
      const result = validateSchemaFile({
        properties: {
          status: {
            type: 'string',
            enum: ['draft', 'published', 'archived'],
          },
        },
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid schemas', () => {
    it('should return errors for invalid type', () => {
      const result = validateSchemaFile({
        properties: {
          title: { type: 'invalid' },
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return errors for invalid format', () => {
      const result = validateSchemaFile({
        properties: {
          date: { type: 'string', format: 'invalid-format' },
        },
      });
      expect(result.valid).toBe(false);
    });

    it('should return errors for invalid x-frontmatter extension', () => {
      const result = validateSchemaFile({
        properties: {
          title: {
            type: 'string',
            'x-frontmatter': {
              suggested: 'yes', // Should be boolean
            },
          },
        },
      });
      expect(result.valid).toBe(false);
    });

    it('should return errors for non-integer order', () => {
      const result = validateSchemaFile({
        properties: {
          title: {
            type: 'string',
            'x-frontmatter': {
              order: 1.5, // Should be integer
            },
          },
        },
      });
      expect(result.valid).toBe(false);
    });

    it('should return errors for negative minLength', () => {
      const result = validateSchemaFile({
        properties: {
          title: {
            type: 'string',
            minLength: -1,
          },
        },
      });
      expect(result.valid).toBe(false);
    });

    it('should handle non-object input', () => {
      const result = validateSchemaFile('not an object');
      expect(result.valid).toBe(false);
    });

    it('should handle null input', () => {
      const result = validateSchemaFile(null);
      expect(result.valid).toBe(false);
    });
  });
});

// ============================================================================
// parseSchemaFile Tests
// ============================================================================

describe('parseSchemaFile', () => {
  it('should convert JSON to FrontmatterSchema with project source', () => {
    const json = {
      properties: {
        title: { type: 'string' },
      },
      required: ['title'],
    };

    const result = parseSchemaFile(json, { type: 'project', path: '/test/schema.json' });

    expect(result.properties).toHaveProperty('title');
    expect(result.required).toEqual(['title']);
    expect(result.source).toEqual({ type: 'project', path: '/test/schema.json' });
  });

  it('should convert JSON to FrontmatterSchema with user source', () => {
    const json = { properties: {} };

    const result = parseSchemaFile(json, { type: 'user' });

    expect(result.source).toEqual({ type: 'user' });
  });

  it('should default to empty properties and required', () => {
    const json = {};

    const result = parseSchemaFile(json, { type: 'none' });

    expect(result.properties).toEqual({});
    expect(result.required).toEqual([]);
  });

  it('should preserve all property definitions', () => {
    const json = {
      properties: {
        title: {
          type: 'string',
          description: 'Page title',
          minLength: 1,
          maxLength: 100,
          'x-frontmatter': {
            suggested: true,
            order: 1,
          },
        },
      },
    };

    const result = parseSchemaFile(json, { type: 'project', path: '/test.json' });

    expect(result.properties.title).toEqual(json.properties.title);
  });
});

// ============================================================================
// loadSchemaFromFile Tests
// ============================================================================

describe('loadSchemaFromFile', () => {
  beforeEach(() => {
    clearSchemaCache();
    clearMdxpadApi();
  });

  afterEach(() => {
    clearMdxpadApi();
  });

  it('should load valid schema file', async () => {
    const schemaContent = JSON.stringify({
      properties: {
        title: { type: 'string' },
      },
    });

    mockMdxpadApi({
      readFile: async () => ({ ok: true, value: schemaContent }),
    });

    const result = await loadSchemaFromFile('/project/frontmatter.schema.json');

    expect(result).not.toBeNull();
    expect(result?.properties).toHaveProperty('title');
    expect(result?.source).toEqual({
      type: 'project',
      path: '/project/frontmatter.schema.json',
    });
  });

  it('should return null for missing file', async () => {
    mockMdxpadApi({
      readFile: async () => ({ ok: false, error: { code: 'NOT_FOUND', message: 'File not found' } }),
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await loadSchemaFromFile('/project/frontmatter.schema.json');

    expect(result).toBeNull();
    consoleSpy.mockRestore();
  });

  it('should handle invalid JSON', async () => {
    mockMdxpadApi({
      readFile: async () => ({ ok: true, value: 'not valid json {' }),
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await loadSchemaFromFile('/project/frontmatter.schema.json');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should cache schema in memory', async () => {
    const schemaContent = JSON.stringify({
      properties: { title: { type: 'string' } },
    });

    const readFileMock = vi.fn(async () => ({ ok: true as const, value: schemaContent }));
    mockMdxpadApi({ readFile: readFileMock });

    // First load
    const result1 = await loadSchemaFromFile('/project/schema.json');
    expect(result1).not.toBeNull();
    expect(readFileMock).toHaveBeenCalledTimes(1);

    // Second load - should use cache
    const result2 = await loadSchemaFromFile('/project/schema.json');
    expect(result2).not.toBeNull();
    expect(readFileMock).toHaveBeenCalledTimes(1); // Still 1, used cache
  });

  it('should return null when API is not available', async () => {
    // Don't set up the mock API
    (globalThis as unknown as { window: unknown }).window = {};

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await loadSchemaFromFile('/project/schema.json');

    expect(result).toBeNull();
    consoleSpy.mockRestore();
  });

  it('should handle read errors other than NOT_FOUND', async () => {
    mockMdxpadApi({
      readFile: async () => ({
        ok: false,
        error: { code: 'PERMISSION_DENIED', message: 'Access denied' },
      }),
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await loadSchemaFromFile('/project/schema.json');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should handle validation failures', async () => {
    const invalidSchema = JSON.stringify({
      properties: {
        title: { type: 'not-a-valid-type' },
      },
    });

    mockMdxpadApi({
      readFile: async () => ({ ok: true, value: invalidSchema }),
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await loadSchemaFromFile('/project/schema.json');

    expect(result).toBeNull();
    consoleSpy.mockRestore();
  });
});

// ============================================================================
// loadSchemaForWorkspace Tests
// ============================================================================

describe('loadSchemaForWorkspace', () => {
  beforeEach(() => {
    clearSchemaCache();
    clearMdxpadApi();
  });

  afterEach(() => {
    clearMdxpadApi();
  });

  it('should return empty schema when no file is open', async () => {
    const result = await loadSchemaForWorkspace(null);
    expect(result).toEqual(EMPTY_SCHEMA);
  });

  it('should load schema from workspace root', async () => {
    const schemaContent = JSON.stringify({
      properties: { title: { type: 'string' } },
    });

    mockMdxpadApi({
      readFile: async () => ({ ok: true, value: schemaContent }),
    });

    const result = await loadSchemaForWorkspace('/project/docs/readme.md');

    expect(result.properties).toHaveProperty('title');
    expect(result.source).toEqual({
      type: 'project',
      path: '/project/docs/frontmatter.schema.json',
    });
  });

  it('should return schema with none source when no schema found', async () => {
    mockMdxpadApi({
      readFile: async () => ({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Not found' },
      }),
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await loadSchemaForWorkspace('/project/readme.md');

    expect(result.source).toEqual({ type: 'none' });
    consoleSpy.mockRestore();
  });
});

// ============================================================================
// getWorkspaceRoot Tests
// ============================================================================

describe('getWorkspaceRoot', () => {
  it('should extract directory from Unix path', () => {
    const result = getWorkspaceRoot('/Users/test/project/docs/file.md');
    expect(result).toBe('/Users/test/project/docs');
  });

  it('should extract directory from Windows path', () => {
    const result = getWorkspaceRoot('C:\\Users\\test\\project\\file.md');
    expect(result).toBe('C:\\Users\\test\\project');
  });

  it('should handle path with both separators', () => {
    const result = getWorkspaceRoot('/Users/test\\project/file.md');
    expect(result).toBe('/Users/test\\project');
  });

  it('should return original path if no separator', () => {
    const result = getWorkspaceRoot('file.md');
    expect(result).toBe('file.md');
  });
});

// ============================================================================
// getSchemaPath Tests
// ============================================================================

describe('getSchemaPath', () => {
  it('should append schema filename to Unix path', () => {
    const result = getSchemaPath('/Users/test/project');
    expect(result).toBe('/Users/test/project/frontmatter.schema.json');
  });

  it('should normalize Windows path separators', () => {
    const result = getSchemaPath('C:\\Users\\test\\project');
    expect(result).toBe('C:/Users/test/project/frontmatter.schema.json');
  });
});

// ============================================================================
// schemaPropertyToZod Tests
// ============================================================================

describe('schemaPropertyToZod', () => {
  describe('string property', () => {
    it('should convert basic string property', () => {
      const property: SchemaProperty = { type: 'string' };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse('hello').success).toBe(true);
      expect(validator.safeParse(123).success).toBe(false);
    });

    it('should handle minLength constraint', () => {
      const property: SchemaProperty = { type: 'string', minLength: 3 };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse('ab').success).toBe(false);
      expect(validator.safeParse('abc').success).toBe(true);
    });

    it('should handle maxLength constraint', () => {
      const property: SchemaProperty = { type: 'string', maxLength: 5 };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse('hello').success).toBe(true);
      expect(validator.safeParse('hello!').success).toBe(false);
    });

    it('should handle enum constraint', () => {
      const property: SchemaProperty = {
        type: 'string',
        enum: ['draft', 'published', 'archived'],
      };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse('draft').success).toBe(true);
      expect(validator.safeParse('published').success).toBe(true);
      expect(validator.safeParse('invalid').success).toBe(false);
    });

    it('should handle pattern constraint', () => {
      const property: SchemaProperty = {
        type: 'string',
        pattern: '^[A-Z][a-z]+$',
      };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse('Hello').success).toBe(true);
      expect(validator.safeParse('hello').success).toBe(false);
      expect(validator.safeParse('HELLO').success).toBe(false);
    });
  });

  describe('format hints', () => {
    it('should handle date format', () => {
      const property: SchemaProperty = { type: 'string', format: 'date' };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse('2024-01-15').success).toBe(true);
      expect(validator.safeParse('2024-1-15').success).toBe(false);
      expect(validator.safeParse('01/15/2024').success).toBe(false);
    });

    it('should handle date-time format', () => {
      const property: SchemaProperty = { type: 'string', format: 'date-time' };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse('2024-01-15T10:30:00Z').success).toBe(true);
      expect(validator.safeParse('2024-01-15T10:30:00+05:00').success).toBe(true);
      expect(validator.safeParse('2024-01-15').success).toBe(false);
    });

    it('should handle email format', () => {
      const property: SchemaProperty = { type: 'string', format: 'email' };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse('test@example.com').success).toBe(true);
      expect(validator.safeParse('invalid-email').success).toBe(false);
    });

    it('should handle uri format', () => {
      const property: SchemaProperty = { type: 'string', format: 'uri' };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse('https://example.com').success).toBe(true);
      expect(validator.safeParse('not-a-url').success).toBe(false);
    });

    it('should handle uuid format', () => {
      const property: SchemaProperty = { type: 'string', format: 'uuid' };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
      expect(validator.safeParse('not-a-uuid').success).toBe(false);
    });
  });

  describe('number property', () => {
    it('should convert basic number property', () => {
      const property: SchemaProperty = { type: 'number' };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse(42).success).toBe(true);
      expect(validator.safeParse(3.14).success).toBe(true);
      expect(validator.safeParse('42').success).toBe(false);
    });

    it('should handle minimum constraint', () => {
      const property: SchemaProperty = { type: 'number', minimum: 0 };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse(0).success).toBe(true);
      expect(validator.safeParse(10).success).toBe(true);
      expect(validator.safeParse(-1).success).toBe(false);
    });

    it('should handle maximum constraint', () => {
      const property: SchemaProperty = { type: 'number', maximum: 100 };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse(100).success).toBe(true);
      expect(validator.safeParse(50).success).toBe(true);
      expect(validator.safeParse(101).success).toBe(false);
    });

    it('should handle min and max together', () => {
      const property: SchemaProperty = {
        type: 'number',
        minimum: 1,
        maximum: 5,
      };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse(0).success).toBe(false);
      expect(validator.safeParse(1).success).toBe(true);
      expect(validator.safeParse(5).success).toBe(true);
      expect(validator.safeParse(6).success).toBe(false);
    });

    it('should handle number enum constraint', () => {
      const property: SchemaProperty = {
        type: 'number',
        enum: [1, 2, 3, 5, 8],
      };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse(1).success).toBe(true);
      expect(validator.safeParse(5).success).toBe(true);
      expect(validator.safeParse(4).success).toBe(false);
    });
  });

  describe('boolean property', () => {
    it('should convert boolean property', () => {
      const property: SchemaProperty = { type: 'boolean' };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse(true).success).toBe(true);
      expect(validator.safeParse(false).success).toBe(true);
      expect(validator.safeParse('true').success).toBe(false);
      expect(validator.safeParse(1).success).toBe(false);
    });
  });

  describe('array property', () => {
    it('should convert basic array property', () => {
      const property: SchemaProperty = { type: 'array' };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse([]).success).toBe(true);
      expect(validator.safeParse([1, 2, 3]).success).toBe(true);
      expect(validator.safeParse('not an array').success).toBe(false);
    });

    it('should handle items schema for string arrays', () => {
      const property: SchemaProperty = {
        type: 'array',
        items: { type: 'string' },
      };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse(['a', 'b', 'c']).success).toBe(true);
      expect(validator.safeParse([1, 2, 3]).success).toBe(false);
    });

    it('should handle items schema for number arrays', () => {
      const property: SchemaProperty = {
        type: 'array',
        items: { type: 'number', minimum: 0 },
      };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse([1, 2, 3]).success).toBe(true);
      expect(validator.safeParse([-1, 2, 3]).success).toBe(false);
    });
  });

  describe('object property', () => {
    it('should convert basic object property', () => {
      const property: SchemaProperty = { type: 'object' };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse({}).success).toBe(true);
      expect(validator.safeParse({ foo: 'bar' }).success).toBe(true);
      expect(validator.safeParse('not an object').success).toBe(false);
    });

    it('should handle nested properties', () => {
      const property: SchemaProperty = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse({ name: 'John', age: 30 }).success).toBe(true);
      expect(validator.safeParse({ name: 'John', age: '30' }).success).toBe(false);
    });

    it('should allow extra properties (passthrough)', () => {
      const property: SchemaProperty = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };
      const validator = schemaPropertyToZod(property);

      const result = validator.safeParse({ name: 'John', extra: 'field' });
      expect(result.success).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle invalid pattern gracefully', () => {
      const property: SchemaProperty = {
        type: 'string',
        pattern: '[invalid(regex',
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw, falls back to basic string
      const validator = schemaPropertyToZod(property);
      expect(validator.safeParse('test').success).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should filter non-string values from string enum', () => {
      const property: SchemaProperty = {
        type: 'string',
        enum: ['valid', 123, null, 'also-valid'],
      };
      const validator = schemaPropertyToZod(property);

      expect(validator.safeParse('valid').success).toBe(true);
      expect(validator.safeParse('also-valid').success).toBe(true);
      expect(validator.safeParse('123').success).toBe(false);
    });
  });
});

// ============================================================================
// schemaToZodValidator Tests
// ============================================================================

describe('schemaToZodValidator', () => {
  it('should create validator for entire schema', () => {
    const schema: FrontmatterSchema = {
      properties: {
        title: { type: 'string' },
        count: { type: 'number' },
      },
      required: ['title'],
      source: { type: 'none' },
    };

    const validator = schemaToZodValidator(schema);

    expect(validator.safeParse({ title: 'Test', count: 5 }).success).toBe(true);
    expect(validator.safeParse({ title: 'Test' }).success).toBe(true);
    expect(validator.safeParse({ count: 5 }).success).toBe(false); // Missing required title
  });

  it('should make non-required fields optional', () => {
    const schema: FrontmatterSchema = {
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['title'],
      source: { type: 'none' },
    };

    const validator = schemaToZodValidator(schema);

    expect(validator.safeParse({ title: 'Test' }).success).toBe(true);
    expect(validator.safeParse({ title: 'Test', description: 'Desc' }).success).toBe(true);
  });

  it('should allow extra fields (passthrough)', () => {
    const schema: FrontmatterSchema = {
      properties: {
        title: { type: 'string' },
      },
      required: [],
      source: { type: 'none' },
    };

    const validator = schemaToZodValidator(schema);
    const result = validator.safeParse({ title: 'Test', extra: 'field' });

    expect(result.success).toBe(true);
  });
});

// ============================================================================
// validateFieldValue Tests
// ============================================================================

describe('validateFieldValue', () => {
  it('should return valid result for correct value', () => {
    const property: SchemaProperty = { type: 'string' };
    const result = validateFieldValue('hello', property);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return errors for invalid value', () => {
    const property: SchemaProperty = { type: 'number' };
    const result = validateFieldValue('not a number', property);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should include error code and message', () => {
    const property: SchemaProperty = { type: 'string', minLength: 5 };
    const result = validateFieldValue('hi', property);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toHaveProperty('code');
    expect(result.errors[0]).toHaveProperty('message');
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('getSuggestedFields', () => {
  it('should return fields with suggested: true', () => {
    const schema: FrontmatterSchema = {
      properties: {
        title: { type: 'string', 'x-frontmatter': { suggested: true } },
        draft: { type: 'boolean', 'x-frontmatter': { suggested: true } },
        internal: { type: 'string', 'x-frontmatter': { suggested: false } },
        other: { type: 'string' },
      },
      required: [],
      source: { type: 'none' },
    };

    const result = getSuggestedFields(schema);
    expect(result).toContain('title');
    expect(result).toContain('draft');
    expect(result).not.toContain('internal');
    expect(result).not.toContain('other');
  });

  it('should sort by order', () => {
    const schema: FrontmatterSchema = {
      properties: {
        third: { type: 'string', 'x-frontmatter': { suggested: true, order: 3 } },
        first: { type: 'string', 'x-frontmatter': { suggested: true, order: 1 } },
        second: { type: 'string', 'x-frontmatter': { suggested: true, order: 2 } },
      },
      required: [],
      source: { type: 'none' },
    };

    const result = getSuggestedFields(schema);
    expect(result).toEqual(['first', 'second', 'third']);
  });

  it('should return empty array when no suggested fields', () => {
    const schema: FrontmatterSchema = {
      properties: {
        title: { type: 'string' },
      },
      required: [],
      source: { type: 'none' },
    };

    const result = getSuggestedFields(schema);
    expect(result).toEqual([]);
  });
});

describe('sortFieldsBySchemaOrder', () => {
  it('should sort fields by x-frontmatter.order', () => {
    const schema: FrontmatterSchema = {
      properties: {
        z: { type: 'string', 'x-frontmatter': { order: 1 } },
        a: { type: 'string', 'x-frontmatter': { order: 3 } },
        m: { type: 'string', 'x-frontmatter': { order: 2 } },
      },
      required: [],
      source: { type: 'none' },
    };

    const result = sortFieldsBySchemaOrder(schema, ['a', 'm', 'z']);
    expect(result).toEqual(['z', 'm', 'a']);
  });

  it('should use default order 100 for fields without order', () => {
    const schema: FrontmatterSchema = {
      properties: {
        first: { type: 'string', 'x-frontmatter': { order: 1 } },
        noOrder: { type: 'string' },
        last: { type: 'string', 'x-frontmatter': { order: 200 } },
      },
      required: [],
      source: { type: 'none' },
    };

    const result = sortFieldsBySchemaOrder(schema, ['noOrder', 'last', 'first']);
    expect(result).toEqual(['first', 'noOrder', 'last']);
  });

  it('should handle fields not in schema', () => {
    const schema: FrontmatterSchema = {
      properties: {
        known: { type: 'string', 'x-frontmatter': { order: 1 } },
      },
      required: [],
      source: { type: 'none' },
    };

    const result = sortFieldsBySchemaOrder(schema, ['unknown', 'known']);
    expect(result).toEqual(['known', 'unknown']);
  });
});

describe('getFieldPlaceholder', () => {
  it('should return placeholder from schema', () => {
    const schema: FrontmatterSchema = {
      properties: {
        title: { type: 'string', 'x-frontmatter': { placeholder: 'Enter title here' } },
      },
      required: [],
      source: { type: 'none' },
    };

    expect(getFieldPlaceholder(schema, 'title')).toBe('Enter title here');
  });

  it('should return undefined when no placeholder', () => {
    const schema: FrontmatterSchema = {
      properties: {
        title: { type: 'string' },
      },
      required: [],
      source: { type: 'none' },
    };

    expect(getFieldPlaceholder(schema, 'title')).toBeUndefined();
  });

  it('should return undefined for unknown field', () => {
    const schema: FrontmatterSchema = {
      properties: {},
      required: [],
      source: { type: 'none' },
    };

    expect(getFieldPlaceholder(schema, 'unknown')).toBeUndefined();
  });
});

describe('getFieldDescription', () => {
  it('should return description from schema', () => {
    const schema: FrontmatterSchema = {
      properties: {
        title: { type: 'string', description: 'The document title' },
      },
      required: [],
      source: { type: 'none' },
    };

    expect(getFieldDescription(schema, 'title')).toBe('The document title');
  });

  it('should return undefined when no description', () => {
    const schema: FrontmatterSchema = {
      properties: {
        title: { type: 'string' },
      },
      required: [],
      source: { type: 'none' },
    };

    expect(getFieldDescription(schema, 'title')).toBeUndefined();
  });

  it('should return undefined for unknown field', () => {
    const schema: FrontmatterSchema = {
      properties: {},
      required: [],
      source: { type: 'none' },
    };

    expect(getFieldDescription(schema, 'unknown')).toBeUndefined();
  });
});

describe('isFieldHidden', () => {
  it('should return true when hidden is true', () => {
    const schema: FrontmatterSchema = {
      properties: {
        internal: { type: 'string', 'x-frontmatter': { hidden: true } },
      },
      required: [],
      source: { type: 'none' },
    };

    expect(isFieldHidden(schema, 'internal')).toBe(true);
  });

  it('should return false when hidden is false', () => {
    const schema: FrontmatterSchema = {
      properties: {
        title: { type: 'string', 'x-frontmatter': { hidden: false } },
      },
      required: [],
      source: { type: 'none' },
    };

    expect(isFieldHidden(schema, 'title')).toBe(false);
  });

  it('should return false when hidden is not set', () => {
    const schema: FrontmatterSchema = {
      properties: {
        title: { type: 'string' },
      },
      required: [],
      source: { type: 'none' },
    };

    expect(isFieldHidden(schema, 'title')).toBe(false);
  });

  it('should return false for unknown field', () => {
    const schema: FrontmatterSchema = {
      properties: {},
      required: [],
      source: { type: 'none' },
    };

    expect(isFieldHidden(schema, 'unknown')).toBe(false);
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('constants', () => {
  it('should export SCHEMA_FILENAME', () => {
    expect(SCHEMA_FILENAME).toBe('frontmatter.schema.json');
  });

  it('should export SCHEMA_LOAD_TIMEOUT_MS', () => {
    expect(SCHEMA_LOAD_TIMEOUT_MS).toBe(50);
  });
});
