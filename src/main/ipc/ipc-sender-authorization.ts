/**
 * IPC sender/frame authorization helpers for privileged handlers.
 *
 * @module ipc-sender-authorization
 */

import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';

/**
 * Error thrown when an IPC invoke call comes from an unauthorized sender/frame.
 */
export class IpcSenderAuthorizationError extends Error {
  constructor(channel: string) {
    super(`Unauthorized IPC sender for channel: ${channel}`);
    this.name = 'IpcSenderAuthorizationError';
  }
}

export type AuthorizedIpcMain = Pick<IpcMain, 'handle'>;

export type AuthorizedIpcInvokeHandler<TRequest = unknown, TResult = unknown> = (
  event: IpcMainInvokeEvent,
  request: TRequest
) => TResult | Promise<TResult>;

/**
 * Safely extracts an origin from a URL string.
 * Returns null when URL is missing/invalid.
 */
function extractOrigin(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Reads BrowserWindow webContents URL safely for mocked test environments.
 */
function getWindowUrl(window: BrowserWindow): string | undefined {
  const webContentsWithMaybeGetUrl = window.webContents as {
    getURL?: () => string;
  };
  const getUrl = webContentsWithMaybeGetUrl.getURL;
  return typeof getUrl === 'function' ? getUrl.call(window.webContents) : undefined;
}

/**
 * Ensures an IPC invoke event came from the expected BrowserWindow main frame.
 */
export function assertAuthorizedIpcSender(
  event: IpcMainInvokeEvent,
  window: BrowserWindow,
  channel: string
): void {
  const expectedSenderId = window.webContents.id;
  const expectedMainFrameId = window.webContents.mainFrame.routingId;
  const senderId = event.sender.id;
  const senderFrameId = event.senderFrame?.routingId;
  const senderOrigin = extractOrigin(event.senderFrame?.url);
  const windowOrigin = extractOrigin(getWindowUrl(window));

  const isAuthorizedSender = senderId === expectedSenderId;
  const isAuthorizedMainFrame = senderFrameId === expectedMainFrameId;
  // Defense-in-depth origin check (sender/frame ID checks above are primary).
  // If the sender provides an origin, it must match the window origin.
  // If senderFrame.url is absent, skip — rely on sender ID + frame ID.
  const isAuthorizedOrigin = senderOrigin === null || senderOrigin === windowOrigin;

  if (!isAuthorizedSender || !isAuthorizedMainFrame || !isAuthorizedOrigin) {
    throw new IpcSenderAuthorizationError(channel);
  }
}

/**
 * Registers an invoke handler with sender/frame authorization applied centrally.
 */
export function registerAuthorizedIpcHandler<TRequest = unknown, TResult = unknown>(
  ipcMainInstance: AuthorizedIpcMain,
  window: BrowserWindow,
  channel: string,
  handler: AuthorizedIpcInvokeHandler<TRequest, TResult>
): void {
  ipcMainInstance.handle(channel, (event, request) => {
    assertAuthorizedIpcSender(event, window, channel);
    return handler(event, request as TRequest);
  });
}
