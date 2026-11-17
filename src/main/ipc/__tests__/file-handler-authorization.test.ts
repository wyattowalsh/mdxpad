/**
 * File handler sender/frame authorization tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserWindow, IpcMain } from 'electron';

import { IPC_CHANNELS } from '@shared/lib/ipc';
import * as FileService from '@main/services/file-service';
import { registerFileHandlers } from '../file-handlers';

const onFileOpenedMock = vi.fn();
const onFileSavedMock = vi.fn();

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '1.0.0'),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
}));

vi.mock('@main/services/file-service', () => ({
  readFile: vi.fn().mockResolvedValue({ ok: true, value: '# Test' }),
  writeFile: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  createFileHandle: vi.fn().mockImplementation((filePath: string) => ({
    id: '123e4567-e89b-12d3-a456-426614174000',
    path: filePath,
    name: 'file.mdx',
  })),
  createFileServiceIntegration: vi.fn().mockImplementation(() => ({
    onFileOpened: onFileOpenedMock,
    onFileSaved: onFileSavedMock,
    close: vi.fn(),
  })),
}));

vi.mock('@main/menu', () => ({
  addToRecentFiles: vi.fn(),
}));

const mockIpcMain = {
  handle: vi.fn(),
} as unknown as IpcMain;

function createMockWindow(): BrowserWindow {
  return {
    webContents: {
      id: 42,
      mainFrame: { routingId: 99 },
    },
  } as unknown as BrowserWindow;
}

function createInvokeEvent(
  window: BrowserWindow,
  overrides?: { senderId?: number; senderFrameRoutingId?: number }
) {
  const senderId = overrides?.senderId ?? window.webContents.id;
  const senderFrameRoutingId =
    overrides?.senderFrameRoutingId ?? window.webContents.mainFrame.routingId;

  return {
    sender: {
      id: senderId,
      mainFrame: { routingId: window.webContents.mainFrame.routingId },
    },
    senderFrame: { routingId: senderFrameRoutingId },
  };
}

describe('registerFileHandlers authorization', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;
  let window: BrowserWindow;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = {};
    window = createMockWindow();

    vi.mocked(mockIpcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });

    registerFileHandlers(mockIpcMain, window);
  });

  it('denies file:read until a dialog grant exists', async () => {
    const result = await handlers[IPC_CHANNELS.file.read]!(createInvokeEvent(window), {
      path: '/test/file.mdx',
    });

    expect(result).toEqual({
      ok: false,
      error: { code: 'PERMISSION_DENIED', path: '/test/file.mdx' },
    });
    expect(FileService.readFile).not.toHaveBeenCalled();
  });

  it('rejects unauthorized sender for file:read', async () => {
    expect(() =>
      handlers[IPC_CHANNELS.file.read]!(
        createInvokeEvent(window, { senderId: window.webContents.id + 1 }),
        { path: '/test/file.mdx' }
      )
    ).toThrow('Unauthorized IPC sender');

    expect(FileService.readFile).not.toHaveBeenCalled();
  });

  it('rejects non-main-frame sender for file:read', async () => {
    expect(() =>
      handlers[IPC_CHANNELS.file.read]!(
        createInvokeEvent(window, {
          senderFrameRoutingId: window.webContents.mainFrame.routingId + 1,
        }),
        { path: '/test/file.mdx' }
      )
    ).toThrow('Unauthorized IPC sender');

    expect(FileService.readFile).not.toHaveBeenCalled();
  });

  it('wires opened files into file integration lifecycle', async () => {
    const { dialog } = await import('electron');
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['/test/file.mdx'],
    } as never);

    await handlers[IPC_CHANNELS.file.open]!(createInvokeEvent(window), undefined);

    expect(onFileOpenedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/test/file.mdx',
        name: 'file.mdx',
      })
    );
  });

  it('returns a schema-valid error result when createFileHandle returns malformed data', async () => {
    const { dialog } = await import('electron');
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['/test/file.mdx'],
    } as never);
    vi.mocked(FileService.createFileHandle).mockReturnValueOnce({
      id: 'not-a-uuid',
      path: '/test/file.mdx',
      name: 'file.mdx',
    } as unknown as ReturnType<typeof FileService.createFileHandle>);

    const result = await handlers[IPC_CHANNELS.file.open]!(createInvokeEvent(window), undefined);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'UNKNOWN',
        message: expect.stringContaining('Invalid file handle'),
      },
    });
    expect(onFileOpenedMock).not.toHaveBeenCalled();
  });

  it('wires saved files into file integration lifecycle', async () => {
    const { dialog } = await import('electron');
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['/test/file.mdx'],
    } as never);

    await handlers[IPC_CHANNELS.file.open]!(createInvokeEvent(window), undefined);

    await handlers[IPC_CHANNELS.file.save]!(createInvokeEvent(window), {
      handle: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        path: '/test/file.mdx',
        name: 'file.mdx',
      },
      content: '# Updated',
    });

    expect(onFileSavedMock).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
  });

  it('denies file:write when path lacks granted capability', async () => {
    const result = await handlers[IPC_CHANNELS.file.write]!(createInvokeEvent(window), {
      path: '/test/secrets.env',
      content: 'SECRET=1',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'PERMISSION_DENIED',
        path: '/test/secrets.env',
      },
    });
    expect(FileService.writeFile).not.toHaveBeenCalled();
  });

  it('denies file:write after non-bootstrap read attempt', async () => {
    await handlers[IPC_CHANNELS.file.read]!(createInvokeEvent(window), {
      path: '/test/notes.json',
    });

    const result = await handlers[IPC_CHANNELS.file.write]!(createInvokeEvent(window), {
      path: '/test/notes.json',
      content: '# Updated',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'PERMISSION_DENIED',
        path: '/test/notes.json',
      },
    });
    expect(FileService.writeFile).not.toHaveBeenCalled();
  });

  it('denies file:write without explicit grant and does not bootstrap via read', async () => {
    const result = await handlers[IPC_CHANNELS.file.write]!(createInvokeEvent(window), {
      path: '/test/bootstrap.bin',
      content: '# Updated',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'PERMISSION_DENIED',
        path: '/test/bootstrap.bin',
      },
    });
    expect(FileService.readFile).not.toHaveBeenCalled();
    expect(FileService.writeFile).not.toHaveBeenCalled();
  });

  it('denies file:write for markdown paths without explicit grant', async () => {
    const result = await handlers[IPC_CHANNELS.file.write]!(createInvokeEvent(window), {
      path: '/test/bootstrap.mdx',
      content: '# Updated',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'PERMISSION_DENIED',
        path: '/test/bootstrap.mdx',
      },
    });
    expect(FileService.writeFile).not.toHaveBeenCalled();
  });

  it('rejects export when sourcePath is outside granted read capability scope', async () => {
    const result = await handlers[IPC_CHANNELS.file.export]!(createInvokeEvent(window), {
      content: '# exported',
      sourcePath: '/test/private.key',
      format: 'markdown',
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({
          code: 'UNKNOWN',
          message: expect.stringContaining('not authorized'),
        }),
      })
    );
  });

  it('allows authorized sender/main-frame for file:export', async () => {
    const { dialog } = await import('electron');
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      canceled: false,
      filePath: '/test/file.md',
    } as never);

    await handlers[IPC_CHANNELS.file.export]!(createInvokeEvent(window), {
      content: '# exported',
      format: 'markdown',
    });

    expect(FileService.writeFile).toHaveBeenCalledWith('/test/file.md', '# exported');
  });

  it('rejects unauthorized sender for file:export', async () => {
    expect(() =>
      handlers[IPC_CHANNELS.file.export]!(
        createInvokeEvent(window, { senderId: window.webContents.id + 1 }),
        { content: '# exported', format: 'markdown' }
      )
    ).toThrow('Unauthorized IPC sender');
  });
});
