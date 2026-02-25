import { describe, expect, it } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

import {
  assertAuthorizedIpcSender,
  IpcSenderAuthorizationError,
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

  it('allows sender when origin metadata is unavailable', () => {
    const window = createWindow();
    const event = createEvent();

    expect(() => {
      assertAuthorizedIpcSender(event, window, 'test:channel');
    }).not.toThrow();
  });
});
