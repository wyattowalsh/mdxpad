/**
 * File API Preload Bridge Tests
 *
 * Tests for file operations, window operations, and app info API
 * exposed to the renderer process via contextBridge.
 *
 * @module tests/unit/preload/file-api
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock Setup
// ============================================================================

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
  },
}));

const mockValidatedInvoke = vi.fn();

vi.mock('../validated-invoke', () => ({
  validatedInvoke: (...args: unknown[]) => mockValidatedInvoke(...args),
}));

import { appInfo, fileOperations, windowOperations } from '../file-api';
import { IPC_CHANNELS } from '@shared/lib/ipc';

// ============================================================================
// Tests
// ============================================================================

describe('appInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getVersion', () => {
    it('should invoke app:get-version channel with no request data', async () => {
      mockValidatedInvoke.mockResolvedValue('1.0.0');

      const result = await appInfo.getVersion();

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.app.getVersion,
        null,
        expect.any(Object)
      );
      expect(result).toBe('1.0.0');
    });
  });

  describe('getSecurityInfo', () => {
    it('should invoke app:get-security-info channel', async () => {
      const secInfo = {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
      };
      mockValidatedInvoke.mockResolvedValue(secInfo);

      const result = await appInfo.getSecurityInfo();

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.app.getSecurityInfo,
        null,
        expect.any(Object)
      );
      expect(result).toEqual(secInfo);
    });
  });

  describe('signalReady', () => {
    it('should invoke app:ready channel', async () => {
      mockValidatedInvoke.mockResolvedValue({ ok: true });

      await appInfo.signalReady();

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.app.ready,
        null,
        expect.any(Object)
      );
    });
  });
});

describe('fileOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('openFile', () => {
    it('should invoke file:open channel with no request data', async () => {
      const mockResult = {
        success: true,
        data: { id: 'test-id', path: '/test.mdx', name: 'test.mdx' },
      };
      mockValidatedInvoke.mockResolvedValue(mockResult);

      const result = await fileOperations.openFile();

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.file.open,
        null,
        expect.any(Object)
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('saveFile', () => {
    it('should invoke file:save with handle and content', async () => {
      const handle = { id: 'test-id', path: '/test.mdx', name: 'test.mdx' };
      mockValidatedInvoke.mockResolvedValue({ success: true });

      await fileOperations.saveFile(handle, 'file content');

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.file.save,
        expect.any(Object), // FileSaveRequestSchema
        expect.any(Object), // FileSaveResponseSchema
        { handle, content: 'file content' }
      );
    });
  });

  describe('saveFileAs', () => {
    it('should invoke file:save-as with content', async () => {
      mockValidatedInvoke.mockResolvedValue({
        success: true,
        data: { id: 'new-id', path: '/new.mdx', name: 'new.mdx' },
      });

      await fileOperations.saveFileAs('new content');

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.file.saveAs,
        expect.any(Object),
        expect.any(Object),
        { content: 'new content' }
      );
    });
  });

  describe('readFile', () => {
    it('should invoke file:read with path', async () => {
      mockValidatedInvoke.mockResolvedValue({ success: true, data: 'file content' });

      await fileOperations.readFile('/test/path.mdx');

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.file.read,
        expect.any(Object),
        expect.any(Object),
        { path: '/test/path.mdx' }
      );
    });
  });

  describe('inlinePreviewImages', () => {
    it('should invoke file:inline-preview-images with the open document', async () => {
      mockValidatedInvoke.mockResolvedValue({ content: '![P](data:image/png;base64,aa)' });

      const result = await fileOperations.inlinePreviewImages('![P](pixel.png)', '/docs/note.md');

      expect(result).toBe('![P](data:image/png;base64,aa)');
      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.file.inlinePreviewImages,
        expect.any(Object),
        expect.any(Object),
        { content: '![P](pixel.png)', sourcePath: '/docs/note.md' }
      );
    });
  });

  describe('writeFile', () => {
    it('should invoke file:write with path and content', async () => {
      mockValidatedInvoke.mockResolvedValue({ success: true });

      await fileOperations.writeFile('/test/path.mdx', 'content');

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.file.write,
        expect.any(Object),
        expect.any(Object),
        { path: '/test/path.mdx', content: 'content' }
      );
    });
  });

  describe('exportFile', () => {
    it('should invoke file:export with content and optional sourcePath', async () => {
      mockValidatedInvoke.mockResolvedValue({
        ok: true,
        value: { path: '/test/path.html', format: 'html', warnings: [] },
      });

      await fileOperations.exportFile('# content', { sourcePath: '/test/path.mdx' });

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.file.export,
        expect.any(Object),
        expect.any(Object),
        { content: '# content', sourcePath: '/test/path.mdx' }
      );
    });
  });
});

describe('windowOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('closeWindow', () => {
    it('should invoke window:close channel', async () => {
      mockValidatedInvoke.mockResolvedValue({ ok: true });

      await windowOperations.closeWindow();

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.window.close,
        null,
        expect.any(Object)
      );
    });
  });

  describe('minimizeWindow', () => {
    it('should invoke window:minimize channel', async () => {
      mockValidatedInvoke.mockResolvedValue({ ok: true });

      await windowOperations.minimizeWindow();

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.window.minimize,
        null,
        expect.any(Object)
      );
    });
  });

  describe('maximizeWindow', () => {
    it('should invoke window:maximize channel', async () => {
      mockValidatedInvoke.mockResolvedValue({ ok: true });

      await windowOperations.maximizeWindow();

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.window.maximize,
        null,
        expect.any(Object)
      );
    });
  });
});
