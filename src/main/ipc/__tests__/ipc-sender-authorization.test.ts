import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';

import {
  assertAuthorizedIpcSender,
  IpcSenderAuthorizationError,
  registerAuthorizedIpcHandler,
} from '../ipc-sender-authorization';

function createWindow(url = 'http://localhost:5173'): BrowserWindow {
  return {
    webContents: {
      id: 42,
      mainFrame: { routingId: 99 },
      getURL: () => url,
    },
  } as unknown as BrowserWindow;
}

function createEvent(options?: {
  senderId?: number;
  senderFrameRoutingId?: number;
  senderFrameUrl?: string;
}): IpcMainInvokeEvent {
  return {
    sender: {
      id: options?.senderId ?? 42,
      mainFrame: { routingId: 99 },
    },
    senderFrame: {
      routingId: options?.senderFrameRoutingId ?? 99,
      url: options?.senderFrameUrl,
    },
  } as unknown as IpcMainInvokeEvent;
}

describe('assertAuthorizedIpcSender', () => {
  it('rejects sender when sender ID mismatches', () => {
    const window = createWindow();
    const event = createEvent({ senderId: 1000 });

    expect(() => {
      assertAuthorizedIpcSender(event, window, 'test:channel');
    }).toThrow(IpcSenderAuthorizationError);
  });

  it('rejects sender when main frame routing ID mismatches', () => {
    const window = createWindow();
    const event = createEvent({ senderFrameRoutingId: 1000 });

    expect(() => {
      assertAuthorizedIpcSender(event, window, 'test:channel');
    }).toThrow(IpcSenderAuthorizationError);
  });

  it('allows authorized sender/frame/origin', () => {
    const window = createWindow();
    const event = createEvent({ senderFrameUrl: 'http://localhost:5173/app' });

    expect(() => {
      assertAuthorizedIpcSender(event, window, 'test:channel');
    }).not.toThrow();
  });

  it('rejects authorized sender/frame when origin mismatches', () => {
    const window = createWindow();
    const event = createEvent({ senderFrameUrl: 'https://example.com/app' });

    expect(() => {
      assertAuthorizedIpcSender(event, window, 'test:channel');
    }).toThrow(IpcSenderAuthorizationError);
  });

  it('allows sender when senderFrame.url is absent (relies on sender/frame ID)', () => {
    const window = createWindow();
    const event = createEvent(); // no senderFrameUrl → null origin, skips origin check

    expect(() => {
      assertAuthorizedIpcSender(event, window, 'test:channel');
    }).not.toThrow();
  });

  it('rejects sender when senderFrame.url has mismatched origin', () => {
    const window = createWindow();
    const event = createEvent({ senderFrameUrl: 'https://evil.com/exploit' });

    expect(() => {
      assertAuthorizedIpcSender(event, window, 'test:channel');
    }).toThrow(IpcSenderAuthorizationError);
  });
});

describe('registerAuthorizedIpcHandler', () => {
  it('registers handler and executes for authorized sender/frame', async () => {
    const handle = vi.fn();
    const ipcMain = { handle } as unknown as Pick<IpcMain, 'handle'>;
    const window = createWindow();
    const handler = vi.fn().mockResolvedValue({ ok: true });

    registerAuthorizedIpcHandler(ipcMain, window, 'test:channel', handler);

    const registeredHandler = handle.mock.calls[0]?.[1] as
      | ((event: IpcMainInvokeEvent, request: unknown) => Promise<unknown>)
      | undefined;

    expect(registeredHandler).toBeDefined();
    await expect(registeredHandler!(createEvent(), { value: 1 })).resolves.toEqual({ ok: true });
    expect(handler).toHaveBeenCalledWith(expect.any(Object), { value: 1 });
  });

  it('rejects unauthorized sender/frame consistently', () => {
    const handle = vi.fn();
    const ipcMain = { handle } as unknown as Pick<IpcMain, 'handle'>;
    const window = createWindow();

    registerAuthorizedIpcHandler(ipcMain, window, 'test:channel', () => ({ ok: true }));

    const registeredHandler = handle.mock.calls[0]?.[1] as
      | ((event: IpcMainInvokeEvent, request: unknown) => unknown)
      | undefined;

    expect(registeredHandler).toBeDefined();

    expect(() => registeredHandler!(createEvent({ senderId: 123 }), {})).toThrow(
      IpcSenderAuthorizationError
    );
    expect(() => registeredHandler!(createEvent({ senderFrameRoutingId: 123 }), {})).toThrow(
      IpcSenderAuthorizationError
    );
  });
});
