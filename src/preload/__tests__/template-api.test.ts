/**
 * Template API Preload Bridge Tests
 *
 * Tests for template operations exposed to the renderer process.
 * Unlike other preload APIs, template-api uses ipcRenderer.invoke
 * directly with manual Zod validation (not validatedInvoke).
 *
 * @module tests/unit/preload/template-api
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock Setup
// ============================================================================

const mockInvoke = vi.fn();

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: (...args: unknown[]) => mockInvoke(...args),
    on: vi.fn(),
  },
}));

import { templateApi } from '../template-api';
import { IPC_CHANNELS } from '@shared/lib/ipc';

// ============================================================================
// Fixtures - responses must match Zod schemas exactly
// ============================================================================

/** Valid TemplateMetadata matching TemplateMetadataSchema */
const validMetadata = {
  id: 'blog',
  name: 'Blog Post',
  description: 'A blog post template',
  category: 'blog' as const,
  tags: [],
  isBuiltIn: true,
};

/** Valid full Template matching TemplateSchema */
const validTemplate = {
  ...validMetadata,
  version: '1.0.0',
  variables: [],
  content: '# Blog Post',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  filePath: '/templates/blog.mdxt',
};

// ============================================================================
// Tests
// ============================================================================

describe('templateApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // list
  // --------------------------------------------------------------------------

  describe('list', () => {
    it('should list all templates by default', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        templates: [validMetadata],
      });

      const result = await templateApi.list();

      expect(mockInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.template.list,
        expect.objectContaining({ action: 'list', source: 'all' })
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
      }
    });

    it('should filter by source', async () => {
      mockInvoke.mockResolvedValue({ success: true, templates: [] });

      await templateApi.list('builtin');

      expect(mockInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.template.list,
        expect.objectContaining({ source: 'builtin' })
      );
    });

    it('should return error for invalid response', async () => {
      mockInvoke.mockResolvedValue('invalid response');

      const result = await templateApi.list();

      expect(result.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // get
  // --------------------------------------------------------------------------

  describe('get', () => {
    it('should get template by ID', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        template: validTemplate,
      });

      const result = await templateApi.get('blog');

      expect(mockInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.template.get,
        expect.objectContaining({ action: 'get', id: 'blog' })
      );
      expect(result.success).toBe(true);
    });

    it('should handle error responses', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Template not found',
        code: 'NOT_FOUND',
      });

      const result = await templateApi.get('nonexistent');

      expect(result.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // save
  // --------------------------------------------------------------------------

  describe('save', () => {
    it('should save a template', async () => {
      const template = {
        id: 'my-template',
        name: 'My Template',
        description: 'A test template',
        category: 'custom' as const,
        tags: ['test'],
        variables: [],
        content: '# Hello',
        isBuiltIn: false,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        filePath: '/templates/my-template.mdxt',
      };

      mockInvoke.mockResolvedValue({
        success: true,
        template: {
          id: 'my-template',
          name: 'My Template',
          description: 'A test template',
          category: 'custom',
          tags: ['test'],
          isBuiltIn: false,
        },
      });

      const result = await templateApi.save(template as never);

      expect(mockInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.template.save,
        expect.objectContaining({ action: 'save', replace: false })
      );
      expect(result.success).toBe(true);
    });

    it('should support replace flag', async () => {
      const template = {
        id: 'existing',
        name: 'Existing',
        description: 'An existing template',
        category: 'custom' as const,
        tags: [],
        variables: [],
        content: '# Updated',
        isBuiltIn: false,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        filePath: '/templates/existing.mdxt',
      };

      mockInvoke.mockResolvedValue({
        success: true,
        template: {
          id: 'existing',
          name: 'Existing',
          description: 'An existing template',
          category: 'custom',
          tags: [],
          isBuiltIn: false,
        },
      });

      await templateApi.save(template as never, true);

      expect(mockInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.template.save,
        expect.objectContaining({ replace: true })
      );
    });
  });

  // --------------------------------------------------------------------------
  // delete
  // --------------------------------------------------------------------------

  describe('delete', () => {
    it('should delete a template by ID', async () => {
      mockInvoke.mockResolvedValue({ success: true, id: 'my-template' });

      const result = await templateApi.delete('my-template');

      expect(mockInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.template.delete,
        expect.objectContaining({ action: 'delete', id: 'my-template' })
      );
      expect(result.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // import
  // --------------------------------------------------------------------------

  describe('import', () => {
    it('should import a template from path', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        template: {
          id: 'imported',
          name: 'Imported',
          description: 'An imported template',
          category: 'custom',
          tags: [],
          isBuiltIn: false,
        },
      });

      const result = await templateApi.import('/path/to/template.mdxt');

      expect(mockInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.template.import,
        expect.objectContaining({
          action: 'import',
          path: '/path/to/template.mdxt',
          replace: false,
        })
      );
      expect(result.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // export
  // --------------------------------------------------------------------------

  describe('export', () => {
    it('should export a template to path', async () => {
      mockInvoke.mockResolvedValue({ success: true, path: '/export/template.mdxt' });

      const result = await templateApi.export('blog', '/export/template.mdxt');

      expect(mockInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.template.export,
        expect.objectContaining({ action: 'export', id: 'blog', path: '/export/template.mdxt' })
      );
      expect(result.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // validate
  // --------------------------------------------------------------------------

  describe('validate', () => {
    it('should validate MDX content', async () => {
      mockInvoke.mockResolvedValue({ success: true, valid: true, errors: [] });

      const result = await templateApi.validate('# Hello MDX');

      expect(mockInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.template.validate,
        expect.objectContaining({ action: 'validate', content: '# Hello MDX' })
      );
      expect(result.success).toBe(true);
    });

    it('should return validation errors', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        valid: false,
        errors: ['Invalid JSX syntax'],
      });

      const result = await templateApi.validate('<Invalid>');

      expect(result.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // createFromTemplate
  // --------------------------------------------------------------------------

  describe('createFromTemplate', () => {
    it('should create document from template with variables', async () => {
      mockInvoke.mockResolvedValue({ success: true, content: '# My Post' });

      const result = await templateApi.createFromTemplate('blog', { title: 'My Post' });

      expect(mockInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.template.createFromTemplate,
        expect.objectContaining({
          templateId: 'blog',
          variables: { title: 'My Post' },
        })
      );
      expect(result.success).toBe(true);
    });

    it('should pass savePath when provided', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        content: '# My Post',
        path: '/save/path.mdx',
      });

      await templateApi.createFromTemplate('blog', { title: 'My Post' }, '/save/path.mdx');

      expect(mockInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.template.createFromTemplate,
        expect.objectContaining({ savePath: '/save/path.mdx' })
      );
    });
  });

  // --------------------------------------------------------------------------
  // showOpenDialog / showSaveDialog
  // --------------------------------------------------------------------------

  describe('showOpenDialog', () => {
    it('should show open dialog and return path', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        path: '/chosen/template.mdxt',
        canceled: false,
      });

      const result = await templateApi.showOpenDialog();

      expect(mockInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.template.showOpenDialog,
        expect.objectContaining({ action: 'showOpenDialog' })
      );
      expect(result.success).toBe(true);
    });

    it('should handle canceled dialog', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        path: null,
        canceled: true,
      });

      const result = await templateApi.showOpenDialog();

      expect(result.success).toBe(true);
    });
  });

  describe('showSaveDialog', () => {
    it('should show save dialog with default name', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        path: '/save/custom.mdxt',
        canceled: false,
      });

      const result = await templateApi.showSaveDialog('custom');

      expect(mockInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.template.showSaveDialog,
        expect.objectContaining({ action: 'showSaveDialog', defaultName: 'custom' })
      );
      expect(result.success).toBe(true);
    });
  });
});
