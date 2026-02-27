/**
 * Template Parser Tests
 *
 * Tests for slugify, parseTemplateFile, parseTemplateMetadataFile,
 * buildTemplateFile, and substituteVariables.
 *
 * @module tests/unit/template/parser
 */

import { describe, it, expect, vi } from 'vitest';

// ============================================================================
// Mock Setup
// ============================================================================

const { mockReadFile, mockStat } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockStat: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: { readFile: mockReadFile, stat: mockStat },
  readFile: mockReadFile,
  stat: mockStat,
}));

import { slugify, buildTemplateFile, substituteVariables } from '../parser';

// ============================================================================
// Tests
// ============================================================================

describe('slugify', () => {
  it('should convert name to lowercase kebab-case', () => {
    expect(slugify('Blog Post')).toBe('blog-post');
  });

  it('should strip leading and trailing hyphens', () => {
    expect(slugify('  --Hello World--  ')).toBe('hello-world');
  });

  it('should replace non-alphanumeric chars with hyphens', () => {
    expect(slugify('My Template (v2.0)!')).toBe('my-template-v2-0');
  });

  it('should handle empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('should collapse consecutive special chars into single hyphen', () => {
    expect(slugify('a   b___c')).toBe('a-b-c');
  });
});

describe('buildTemplateFile', () => {
  it('should create valid frontmatter file content', () => {
    const result = buildTemplateFile({
      name: 'Test Template',
      description: 'A test template',
      category: 'custom',
      tags: ['test', 'example'],
      content: '# Hello World',
    });

    expect(result).toContain('name: Test Template');
    expect(result).toContain('description: A test template');
    expect(result).toContain('category: custom');
    expect(result).toContain('version: 1.0.0');
    expect(result).toContain('# Hello World');
  });

  it('should include variables when present', () => {
    const result = buildTemplateFile({
      name: 'With Vars',
      description: 'Has variables',
      category: 'blog',
      tags: [],
      variables: [{ name: 'title', description: 'Post title', required: true }],
      content: '# {{title}}',
    });

    expect(result).toContain('variables');
    expect(result).toContain('title');
  });

  it('should omit variables key when array is empty', () => {
    const result = buildTemplateFile({
      name: 'No Vars',
      description: 'A simple template',
      category: 'notes',
      tags: [],
      variables: [],
      content: '# Static',
    });

    // The frontmatter should not have a 'variables:' key
    const lines = result.split('\n');
    const hasVariablesKey = lines.some((line) => line.trim().startsWith('variables:'));
    expect(hasVariablesKey).toBe(false);
  });
});

describe('substituteVariables', () => {
  it('should replace {{variable}} with values', () => {
    const result = substituteVariables('Hello {{name}}, welcome to {{place}}!', {
      name: 'Alice',
      place: 'Wonderland',
    });

    expect(result).toBe('Hello Alice, welcome to Wonderland!');
  });

  it('should leave unknown variables untouched', () => {
    const result = substituteVariables('Hello {{name}}, your {{role}} awaits', { name: 'Bob' });

    expect(result).toBe('Hello Bob, your {{role}} awaits');
  });

  it('should handle content with no variables', () => {
    const result = substituteVariables('No variables here', { key: 'value' });

    expect(result).toBe('No variables here');
  });

  it('should handle empty values map', () => {
    const result = substituteVariables('Hello {{name}}', {});

    expect(result).toBe('Hello {{name}}');
  });

  it('should handle multiple occurrences of same variable', () => {
    const result = substituteVariables('{{x}} + {{x}} = 2{{x}}', { x: '5' });

    expect(result).toBe('5 + 5 = 25');
  });
});
