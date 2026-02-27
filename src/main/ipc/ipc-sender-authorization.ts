/**
 * IPC sender/frame authorization helpers for privileged handlers.
 *
 * @module ipc-sender-authorization
 */

import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

/**
 * Error thrown when an IPC invoke call comes from an unauthorized sender/frame.
 */
export class IpcSenderAuthorizationError extends Error {
  constructor(channel: string) {
    super(`Unauthorized IPC sender for channel: ${channel}`);
    this.name = 'IpcSenderAuthorizationError';
  }
}

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
