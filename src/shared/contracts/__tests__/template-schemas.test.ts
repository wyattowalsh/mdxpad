/**
 * Tests for template-schemas Zod validation.
 *
 * Tests category enum, template variables, metadata, full template,
 * IPC request schemas, discriminated union, error response, and dialog schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  TemplateCategorySchema,
  TemplateVariableSchema,
  TemplateMetadataSchema,
  TemplateSchema,
  TemplateSourceSchema,
  TemplateListRequestSchema,
  TemplateGetRequestSchema,
  TemplateSaveRequestSchema,
  TemplateDeleteRequestSchema,
  TemplateImportRequestSchema,
  TemplateExportRequestSchema,
  TemplateValidateRequestSchema,
  TemplateRequestSchema,
  TemplateErrorResponseSchema,
  VariableValuesSchema,
  CreateFromTemplateRequestSchema,
  TemplateOpenDialogRequestSchema,
  TemplateOpenDialogResponseSchema,
  TemplateSaveDialogRequestSchema,
  TemplateSaveDialogResponseSchema,
  TEMPLATE_IPC_CHANNEL,
  TEMPLATE_CREATE_CHANNEL,
} from '../template-schemas';

// =============================================================================
// ENUMS
// =============================================================================

describe('TemplateCategorySchema', () => {
  const validCategories = ['blog', 'documentation', 'presentation', 'notes', 'tutorial', 'custom'];

  for (const cat of validCategories) {
    it(`should accept "${cat}"`, () => {
      expect(TemplateCategorySchema.safeParse(cat).success).toBe(true);
    });
  }

  it('should reject invalid category', () => {
    expect(TemplateCategorySchema.safeParse('invalid').success).toBe(false);
  });
});

describe('TemplateSourceSchema', () => {
  it('should accept all, builtin, custom', () => {
    expect(TemplateSourceSchema.safeParse('all').success).toBe(true);
    expect(TemplateSourceSchema.safeParse('builtin').success).toBe(true);
    expect(TemplateSourceSchema.safeParse('custom').success).toBe(true);
  });
});

// =============================================================================
// CORE ENTITIES
// =============================================================================

describe('TemplateVariableSchema', () => {
  it('should accept valid variable', () => {
    const result = TemplateVariableSchema.safeParse({
      name: 'title',
      description: 'Document title',
      default: 'Untitled',
      required: true,
    });
    expect(result.success).toBe(true);
  });

  it('should accept variable with underscore prefix', () => {
    const result = TemplateVariableSchema.safeParse({ name: '_private' });
    expect(result.success).toBe(true);
  });

  it('should reject variable starting with number', () => {
    const result = TemplateVariableSchema.safeParse({ name: '123invalid' });
    expect(result.success).toBe(false);
  });

  it('should reject variable with special characters', () => {
    const result = TemplateVariableSchema.safeParse({ name: 'my-var' });
    expect(result.success).toBe(false);
  });

  it('should default required to false', () => {
    const result = TemplateVariableSchema.safeParse({ name: 'myVar' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.required).toBe(false);
    }
  });
});

describe('TemplateMetadataSchema', () => {
  const validMetadata = {
    id: 'test-template',
    name: 'Test Template',
    description: 'A test template',
    category: 'blog' as const,
    tags: ['test'],
    author: 'Tester',
    isBuiltIn: false,
  };

  it('should accept valid metadata', () => {
    expect(TemplateMetadataSchema.safeParse(validMetadata).success).toBe(true);
  });

  it('should reject empty name', () => {
    expect(TemplateMetadataSchema.safeParse({ ...validMetadata, name: '' }).success).toBe(false);
  });

  it('should reject name over 100 chars', () => {
    expect(
      TemplateMetadataSchema.safeParse({ ...validMetadata, name: 'a'.repeat(101) }).success
    ).toBe(false);
  });

  it('should reject more than 10 tags', () => {
    const tags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
    expect(TemplateMetadataSchema.safeParse({ ...validMetadata, tags }).success).toBe(false);
  });

  it('should default tags to empty array', () => {
    const { tags, ...rest } = validMetadata;
    const result = TemplateMetadataSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual([]);
    }
  });
});

describe('TemplateSchema', () => {
  const validTemplate = {
    id: 'test',
    name: 'Test',
    description: 'Test description',
    category: 'blog',
    tags: [],
    isBuiltIn: false,
    version: '1.0.0',
    variables: [],
    content: '# Hello {{title}}',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    filePath: '/templates/test.mdxt',
  };

  it('should accept valid template', () => {
    expect(TemplateSchema.safeParse(validTemplate).success).toBe(true);
  });

  it('should reject invalid version format', () => {
    expect(TemplateSchema.safeParse({ ...validTemplate, version: 'v1.0' }).success).toBe(false);
  });

  it('should reject empty content', () => {
    expect(TemplateSchema.safeParse({ ...validTemplate, content: '' }).success).toBe(false);
  });

  it('should default version to 1.0.0', () => {
    const { version, ...rest } = validTemplate;
    const result = TemplateSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe('1.0.0');
    }
  });
});

// =============================================================================
// IPC REQUEST SCHEMAS
// =============================================================================

describe('TemplateListRequestSchema', () => {
  it('should accept list request with default source', () => {
    const result = TemplateListRequestSchema.safeParse({ action: 'list' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe('all');
    }
  });

  it('should accept list request with explicit source', () => {
    const result = TemplateListRequestSchema.safeParse({ action: 'list', source: 'builtin' });
    expect(result.success).toBe(true);
  });
});

describe('TemplateGetRequestSchema', () => {
  it('should accept get request with ID', () => {
    expect(TemplateGetRequestSchema.safeParse({ action: 'get', id: 'test-id' }).success).toBe(true);
  });

  it('should reject empty ID', () => {
    expect(TemplateGetRequestSchema.safeParse({ action: 'get', id: '' }).success).toBe(false);
  });
});

describe('TemplateSaveRequestSchema', () => {
  it('should accept valid save request', () => {
    const result = TemplateSaveRequestSchema.safeParse({
      action: 'save',
      template: {
        name: 'Test',
        description: 'A test',
        category: 'blog',
        content: '# Hello',
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('TemplateDeleteRequestSchema', () => {
  it('should accept delete request', () => {
    expect(TemplateDeleteRequestSchema.safeParse({ action: 'delete', id: 'test' }).success).toBe(
      true
    );
  });
});

describe('TemplateImportRequestSchema', () => {
  it('should accept import request', () => {
    const result = TemplateImportRequestSchema.safeParse({
      action: 'import',
      path: '/templates/test.mdxt',
    });
    expect(result.success).toBe(true);
  });

  it('should default replace to false', () => {
    const result = TemplateImportRequestSchema.safeParse({
      action: 'import',
      path: '/test.mdxt',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.replace).toBe(false);
    }
  });
});

describe('TemplateExportRequestSchema', () => {
  it('should accept export request', () => {
    const result = TemplateExportRequestSchema.safeParse({
      action: 'export',
      id: 'test',
      path: '/export/test.mdxt',
    });
    expect(result.success).toBe(true);
  });
});

describe('TemplateValidateRequestSchema', () => {
  it('should accept validate request', () => {
    const result = TemplateValidateRequestSchema.safeParse({
      action: 'validate',
      content: '# Template',
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// DISCRIMINATED UNION
// =============================================================================

describe('TemplateRequestSchema', () => {
  it('should route to correct schema based on action', () => {
    expect(TemplateRequestSchema.safeParse({ action: 'list' }).success).toBe(true);
    expect(TemplateRequestSchema.safeParse({ action: 'get', id: 'test' }).success).toBe(true);
    expect(TemplateRequestSchema.safeParse({ action: 'delete', id: 'test' }).success).toBe(true);
  });

  it('should reject unknown action', () => {
    expect(TemplateRequestSchema.safeParse({ action: 'unknown' }).success).toBe(false);
  });
});

// =============================================================================
// ERROR RESPONSE
// =============================================================================

describe('TemplateErrorResponseSchema', () => {
  const validCodes = [
    'NOT_FOUND',
    'ALREADY_EXISTS',
    'VALIDATION_ERROR',
    'PERMISSION_DENIED',
    'FILE_ERROR',
    'PARSE_ERROR',
  ];

  for (const code of validCodes) {
    it(`should accept error code "${code}"`, () => {
      const result = TemplateErrorResponseSchema.safeParse({
        success: false,
        error: 'Something went wrong',
        code,
      });
      expect(result.success).toBe(true);
    });
  }

  it('should reject invalid error code', () => {
    const result = TemplateErrorResponseSchema.safeParse({
      success: false,
      error: 'Error',
      code: 'INVALID',
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// VARIABLE SUBSTITUTION
// =============================================================================

describe('VariableValuesSchema', () => {
  it('should accept string record', () => {
    const result = VariableValuesSchema.safeParse({ title: 'Hello', author: 'Test' });
    expect(result.success).toBe(true);
  });

  it('should accept empty object', () => {
    expect(VariableValuesSchema.safeParse({}).success).toBe(true);
  });
});

describe('CreateFromTemplateRequestSchema', () => {
  it('should accept valid request', () => {
    const result = CreateFromTemplateRequestSchema.safeParse({
      templateId: 'test-template',
      variables: { title: 'My Doc' },
    });
    expect(result.success).toBe(true);
  });

  it('should accept request with savePath', () => {
    const result = CreateFromTemplateRequestSchema.safeParse({
      templateId: 'test',
      variables: {},
      savePath: '/docs/new.mdx',
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// DIALOG SCHEMAS
// =============================================================================

describe('TemplateOpenDialogResponseSchema', () => {
  it('should accept selected file', () => {
    const result = TemplateOpenDialogResponseSchema.safeParse({
      success: true,
      path: '/test.mdxt',
      canceled: false,
    });
    expect(result.success).toBe(true);
  });

  it('should accept canceled dialog', () => {
    const result = TemplateOpenDialogResponseSchema.safeParse({
      success: true,
      path: null,
      canceled: true,
    });
    expect(result.success).toBe(true);
  });
});

describe('TemplateSaveDialogResponseSchema', () => {
  it('should accept save dialog response', () => {
    const result = TemplateSaveDialogResponseSchema.safeParse({
      success: true,
      path: '/export/template.mdxt',
      canceled: false,
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// CONSTANTS
// =============================================================================

describe('IPC Channel Constants', () => {
  it('should have correct template channel', () => {
    expect(TEMPLATE_IPC_CHANNEL).toBe('mdxpad:template');
  });

  it('should have correct create channel', () => {
    expect(TEMPLATE_CREATE_CHANNEL).toBe('mdxpad:template:create');
  });
});
