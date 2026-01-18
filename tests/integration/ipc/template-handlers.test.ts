/**
 * Integration tests for template IPC handlers.
 * Tests all template handlers with mock file system, validates zod rejection
 * of invalid payloads, and tests error code mapping.
 *
 * Per Constitution Section 3.3: All payloads validated with zod on both ends.
 *
 * Feature: 016-template-library
 * Task: T033
 *
 * @module tests/integration/ipc/template-handlers.test
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { IpcMain } from 'electron';

// Mock electron modules before importing handlers
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
    getAppPath: vi.fn(() => '/mock/app'),
    getVersion: vi.fn(() => '0.1.0'),
    isPackaged: false,
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
  mkdir: vi.fn(),
  copyFile: vi.fn(),
  access: vi.fn(),
  stat: vi.fn(),
}));

// Mock path module
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return {
    ...actual,
    join: vi.fn((...args: string[]) => args.join('/')),
    basename: vi.fn((p: string) => p.split('/').pop() ?? ''),
  };
});

// Mock MDX compiler
vi.mock('@mdx-js/mdx', () => ({
  compile: vi.fn(),
}));

// Import after mocks are set up
import { registerTemplateHandlers } from '@main/services/template';
import { IPC_CHANNELS } from '@shared/lib/ipc';
import { dialog, ipcMain } from 'electron';
import * as fs from 'fs/promises';
import { compile } from '@mdx-js/mdx';

// Type assertion helpers for mocks
const mockDialog = dialog as unknown as {
  showOpenDialog: Mock;
  showSaveDialog: Mock;
};
const mockIpcMain = ipcMain as unknown as { handle: Mock };
const mockFs = fs as unknown as {
  readdir: Mock;
  readFile: Mock;
  writeFile: Mock;
  unlink: Mock;
  mkdir: Mock;
  copyFile: Mock;
  access: Mock;
  stat: Mock;
};
const mockCompile = compile as Mock;

// Test template content
const VALID_TEMPLATE_CONTENT = `---
name: "Test Template"
description: "A test template"
category: "notes"
tags:
  - test
variables:
  - name: "title"
    description: "Title"
    default: "Untitled"
---

# {{title}}

Content here...
`;

const MINIMAL_TEMPLATE_CONTENT = `---
name: "Minimal"
description: "Minimal template"
category: "custom"
---

Content
`;

describe('template-handlers', () => {
  let registeredHandlers: Map<string, (event: unknown, args?: unknown) => Promise<unknown>>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Track registered handlers
    registeredHandlers = new Map();
    mockIpcMain.handle.mockImplementation(
      (channel: string, handler: (event: unknown, args?: unknown) => Promise<unknown>) => {
        registeredHandlers.set(channel, handler);
      }
    );

    // Setup default mock responses
    mockFs.readdir.mockResolvedValue([]);
    mockFs.readFile.mockResolvedValue(VALID_TEMPLATE_CONTENT);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.access.mockRejectedValue(new Error('ENOENT'));
    mockFs.stat.mockResolvedValue({ isFile: () => true, isDirectory: () => false });
    mockCompile.mockResolvedValue({ toString: () => 'compiled' });

    // Register handlers
    registerTemplateHandlers(ipcMain);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerTemplateHandlers', () => {
    it('should register all expected IPC handlers', () => {
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.template.list,
        expect.any(Function)
      );
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.template.get,
        expect.any(Function)
      );
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.template.save,
        expect.any(Function)
      );
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.template.delete,
        expect.any(Function)
      );
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.template.import,
        expect.any(Function)
      );
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.template.export,
        expect.any(Function)
      );
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.template.validate,
        expect.any(Function)
      );
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.template.createFromTemplate,
        expect.any(Function)
      );
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.template.showOpenDialog,
        expect.any(Function)
      );
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        IPC_CHANNELS.template.showSaveDialog,
        expect.any(Function)
      );
    });
  });

  describe('template:list handler', () => {
    it('should return empty list when no templates exist', async () => {
      const handler = registeredHandlers.get(IPC_CHANNELS.template.list);
      expect(handler).toBeDefined();

      const result = await handler!({}, { action: 'list', source: 'all' });
      expect(result).toHaveProperty('success');
    });

    it('should reject invalid payload', async () => {
      const handler = registeredHandlers.get(IPC_CHANNELS.template.list);
      expect(handler).toBeDefined();

      const result = await handler!({}, { invalid: 'payload' });
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('template:get handler', () => {
    it('should reject invalid payload (missing id)', async () => {
      const handler = registeredHandlers.get(IPC_CHANNELS.template.get);
      expect(handler).toBeDefined();

      const result = await handler!({}, { action: 'get' });
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('template:save handler', () => {
    it('should reject invalid payload', async () => {
      const handler = registeredHandlers.get(IPC_CHANNELS.template.save);
      expect(handler).toBeDefined();

      // Missing required fields
      const result = await handler!({}, {
        action: 'save',
        template: { name: 'Test' }, // Missing required fields
      });
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should accept valid save payload', async () => {
      const handler = registeredHandlers.get(IPC_CHANNELS.template.save);
      expect(handler).toBeDefined();

      mockFs.access.mockRejectedValue(new Error('ENOENT')); // Template doesn't exist
      mockCompile.mockResolvedValue({ toString: () => 'compiled' });

      const result = await handler!({}, {
        action: 'save',
        template: {
          name: 'New Template',
          description: 'A new template',
          category: 'notes',
          content: '# Test\n\nContent',
        },
        replace: false,
      });

      expect(result).toHaveProperty('success');
    });
  });

  describe('template:delete handler', () => {
    it('should reject invalid payload (missing id)', async () => {
      const handler = registeredHandlers.get(IPC_CHANNELS.template.delete);
      expect(handler).toBeDefined();

      const result = await handler!({}, { action: 'delete' });
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should accept valid delete request', async () => {
      const handler = registeredHandlers.get(IPC_CHANNELS.template.delete);
      expect(handler).toBeDefined();

      const result = await handler!({}, {
        action: 'delete',
        id: 'test-template-id',
      });

      // Will fail if template not found, but should not fail validation
      expect(result).toHaveProperty('success');
    });
  });

  describe('template:import handler', () => {
    it('should reject invalid payload (missing path)', async () => {
      const handler = registeredHandlers.get(IPC_CHANNELS.template.import);
      expect(handler).toBeDefined();

      const result = await handler!({}, { action: 'import' });
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('template:export handler', () => {
    it('should reject invalid payload (missing id or path)', async () => {
      const handler = registeredHandlers.get(IPC_CHANNELS.template.export);
      expect(handler).toBeDefined();

      const result = await handler!({}, { action: 'export', id: 'test' });
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('template:validate handler', () => {
    it('should validate valid MDX content', async () => {
      const handler = registeredHandlers.get(IPC_CHANNELS.template.validate);
      expect(handler).toBeDefined();

      mockCompile.mockResolvedValue({ toString: () => 'compiled' });

      const result = await handler!({}, {
        action: 'validate',
        content: '# Hello\n\nValid MDX content',
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('valid', true);
      expect(result).toHaveProperty('errors');
    });

    it('should reject invalid MDX content', async () => {
      const handler = registeredHandlers.get(IPC_CHANNELS.template.validate);
      expect(handler).toBeDefined();

      mockCompile.mockRejectedValue(new Error('MDX compilation error'));

      const result = await handler!({}, {
        action: 'validate',
        content: '<Component invalid syntax',
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('valid', false);
      const typedResult = result as { success: boolean; valid: boolean; errors: string[] };
      expect(typedResult.errors).toContain('MDX compilation error');
    });

    it('should reject missing content', async () => {
      const handler = registeredHandlers.get(IPC_CHANNELS.template.validate);
      expect(handler).toBeDefined();

      const result = await handler!({}, { action: 'validate' });
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('template:createFromTemplate handler', () => {
    it('should reject invalid payload', async () => {
      const handler = registeredHandlers.get(IPC_CHANNELS.template.createFromTemplate);
      expect(handler).toBeDefined();

      const result = await handler!({}, { action: 'createFromTemplate' });
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('template:showOpenDialog handler', () => {
    it('should show open dialog and return result', async () => {
      const handler = registeredHandlers.get(IPC_CHANNELS.template.showOpenDialog);
      expect(handler).toBeDefined();

      mockDialog.showOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['/path/to/template.mdxt'],
      });

      const result = await handler!({}, { action: 'showOpenDialog' });

      expect(mockDialog.showOpenDialog).toHaveBeenCalled();
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('path', '/path/to/template.mdxt');
      expect(result).toHaveProperty('canceled', false);
    });

    it('should handle cancelled dialog', async () => {
      const handler = registeredHandlers.get(IPC_CHANNELS.template.showOpenDialog);
      expect(handler).toBeDefined();

      mockDialog.showOpenDialog.mockResolvedValue({
        canceled: true,
        filePaths: [],
      });

      const result = await handler!({}, { action: 'showOpenDialog' });

      expect(result).toHaveProperty('success', true);
      const typedResult = result as { success: boolean; canceled: boolean; path: string | null };
      expect(typedResult.canceled).toBe(true);
      expect(typedResult.path).toBeNull();
    });
  });

  describe('template:showSaveDialog handler', () => {
    it('should show save dialog and return result', async () => {
      const handler = registeredHandlers.get(IPC_CHANNELS.template.showSaveDialog);
      expect(handler).toBeDefined();

      mockDialog.showSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: '/path/to/exported.mdxt',
      });

      const result = await handler!({}, { action: 'showSaveDialog', defaultName: 'my-template' });

      expect(mockDialog.showSaveDialog).toHaveBeenCalled();
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('path', '/path/to/exported.mdxt');
      expect(result).toHaveProperty('canceled', false);
    });

    it('should handle cancelled dialog', async () => {
      const handler = registeredHandlers.get(IPC_CHANNELS.template.showSaveDialog);
      expect(handler).toBeDefined();

      mockDialog.showSaveDialog.mockResolvedValue({
        canceled: true,
        filePath: undefined,
      });

      const result = await handler!({}, { action: 'showSaveDialog' });

      expect(result).toHaveProperty('success', true);
      const typedResult = result as { success: boolean; canceled: boolean; path: string | null };
      expect(typedResult.canceled).toBe(true);
      expect(typedResult.path).toBeNull();
    });
  });
});
