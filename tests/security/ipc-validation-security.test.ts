/**
 * IPC Validation Security Tests
 *
 * Verifies that Wave 3 IPC handlers (collab, share, history, notification)
 * validate input with Zod, reject malformed payloads, and don't leak internals.
 *
 * @module tests/security/ipc-validation-security
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  shell: { openPath: vi.fn() },
}));

import { ipcMain } from 'electron';
import { CollabChannels } from '@shared/contracts/collab-schemas';
import { ShareChannels } from '@shared/contracts/share-schemas';
import { HistoryChannels } from '@shared/contracts/history-schemas';
import { NotificationChannels } from '@shared/contracts/notification-schemas';
import { registerCollabHandlers } from '@main/ipc/collab-handlers';
import { registerShareHandlers } from '@main/ipc/share-handlers';
import { registerHistoryHandlers } from '@main/ipc/history-handlers';
import { registerNotificationHandlers } from '@main/ipc/notification-handlers';
import type { CollaborationServer } from '@main/services/collab-server';
import type { ShareLinkService } from '@main/services/share-link-service';
import type { VersionHistoryService } from '@main/services/version-history-service';
import type { NotificationService } from '@main/services/notification-service';

const mockIpcMain = ipcMain as unknown as { handle: Mock };
type HandlerFn = (event: IpcMainInvokeEvent, args?: unknown) => Promise<unknown>;

function captureHandlers(): Map<string, HandlerFn> {
  const handlers = new Map<string, HandlerFn>();
  mockIpcMain.handle.mockImplementation((ch: string, h: HandlerFn) => {
    handlers.set(ch, h);
  });
  return handlers;
}

function evt(): IpcMainInvokeEvent {
  return {
    sender: { id: 1, mainFrame: { routingId: 1 } },
    senderFrame: { routingId: 1 },
  } as unknown as IpcMainInvokeEvent;
}

function mockWindow(): BrowserWindow {
  return {
    isDestroyed: vi.fn(() => false),
    webContents: { id: 1, mainFrame: { routingId: 1 }, send: vi.fn() },
  } as unknown as BrowserWindow;
}

/** Verify error messages don't leak host environment details.
 *  macOS-only — extend for cross-platform if needed. */
