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

  const isAuthorizedSender = senderId === expectedSenderId;
  const isAuthorizedMainFrame = senderFrameId === expectedMainFrameId;

  if (!isAuthorizedSender || !isAuthorizedMainFrame) {
    throw new IpcSenderAuthorizationError(channel);
  }
}
