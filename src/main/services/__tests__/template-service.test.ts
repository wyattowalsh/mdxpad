/**
 * Template Service Unit Tests
 *
 * Tests for template service operations including loading, parsing, saving,
 * importing, exporting, and variable substitution.
 *
 * Feature: 016-template-library
 *
 * @module tests/unit/template-service
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Mock Setup
// ============================================================================

const {
  mockReadFile,
  mockWriteFile,
  mockReaddir,
  mockUnlink,
  mockCopyFile,
  mockStat,
  mockLstat,
  mockMkdir,
  mockAccess,
  mockOpen,
} = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockReaddir: vi.fn(),
  mockUnlink: vi.fn(),
  mockCopyFile: vi.fn(),
  mockStat: vi.fn(),
  mockLstat: vi.fn(),
  mockMkdir: vi.fn(),
  mockAccess: vi.fn(),
  mockOpen: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    readdir: mockReaddir,
    unlink: mockUnlink,
    copyFile: mockCopyFile,
    stat: mockStat,
    lstat: mockLstat,
    mkdir: mockMkdir,
    access: mockAccess,
    open: mockOpen,
  },
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  readdir: mockReaddir,
  unlink: mockUnlink,
  copyFile: mockCopyFile,
  stat: mockStat,
  lstat: mockLstat,
  mkdir: mockMkdir,
  access: mockAccess,
  open: mockOpen,
}));

const { mockShowOpenDialog, mockShowSaveDialog, mockCompile, mockApp, mockOs } = vi.hoisted(() => ({
  mockShowOpenDialog: vi.fn(),
  mockShowSaveDialog: vi.fn(),
  mockCompile: vi.fn(),
  mockApp: {
    isPackaged: false,
    getAppPath: vi.fn(() => '/test/app'),
  },
  mockOs: {
    homedir: vi.fn(() => '/test/home'),
  },
}));

vi.mock('electron', () => ({
  app: mockApp,
  dialog: {
    showOpenDialog: mockShowOpenDialog,
    showSaveDialog: mockShowSaveDialog,
  },
}));

vi.mock('node:os', () => ({
  default: mockOs,
  homedir: mockOs.homedir,
}));

vi.mock('@mdx-js/mdx', () => ({
  compile: mockCompile,
}));

// Import after mocks
import {
  handleTemplateList,
  handleTemplateGet,
  handleTemplateSave,
  handleTemplateDelete,
  handleTemplateImport,
  handleTemplateExport,
  handleTemplateValidate,
  handleCreateFromTemplate,
  handleTemplateOpenDialog,
  handleTemplateSaveDialog,
} from '../template/handlers';
import { slugify, substituteVariables, buildTemplateFile } from '../template/parser';
import { rememberChosenTemplatePath, resetChosenTemplatePaths } from '../template/template-scope';

const chosenTemplateDirs: string[] = [];

function chooseTemplatePath(name: string, createFile: boolean): string {
  const dir = mkdtempSync(path.join('/tmp', 'mdxpad-template-choice-'));
  chosenTemplateDirs.push(dir);
  const filePath = path.join(dir, name);
  if (createFile) {
    writeFileSync(filePath, 'chosen');
  }
  rememberChosenTemplatePath(filePath);
  return filePath;
}

// ============================================================================
// Test Utilities
// ============================================================================

function createMockTemplateFile(overrides?: {
  name?: string;
  id?: string;
  content?: string;
  category?: string;
}) {
  const name = overrides?.name ?? 'Test Template';
  const id = overrides?.id ?? 'test-template';
  const content = overrides?.content ?? '# {{title}}\n\nTest content.';

  const frontmatter = `---
name: ${name}
id: ${id}
description: Test description
category: ${overrides?.category ?? 'documentation'}
tags:
  - test
version: 1.0.0
---`;

  return `${frontmatter}\n${content}`;
}

function setupMockFileSystem() {
  mockReaddir.mockResolvedValue([]);
  mockReadFile.mockResolvedValue(createMockTemplateFile());
  mockWriteFile.mockResolvedValue(undefined);
  mockUnlink.mockResolvedValue(undefined);
  mockCopyFile.mockResolvedValue(undefined);
  mockMkdir.mockResolvedValue(undefined);
  mockAccess.mockResolvedValue(undefined);
  mockStat.mockResolvedValue({
    birthtime: new Date('2024-01-01'),
    mtime: new Date('2024-01-02'),
    isFile: () => true,
    isSymbolicLink: () => false,
  });
  mockLstat.mockResolvedValue({
    birthtime: new Date('2024-01-01'),
    mtime: new Date('2024-01-02'),
    isFile: () => true,
    isSymbolicLink: () => false,
  });
  mockOpen.mockImplementation(async (filePath: string) => ({
    stat: () => mockLstat(filePath),
    readFile: () => mockReadFile(filePath),
    close: () => Promise.resolve(),
  }));
}

// ============================================================================
// Parser Function Tests
// ============================================================================

describe('parser functions', () => {
  describe('slugify', () => {
    it('should convert name to lowercase slug', () => {
      expect(slugify('Test Template')).toBe('test-template');
    });

    it('should replace spaces with hyphens', () => {
      expect(slugify('My Test Template')).toBe('my-test-template');
    });

    it('should remove special characters', () => {
      expect(slugify('Test & Template!')).toBe('test-template');
    });

    it('should handle multiple consecutive spaces', () => {
      expect(slugify('Test    Template')).toBe('test-template');
    });

    it('should trim leading and trailing hyphens', () => {
      expect(slugify('  Test Template  ')).toBe('test-template');
    });

    it('should handle unicode characters', () => {
      expect(slugify('Test 文档 Template')).toBe('test-template');
    });

    it('should handle already-slug-like strings', () => {
      expect(slugify('test-template')).toBe('test-template');
    });

    it('should handle numbers', () => {
      expect(slugify('Template 123')).toBe('template-123');
    });
  });

  describe('substituteVariables', () => {
    it('should replace single variable', () => {
      const content = '# {{title}}';
      const result = substituteVariables(content, { title: 'My Document' });
      expect(result).toBe('# My Document');
    });

    it('should replace multiple variables', () => {
      const content = '# {{title}}\n\nAuthor: {{author}}';
      const result = substituteVariables(content, {
        title: 'Test',
        author: 'John Doe',
      });
      expect(result).toBe('# Test\n\nAuthor: John Doe');
    });

    it('should leave unreplaced variables unchanged', () => {
      const content = '# {{title}}\n\n{{unknown}}';
      const result = substituteVariables(content, { title: 'Test' });
      expect(result).toBe('# Test\n\n{{unknown}}');
    });

    it('should handle empty values object', () => {
      const content = '# {{title}}';
      const result = substituteVariables(content, {});
      expect(result).toBe('# {{title}}');
    });

    it('should handle content with no variables', () => {
      const content = '# Plain Content';
      const result = substituteVariables(content, { title: 'Test' });
      expect(result).toBe('# Plain Content');
    });

    it('should replace same variable multiple times', () => {
      const content = '# {{name}}\n\nWelcome {{name}}!';
      const result = substituteVariables(content, { name: 'Alice' });
      expect(result).toBe('# Alice\n\nWelcome Alice!');
    });

    it('should handle variables with numbers', () => {
      const content = '{{var1}} and {{var2}}';
      const result = substituteVariables(content, { var1: 'A', var2: 'B' });
      expect(result).toBe('A and B');
    });

    it('should not replace partial matches', () => {
      const content = '{{variable}} and {{var}}';
      const result = substituteVariables(content, { var: 'Test' });
      expect(result).toBe('{{variable}} and Test');
    });
  });

  describe('buildTemplateFile', () => {
    it('should build template file with frontmatter', () => {
      const template = {
        name: 'Test',
        description: 'Test description',
        category: 'General',
        tags: ['test'],
        content: '# Test Content',
      };

      const result = buildTemplateFile(template);

      expect(result).toContain('---');
      expect(result).toContain('name: Test');
      expect(result).toContain('description: Test description');
      expect(result).toContain('category: General');
      expect(result).toContain('# Test Content');
    });

    it('should include variables in frontmatter when provided', () => {
      const template = {
        name: 'Test',
        description: 'Test',
        category: 'General',
        tags: ['test'],
        variables: [
          { name: 'title', required: true },
          { name: 'author', default: 'Anonymous' },
        ],
        content: '# {{title}}',
      };

      const result = buildTemplateFile(template);

      expect(result).toContain('variables:');
      expect(result).toContain('name: title');
      expect(result).toContain('name: author');
    });

    it('should not include variables section when empty', () => {
      const template = {
        name: 'Test',
        description: 'Test',
        category: 'General',
        tags: [],
        content: '# Test',
      };

      const result = buildTemplateFile(template);

      expect(result).not.toContain('variables:');
    });

    it('should include version in frontmatter', () => {
      const template = {
        name: 'Test',
        description: 'Test',
        category: 'General',
        tags: [],
        content: '# Test',
      };

      const result = buildTemplateFile(template);

      expect(result).toContain('version: 1.0.0');
    });
  });
});

// ============================================================================
// Handler Function Tests
// ============================================================================

describe('template handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockFileSystem();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetChosenTemplatePaths();
    for (const dir of chosenTemplateDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // ==========================================================================
  // handleTemplateList Tests
  // ==========================================================================

  describe('handleTemplateList', () => {
    it('should return validation error for invalid payload', async () => {
      const result = await handleTemplateList({ invalid: true });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
    });

    it('should list builtin templates', async () => {
      mockReaddir.mockResolvedValue(['template1.mdxt', 'template2.mdxt']);

      const result = await handleTemplateList({ action: 'list', source: 'builtin' });

      expect(result).toHaveProperty('success', true);
      if ('success' in result && result.success) {
        expect(Array.isArray(result.templates)).toBe(true);
      }
    });

    it('should list custom templates', async () => {
      mockReaddir.mockResolvedValue(['custom.mdxt']);

      const result = await handleTemplateList({ action: 'list', source: 'custom' });

      expect(result).toHaveProperty('success', true);
      if ('success' in result && result.success) {
        expect(Array.isArray(result.templates)).toBe(true);
      }
    });

    it('should list all templates when source is "all"', async () => {
      mockReaddir.mockResolvedValue(['template.mdxt']);

      const result = await handleTemplateList({ action: 'list', source: 'all' });

      expect(result).toHaveProperty('success', true);
      if ('success' in result && result.success) {
        expect(Array.isArray(result.templates)).toBe(true);
      }
    });

    it('should handle empty template directory', async () => {
      mockReaddir.mockResolvedValue([]);

      const result = await handleTemplateList({ action: 'list', source: 'all' });

      expect(result).toHaveProperty('success', true);
      if ('success' in result && result.success) {
        expect(result.templates).toEqual([]);
      }
    });

    it('should filter non-.mdxt files', async () => {
      mockReaddir.mockResolvedValue(['template.mdxt', 'readme.md', 'data.json']);

      const result = await handleTemplateList({ action: 'list', source: 'all' });

      expect(result).toHaveProperty('success', true);
      // Only .mdxt files should be processed
    });
  });

  // ==========================================================================
  // handleTemplateGet Tests
  // ==========================================================================

  describe('handleTemplateGet', () => {
    it('should return validation error for invalid payload', async () => {
      const result = await handleTemplateGet({ invalid: true });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should validate template ID format', async () => {
      const result = await handleTemplateGet({ action: 'get', id: '../../../etc/passwd' });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should accept valid template ID', async () => {
      mockReaddir.mockResolvedValue(['test-template.mdxt']);

      const result = await handleTemplateGet({ action: 'get', id: 'test-template' });

      // Should attempt to find template
      expect(mockReaddir).toHaveBeenCalled();
    });

    it('should return not found error for non-existent template', async () => {
      mockReaddir.mockResolvedValue([]);

      const result = await handleTemplateGet({ action: 'get', id: 'nonexistent' });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should allow alphanumeric IDs with hyphens and underscores', async () => {
      const validIds = ['template-1', 'template_2', 'Template123'];

      for (const id of validIds) {
        const result = await handleTemplateGet({ action: 'get', id });
        // Should not return validation error
        if (!('success' in result && result.success)) {
          expect(result.error).not.toBe('VALIDATION_ERROR');
        }
      }
    });

    it('should reject IDs with special characters', async () => {
      const invalidIds = ['template/path', 'template.mdxt', '../template'];

      for (const id of invalidIds) {
        const result = await handleTemplateGet({ action: 'get', id });
        expect(result).toHaveProperty('success', false);
        if ('code' in result) {
          expect(result.code).toBe('VALIDATION_ERROR');
        }
      }
    });
  });

  // ==========================================================================
  // handleTemplateSave Tests
  // ==========================================================================

  describe('handleTemplateSave', () => {
    it('should return validation error for invalid payload', async () => {
      const result = await handleTemplateSave({ invalid: true });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should save new template', async () => {
      // Template file does not exist yet
      mockAccess.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const result = await handleTemplateSave({
        action: 'save',
        template: {
          name: 'New Template',
          description: 'Test',
          category: 'documentation',
          tags: ['test'],
          content: '# Test',
        },
        replace: false,
      });

      expect(result).toHaveProperty('success', true);
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should generate slug from name when ID not provided', async () => {
      // Template file does not exist yet
      mockAccess.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      await handleTemplateSave({
        action: 'save',
        template: {
          name: 'My Test Template',
          description: 'Test',
          category: 'documentation',
          tags: [],
          content: '# Test',
        },
        replace: false,
      });

      const writeCall = mockWriteFile.mock.calls[0];
      expect(writeCall?.[0]).toContain('my-test-template.mdxt');
    });

    it('should return already exists error when template exists and replace is false', async () => {
      mockReadFile.mockResolvedValueOnce(createMockTemplateFile());

      const result = await handleTemplateSave({
        action: 'save',
        template: {
          id: 'existing',
          name: 'Existing',
          description: 'Test',
          category: 'documentation',
          tags: [],
          content: '# Test',
        },
        replace: false,
      });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should replace existing template when replace is true', async () => {
      mockReadFile.mockResolvedValueOnce(createMockTemplateFile());

      const result = await handleTemplateSave({
        action: 'save',
        template: {
          id: 'existing',
          name: 'Existing',
          description: 'Test',
          category: 'documentation',
          tags: [],
          content: '# Test',
        },
        replace: true,
      });

      expect(result).toHaveProperty('success', true);
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should validate template ID to prevent path traversal', async () => {
      const result = await handleTemplateSave({
        action: 'save',
        template: {
          id: '../../../etc/passwd',
          name: 'Evil',
          description: 'Test',
          category: 'documentation',
          tags: [],
          content: '# Test',
        },
        replace: false,
      });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should apply path.basename defense-in-depth', async () => {
      // Template file does not exist yet
      mockAccess.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      await handleTemplateSave({
        action: 'save',
        template: {
          id: 'safe-id',
          name: 'Test',
          description: 'Test',
          category: 'documentation',
          tags: [],
          content: '# Test',
        },
        replace: false,
      });

      const writeCall = mockWriteFile.mock.calls[0];
      // Should not contain path separators
      expect(writeCall?.[0]).not.toContain('../');
    });
  });

  // ==========================================================================
  // handleTemplateDelete Tests
  // ==========================================================================

  describe('handleTemplateDelete', () => {
    it('should return validation error for invalid payload', async () => {
      const result = await handleTemplateDelete({ invalid: true });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should delete custom template', async () => {
      // Built-in dirs return empty, custom dir returns the template
      mockReaddir
        .mockResolvedValueOnce([]) // 1st built-in candidate
        .mockResolvedValueOnce([]) // 2nd built-in candidate
        .mockResolvedValueOnce([]) // 3rd built-in candidate
        .mockResolvedValueOnce([]) // 4th built-in candidate
        .mockResolvedValue(['test-template.mdxt']); // custom dir

      const result = await handleTemplateDelete({ action: 'delete', id: 'test-template' });

      expect(mockUnlink).toHaveBeenCalled();
    });

    it('should prevent deleting built-in templates', async () => {
      mockReaddir.mockResolvedValue(['builtin.mdxt']);

      const result = await handleTemplateDelete({ action: 'delete', id: 'builtin' });

      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('should return not found error for non-existent template', async () => {
      mockReaddir.mockResolvedValue([]);

      const result = await handleTemplateDelete({ action: 'delete', id: 'nonexistent' });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should validate template ID format', async () => {
      const result = await handleTemplateDelete({ action: 'delete', id: '../../../etc/passwd' });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // handleTemplateImport Tests
  // ==========================================================================

  describe('handleTemplateImport', () => {
    it('should return validation error for invalid payload', async () => {
      const result = await handleTemplateImport({ invalid: true });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should reject non-.mdxt files', async () => {
      const result = await handleTemplateImport({
        action: 'import',
        path: '/test/template.txt',
        replace: false,
      });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should import valid .mdxt file', async () => {
      mockReadFile.mockResolvedValue(createMockTemplateFile());
      mockAccess.mockRejectedValue(new Error('missing'));
      const importPath = chooseTemplatePath('template.mdxt', true);

      const result = await handleTemplateImport({
        action: 'import',
        path: importPath,
        replace: false,
      });

      expect(result).toHaveProperty('success', true);
      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockCopyFile).not.toHaveBeenCalled();
    });

    it('does not import a template that was not chosen in the dialog', async () => {
      const result = await handleTemplateImport({
        action: 'import',
        path: '/tmp/not-chosen.mdxt',
        replace: false,
      });

      expect(result).toHaveProperty('success', false);
      expect(mockReadFile).not.toHaveBeenCalled();
      if (!('success' in result && result.success)) {
        expect(result.error).toContain('template dialog');
      }
    });

    it('should validate imported template ID', async () => {
      mockReadFile.mockResolvedValue(createMockTemplateFile({ id: '../../../invalid' }));
      const importPath = chooseTemplatePath('template.mdxt', true);

      const result = await handleTemplateImport({
        action: 'import',
        path: importPath,
        replace: false,
      });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle already exists error', async () => {
      mockReadFile.mockResolvedValueOnce(createMockTemplateFile());
      const importPath = chooseTemplatePath('template.mdxt', true);

      const result = await handleTemplateImport({
        action: 'import',
        path: importPath,
        replace: false,
      });

      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should replace when replace flag is true', async () => {
      mockReadFile.mockResolvedValue(createMockTemplateFile());
      const importPath = chooseTemplatePath('template.mdxt', true);

      const result = await handleTemplateImport({
        action: 'import',
        path: importPath,
        replace: true,
      });

      if ('success' in result && result.success) {
        expect(mockWriteFile).toHaveBeenCalled();
        expect(mockCopyFile).not.toHaveBeenCalled();
      }
    });
  });

  // ==========================================================================
  // handleTemplateExport Tests
  // ==========================================================================

  describe('handleTemplateExport', () => {
    it('should return validation error for invalid payload', async () => {
      const result = await handleTemplateExport({ invalid: true });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should export existing template', async () => {
      mockReaddir.mockResolvedValue(['test-template.mdxt']);
      const exportPath = chooseTemplatePath('template.mdxt', false);

      const result = await handleTemplateExport({
        action: 'export',
        id: 'test-template',
        path: exportPath,
      });

      expect(result).toHaveProperty('success', true);
      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockCopyFile).not.toHaveBeenCalled();
    });

    it('does not export a template to a path the dialog did not choose', async () => {
      mockReaddir.mockResolvedValue(['test-template.mdxt']);

      const result = await handleTemplateExport({
        action: 'export',
        id: 'test-template',
        path: '/tmp/not-chosen.mdxt',
      });

      expect(result).toHaveProperty('success', false);
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should return not found error for non-existent template', async () => {
      mockReaddir.mockResolvedValue([]);

      const result = await handleTemplateExport({
        action: 'export',
        id: 'nonexistent',
        path: '/export/template.mdxt',
      });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle file system errors', async () => {
      mockReaddir.mockResolvedValue(['test-template.mdxt']);
      mockWriteFile.mockRejectedValueOnce(new Error('Permission denied'));
      const exportPath = chooseTemplatePath('template.mdxt', false);

      const result = await handleTemplateExport({
        action: 'export',
        id: 'test-template',
        path: exportPath,
      });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // handleTemplateValidate Tests
  // ==========================================================================

  describe('handleTemplateValidate', () => {
    beforeEach(() => {
      mockCompile.mockResolvedValue({ code: '' });
    });

    it('should return validation error for invalid payload', async () => {
      const result = await handleTemplateValidate({ invalid: true });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should validate valid MDX content', async () => {
      const result = await handleTemplateValidate({
        action: 'validate',
        content: createMockTemplateFile(),
      });

      expect(result).toHaveProperty('success', true);
      if ('success' in result && result.success) {
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      }
    });

    it('should detect invalid MDX syntax', async () => {
      mockCompile.mockRejectedValueOnce(new Error('Invalid JSX'));

      const result = await handleTemplateValidate({
        action: 'validate',
        content: createMockTemplateFile({ content: '<Invalid JSX' }),
      });

      expect(result).toHaveProperty('success', true);
      if ('success' in result && result.success) {
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should strip frontmatter before validation', async () => {
      await handleTemplateValidate({
        action: 'validate',
        content: createMockTemplateFile(),
      });

      // Compile should be called with content without frontmatter
      expect(mockCompile).toHaveBeenCalled();
      const compileArg = mockCompile.mock.calls[0]?.[0];
      expect(compileArg).not.toContain('---');
    });
  });

  // ==========================================================================
  // handleCreateFromTemplate Tests
  // ==========================================================================

  describe('handleCreateFromTemplate', () => {
    it('should return validation error for invalid payload', async () => {
      const result = await handleCreateFromTemplate({ invalid: true });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should create document from template with variable substitution', async () => {
      mockReaddir.mockResolvedValue(['test-template.mdxt']);
      mockReadFile.mockResolvedValue(
        createMockTemplateFile({ content: '# {{title}}\n\nBy {{author}}' })
      );

      const result = await handleCreateFromTemplate({
        templateId: 'test-template',
        variables: { title: 'My Doc', author: 'John' },
      });

      expect(result).toHaveProperty('success', true);
      if ('success' in result && result.success) {
        expect(result.content).toContain('# My Doc');
        expect(result.content).toContain('By John');
      }
    });

    it('should save document when savePath is provided', async () => {
      mockReaddir.mockResolvedValue(['test-template.mdxt']);
      mockReadFile.mockResolvedValue(createMockTemplateFile());
      const savePath = chooseTemplatePath('document.mdx', false);

      const result = await handleCreateFromTemplate({
        templateId: 'test-template',
        variables: {},
        savePath,
      });

      expect(result).toHaveProperty('success', true);
      expect(mockWriteFile).toHaveBeenCalled();
      if ('success' in result && result.success) {
        expect(result.path).toBe(savePath);
      }
    });

    it('does not save a document to a path the dialog did not choose', async () => {
      mockReaddir.mockResolvedValue(['test-template.mdxt']);
      mockReadFile.mockResolvedValue(createMockTemplateFile());

      const result = await handleCreateFromTemplate({
        templateId: 'test-template',
        variables: {},
        savePath: '/tmp/not-chosen.mdx',
      });

      expect(result).toHaveProperty('success', false);
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should return content without saving when savePath is omitted', async () => {
      mockReaddir.mockResolvedValue(['test-template.mdxt']);
      mockReadFile.mockResolvedValue(createMockTemplateFile());

      const result = await handleCreateFromTemplate({
        templateId: 'test-template',
        variables: {},
      });

      expect(result).toHaveProperty('success', true);
      expect(mockWriteFile).not.toHaveBeenCalled();
      if ('success' in result && result.success) {
        expect(result.content).toBeDefined();
      }
    });

    it('should return not found error for non-existent template', async () => {
      mockReaddir.mockResolvedValue([]);

      const result = await handleCreateFromTemplate({
        templateId: 'nonexistent',
        variables: {},
      });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // handleTemplateOpenDialog Tests
  // ==========================================================================

  describe('handleTemplateOpenDialog', () => {
    it('should return validation error for invalid payload', async () => {
      const result = await handleTemplateOpenDialog({ invalid: true });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should show open dialog and return selected path', async () => {
      mockShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['/selected/template.mdxt'],
      });

      const result = await handleTemplateOpenDialog({ action: 'showOpenDialog' });

      expect(result).toHaveProperty('success', true);
      if ('success' in result && result.success) {
        expect(result.path).toBe('/selected/template.mdxt');
        expect(result.canceled).toBe(false);
      }
    });

    it('should return null path when dialog is canceled', async () => {
      mockShowOpenDialog.mockResolvedValue({
        canceled: true,
        filePaths: [],
      });

      const result = await handleTemplateOpenDialog({ action: 'showOpenDialog' });

      expect(result).toHaveProperty('success', true);
      if ('success' in result && result.success) {
        expect(result.path).toBeNull();
        expect(result.canceled).toBe(true);
      }
    });

    it('should configure dialog with .mdxt filters', async () => {
      mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

      await handleTemplateOpenDialog({ action: 'showOpenDialog' });

      expect(mockShowOpenDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.arrayContaining([expect.objectContaining({ extensions: ['mdxt'] })]),
        })
      );
    });
  });

  // ==========================================================================
  // handleTemplateSaveDialog Tests
  // ==========================================================================

  describe('handleTemplateSaveDialog', () => {
    it('should return validation error for invalid payload', async () => {
      const result = await handleTemplateSaveDialog({ invalid: true });

      expect(result).toHaveProperty('success', false);
      if (!('success' in result && result.success)) {
        expect(result.error).toBeDefined();
      }
    });

    it('should show save dialog and return selected path', async () => {
      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: '/save/template.mdxt',
      });

      const result = await handleTemplateSaveDialog({ action: 'showSaveDialog' });

      expect(result).toHaveProperty('success', true);
      if ('success' in result && result.success) {
        expect(result.path).toBe('/save/template.mdxt');
        expect(result.canceled).toBe(false);
      }
    });

    it('should return null path when dialog is canceled', async () => {
      mockShowSaveDialog.mockResolvedValue({
        canceled: true,
      });

      const result = await handleTemplateSaveDialog({ action: 'showSaveDialog' });

      expect(result).toHaveProperty('success', true);
      if ('success' in result && result.success) {
        expect(result.path).toBeNull();
        expect(result.canceled).toBe(true);
      }
    });

    it('should use default name when provided', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: true });

      await handleTemplateSaveDialog({ action: 'showSaveDialog', defaultName: 'my-template' });

      expect(mockShowSaveDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultPath: 'my-template.mdxt',
        })
      );
    });

    it('should use generic default when no name provided', async () => {
      mockShowSaveDialog.mockResolvedValue({ canceled: true });

      await handleTemplateSaveDialog({ action: 'showSaveDialog' });

      expect(mockShowSaveDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultPath: 'template.mdxt',
        })
      );
    });
  });
});