function assertNoInternalLeaks(msg: string): void {
  expect(msg).not.toMatch(/\/Users\//);
  expect(msg).not.toMatch(/\/home\//);
  expect(msg).not.toMatch(/\/var\/folders\//);
  expect(msg).not.toMatch(/\/tmp\//);
  expect(msg).not.toMatch(/\/opt\//);
  expect(msg).not.toMatch(/node:internal/);
  expect(msg).not.toMatch(/node_modules\//);
  expect(msg).not.toMatch(/at\s+\S+\s+\(/);
}

// ============================================================================
// Collab Handler Validation
// ============================================================================
describe('Collab IPC handler validation', () => {
  let handlers: Map<string, HandlerFn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = captureHandlers();
    const server = {
      isRunning: vi.fn(() => true),
      getPort: vi.fn(() => 9876),
      getRoom: vi.fn(() => null),
      start: vi.fn().mockResolvedValue(9876),
    } as unknown as CollaborationServer;
    registerCollabHandlers(mockIpcMain as unknown as IpcMain, server, mockWindow());
  });

  it('registers all collab channels', () => {
    expect(handlers.has(CollabChannels.JOIN)).toBe(true);
    expect(handlers.has(CollabChannels.LEAVE)).toBe(true);
    expect(handlers.has(CollabChannels.STATUS)).toBe(true);
  });

  it.each([
    ['missing docId', { username: 'alice' }],
    ['empty username', { docId: 'doc1', username: '' }],
    ['invalid color', { docId: 'doc1', username: 'alice', color: 'bad' }],
    ['numeric docId', { docId: 12345, username: 'alice' }],
    ['null payload', null],
    ['undefined payload', undefined],
  ])('rejects join with %s', async (_label, payload) => {
    const h = handlers.get(CollabChannels.JOIN);
    await expect(h!(evt(), payload)).rejects.toThrow(/Validation failed/);
  });

  it('rejects leave with missing/empty roomId', async () => {
    const h = handlers.get(CollabChannels.LEAVE);
    await expect(h!(evt(), {})).rejects.toThrow(/Validation failed/);
    await expect(h!(evt(), { roomId: '' })).rejects.toThrow(/Validation failed/);
  });

  it('rejects status with missing roomId', async () => {
    const h = handlers.get(CollabChannels.STATUS);
    await expect(h!(evt(), {})).rejects.toThrow(/Validation failed/);
  });

  it('validation error does not leak internals', async () => {
    try {
      await handlers.get(CollabChannels.JOIN)!(evt(), { bad: 'data' });
      expect.fail('Should have thrown');
    } catch (error) {
      assertNoInternalLeaks(error instanceof Error ? error.message : String(error));
    }
  });

  it('accepts valid join request', async () => {
    const result = await handlers.get(CollabChannels.JOIN)!(evt(), {
      docId: 'doc-123',
      username: 'alice',
      color: '#ff0000',
    });
    expect(result).toMatchObject({ success: true, roomId: 'room-doc-123' });
  });
});

// ============================================================================
// Share Handler Validation
// ============================================================================
describe('Share IPC handler validation', () => {
  let handlers: Map<string, HandlerFn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = captureHandlers();
    const svc = {
      createLink: vi.fn(() => ({
        id: '550e8400-e29b-41d4-a716-446655440000',
        token: 'a'.repeat(64),
        docId: 'doc1',
        url: 'mdxpad://share/t',
        accessMode: 'read-only' as const,
        createdAt: Date.now(),
        expiresAt: null,
        isActive: true,
      })),
      revokeLink: vi.fn(() => true),
      getLinks: vi.fn(() => []),
    } as unknown as ShareLinkService;
    registerShareHandlers(mockIpcMain as unknown as IpcMain, svc, mockWindow());
  });

  it('registers all share channels', () => {
    expect(handlers.has(ShareChannels.CREATE_LINK)).toBe(true);
    expect(handlers.has(ShareChannels.REVOKE_LINK)).toBe(true);
    expect(handlers.has(ShareChannels.GET_LINKS)).toBe(true);
    expect(handlers.has(ShareChannels.MOVE_UNTITLED)).toBe(true);
    expect(handlers.has(ShareChannels.PUBLISH)).toBe(true);
  });

  it('rejects moving share links from a saved file', async () => {
    const handler = handlers.get(ShareChannels.MOVE_UNTITLED);
    await expect(
      handler!(evt(), { fromDocId: '/tmp/one.md', toDocId: '/tmp/two.md' })
    ).rejects.toThrow(/Validation failed/);
  });

  it.each([
    ['missing docId', { accessMode: 'read-only', expiresInMs: null }],
    ['invalid accessMode', { docId: 'd', accessMode: 'admin', expiresInMs: null }],
    ['non-integer expiresInMs', { docId: 'd', accessMode: 'read-only', expiresInMs: 1.5 }],
    ['negative expiresInMs', { docId: 'd', accessMode: 'read-only', expiresInMs: -1000 }],
  ])('rejects create-link with %s', async (_label, payload) => {
    await expect(handlers.get(ShareChannels.CREATE_LINK)!(evt(), payload)).rejects.toThrow(
      /Validation failed/
    );
  });

  it('rejects revoke-link with non-UUID/missing id', async () => {
    const h = handlers.get(ShareChannels.REVOKE_LINK);
    await expect(h!(evt(), { id: 'not-a-uuid' })).rejects.toThrow(/Validation failed/);
    await expect(h!(evt(), {})).rejects.toThrow(/Validation failed/);
  });

  it('rejects publish with empty files or missing outputDir', async () => {
    const h = handlers.get(ShareChannels.PUBLISH);
    await expect(
      h!(evt(), {
        files: [],
        outputDir: '/tmp/out',
        includeStyles: true,
        includeHighlighting: true,
        generateIndex: true,
      })
    ).rejects.toThrow(/Validation failed/);
    await expect(
      h!(evt(), {
        files: [{ path: '/doc.mdx' }],
        includeStyles: true,
        includeHighlighting: true,
        generateIndex: true,
      })
    ).rejects.toThrow(/Validation failed/);
  });

  it('validation error does not leak internals', async () => {
    try {
      await handlers.get(ShareChannels.CREATE_LINK)!(evt(), { wrong: 'shape' });
      expect.fail('Should have thrown');
    } catch (error) {
      assertNoInternalLeaks(error instanceof Error ? error.message : String(error));
    }
  });

  it('accepts valid create-link request', async () => {
    const result = await handlers.get(ShareChannels.CREATE_LINK)!(evt(), {
      docId: 'doc1',
      accessMode: 'read-only',
      expiresInMs: null,
    });
    expect(result).toMatchObject({ success: true });
  });
});

// ============================================================================
// History Handler Validation
// ============================================================================
describe('History IPC handler validation', () => {
  let handlers: Map<string, HandlerFn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = captureHandlers();
    const svc = {
      getHistory: vi.fn().mockResolvedValue({ entries: [] }),
      getVersion: vi.fn().mockResolvedValue({
        content: 'hello',
        entry: { id: 'v1', timestamp: 1000, source: 'manual' },
      }),
      restoreVersion: vi.fn().mockResolvedValue({ ok: true, content: 'restored' }),
      createSnapshot: vi.fn().mockResolvedValue({
        ok: true,
        entry: { id: 's1', timestamp: 1000, source: 'manual' },
      }),
    } as unknown as VersionHistoryService;
    registerHistoryHandlers(mockIpcMain as unknown as IpcMain, svc, mockWindow());
  });

  it('registers all history channels', () => {
    expect(handlers.has(HistoryChannels.GET_HISTORY)).toBe(true);
    expect(handlers.has(HistoryChannels.GET_VERSION)).toBe(true);
    expect(handlers.has(HistoryChannels.RESTORE_VERSION)).toBe(true);
    expect(handlers.has(HistoryChannels.CREATE_SNAPSHOT)).toBe(true);
  });

  it.each([
    ['missing filePath', HistoryChannels.GET_HISTORY, {}],
    ['empty filePath', HistoryChannels.GET_HISTORY, { filePath: '' }],
    ['null payload', HistoryChannels.GET_HISTORY, null],
    ['numeric filePath', HistoryChannels.GET_HISTORY, { filePath: 42 }],
    ['missing id', HistoryChannels.GET_VERSION, { filePath: '/t.md' }],
    ['missing filePath on restore', HistoryChannels.RESTORE_VERSION, { id: 'v1' }],
    ['empty filePath on snapshot', HistoryChannels.CREATE_SNAPSHOT, { filePath: '' }],
  ])('rejects %s', async (_label, channel, payload) => {
    await expect(handlers.get(channel)!(evt(), payload)).rejects.toThrow(/Validation failed/);
  });

  it('validation error does not leak internals', async () => {
    try {
      await handlers.get(HistoryChannels.RESTORE_VERSION)!(evt(), { garbage: true });
      expect.fail('Should have thrown');
    } catch (error) {
      assertNoInternalLeaks(error instanceof Error ? error.message : String(error));
    }
  });

  it('accepts valid get-history request', async () => {
    const result = await handlers.get(HistoryChannels.GET_HISTORY)!(evt(), {
      filePath: '/test.md',
    });
    expect(result).toMatchObject({ entries: [] });
  });
});

// ============================================================================
// Notification Handler Validation
// ============================================================================
describe('Notification IPC handler validation', () => {
  let handlers: Map<string, HandlerFn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = captureHandlers();
    const svc = {
      show: vi.fn().mockResolvedValue({ id: 'n1', clicked: false }),
      isSupported: vi.fn(() => true),
      requestPermission: vi.fn(() => true),
    } as unknown as NotificationService;
    registerNotificationHandlers(mockIpcMain as unknown as IpcMain, svc, mockWindow());
  });

  it('registers all notification channels', () => {
    expect(handlers.has(NotificationChannels.SHOW)).toBe(true);
    expect(handlers.has(NotificationChannels.CHECK_PERMISSION)).toBe(true);
    expect(handlers.has(NotificationChannels.REQUEST_PERMISSION)).toBe(true);
  });

  it.each([
    ['missing title', { body: 'hello' }],
    ['empty title', { title: '', body: 'hello' }],
    ['missing body', { title: 'Test' }],
    ['invalid urgency', { title: 'T', body: 'b', urgency: 'extreme' }],
    ['malformed actions', { title: 'T', body: 'b', actions: [{ id: '', label: '' }] }],
    ['numeric title', { title: 123, body: 'hello' }],
  ])('rejects show with %s', async (_label, payload) => {
    await expect(handlers.get(NotificationChannels.SHOW)!(evt(), payload)).rejects.toThrow(
      /Validation failed/
    );
  });

  it('validation error does not leak internals', async () => {
    try {
      await handlers.get(NotificationChannels.SHOW)!(evt(), { garbage: true });
      expect.fail('Should have thrown');
    } catch (error) {
      assertNoInternalLeaks(error instanceof Error ? error.message : String(error));
    }
  });

  it('accepts valid show notification request', async () => {
    const result = await handlers.get(NotificationChannels.SHOW)!(evt(), {
      title: 'Hello',
      body: 'World',
      urgency: 'normal',
    });
    expect(result).toMatchObject({ id: 'n1', clicked: false });
  });

  it('accepts permission check/request without args', async () => {
    const check = await handlers.get(NotificationChannels.CHECK_PERMISSION)!(evt());
    expect(check).toMatchObject({ supported: true, granted: true });
    const req = await handlers.get(NotificationChannels.REQUEST_PERMISSION)!(evt());
    expect(req).toMatchObject({ granted: true });
  });
});

// ============================================================================
// Cross-cutting: Zod prevents raw passthrough
// ============================================================================
describe('Zod validation prevents raw passthrough', () => {
  let handlers: Map<string, HandlerFn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = captureHandlers();
    const server = {
      isRunning: vi.fn(() => true),
      getPort: vi.fn(() => 9876),
      getRoom: vi.fn(() => null),
      start: vi.fn().mockResolvedValue(9876),
    } as unknown as CollaborationServer;
    registerCollabHandlers(mockIpcMain as unknown as IpcMain, server, mockWindow());
  });

  it('strips extra fields from validated request', async () => {
    const result = await handlers.get(CollabChannels.JOIN)!(evt(), {
      docId: 'doc1',
      username: 'alice',
      extraField: 'stripped',
    });
    expect(result).toMatchObject({ success: true });
  });

  it('prototype pollution attempt does not affect host', async () => {
    const result = await handlers.get(CollabChannels.JOIN)!(evt(), {
      docId: 'doc1',
      username: 'alice',
      constructor: { prototype: { isAdmin: true } },
    });
    expect(result).toMatchObject({ success: true });
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });
});
