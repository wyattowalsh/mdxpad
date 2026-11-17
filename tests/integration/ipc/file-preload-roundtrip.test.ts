/**
 * Cross-process integration tests for file read/write IPC.
 *
 * Exercises renderer preload -> ipcRenderer.invoke -> main handler -> file service.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { BrowserWindow, IpcMain } from 'electron';

const registeredHandlers = new Map<string, (event: unknown, args?: unknown) => Promise<unknown>>();

const mockWindow = {
  isDestroyed: vi.fn(() => false),
  webContents: {
    id: 42,
    isDestroyed: vi.fn(() => false),
    send: vi.fn(),
    mainFrame: { routingId: 84 },
  },
} as unknown as BrowserWindow;

const authorizedEvent = {
  sender: {
    id: mockWindow.webContents.id,
    mainFrame: { routingId: mockWindow.webContents.mainFrame.routingId },
  },
  senderFrame: { routingId: mockWindow.webContents.mainFrame.routingId },
};

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(
      (channel: string, handler: (event: unknown, args?: unknown) => Promise<unknown>) => {
        registeredHandlers.set(channel, handler);
      }
    ),
  },
  ipcRenderer: {
    invoke: vi.fn(async (channel: string, args?: unknown) => {
      const handler = registeredHandlers.get(channel);
      if (!handler) {
        throw new Error(`No IPC handler registered for channel: ${channel}`);
      }
      return handler(authorizedEvent, args);
    }),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showMessageBox: vi.fn(),
  },
  app: {
    getVersion: vi.fn(() => '0.1.0'),
  },
}));

vi.mock('@main/menu', () => ({
  addToRecentFiles: vi.fn(),
}));

vi.mock('@main/services/file-service', async () => {
  const actual = await vi.importActual<typeof import('@main/services/file-service')>(
    '@main/services/file-service'
  );

  return {
    ...actual,
    createFileServiceIntegration: vi.fn(() => ({
      onFileOpened: vi.fn(),
      onFileSaved: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    })),
  };
});

import { dialog, ipcMain, ipcRenderer } from 'electron';
import { grantWriteCapability, resetFileCapabilities } from '@main/ipc/document-capability';
import { registerFileHandlers } from '@main/ipc/file-handlers';
import { fileOperations } from '@preload/file-api';
import { IPC_CHANNELS } from '@shared/lib/ipc';

const mockIpcRenderer = ipcRenderer as unknown as { invoke: Mock };
const mockDialog = dialog as unknown as { showOpenDialog: Mock };

describe('file IPC preload/main roundtrip', () => {
  let tempDir: string;
  let filePath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers.clear();

    tempDir = mkdtempSync(join(tmpdir(), 'mdxpad-ipc-roundtrip-'));
    filePath = join(tempDir, 'document.mdx');
    writeFileSync(filePath, '# Initial', 'utf8');

    registerFileHandlers(ipcMain as unknown as IpcMain, mockWindow);
  });

  afterEach(() => {
    resetFileCapabilities();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('reads file content through validated IPC roundtrip', async () => {
    grantWriteCapability(filePath);
    const result = await fileOperations.readFile(filePath);

    expect(result).toEqual({ ok: true, value: '# Initial' });
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.file.read, {
      path: filePath,
    });
  });

  it('writes file content through validated IPC roundtrip', async () => {
    mockDialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [filePath],
    });
    const openResult = await fileOperations.openFile();
    expect(openResult).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({ path: filePath }),
      })
    );

    const result = await fileOperations.writeFile(filePath, '# Updated');

    expect(result).toEqual({ ok: true, value: undefined });
    expect(readFileSync(filePath, 'utf8')).toBe('# Updated');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.file.write, {
      path: filePath,
      content: '# Updated',
    });
  });

  it('rejects markdown writes without explicit open-file grant', async () => {
    const result = await fileOperations.writeFile(filePath, '# Updated');

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'PERMISSION_DENIED',
        path: filePath,
      },
    });
    expect(readFileSync(filePath, 'utf8')).toBe('# Initial');
  });

  it('rejects invalid preload payload before invoking ipc', async () => {
    await expect(fileOperations.readFile('relative/path.mdx')).rejects.toThrow(
      'Request validation failed'
    );
    expect(mockIpcRenderer.invoke).not.toHaveBeenCalled();
  });
});
