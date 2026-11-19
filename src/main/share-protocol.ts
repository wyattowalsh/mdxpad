/**
 * Deliver an `mdxpad://share/<token>` open to the renderer.
 * The operating system uses this scheme when a copied share link is opened.
 */

import { app, type BrowserWindow } from 'electron';

import { shareTokenFromUrl, shareUrlFromArgv } from '@shared/lib/share-url';
import { IPC_EVENTS } from '@shared/lib/ipc';

let pendingShareUrl: string | null = null;

function sendShareUrl(window: BrowserWindow, url: string): void {
  if (shareTokenFromUrl(url) === null || window.isDestroyed()) {
    return;
  }
  const deliver = (): void => {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_EVENTS.shareOpenUrl, url);
    }
  };
  if (window.webContents.isLoading()) {
    window.webContents.once('did-finish-load', deliver);
    return;
  }
  deliver();
}

/** Keep a share URL until a window can show it. */
export function rememberShareUrl(url: string): void {
  if (shareTokenFromUrl(url) !== null) {
    pendingShareUrl = url.trim();
  }
}

/** Send a share URL to the window, or keep it until the window exists. */
export function deliverShareUrl(window: BrowserWindow | null, url: string): void {
  if (shareTokenFromUrl(url) === null) {
    return;
  }
  if (window === null) {
    rememberShareUrl(url);
    return;
  }
  pendingShareUrl = null;
  sendShareUrl(window, url.trim());
}

/** Send a share URL that arrived before the window finished loading. */
export function flushPendingShareUrl(window: BrowserWindow): void {
  if (pendingShareUrl === null) {
    return;
  }
  const url = pendingShareUrl;
  pendingShareUrl = null;
  sendShareUrl(window, url);
}

/** Register the mdxpad scheme and accept share links from the operating system. */
export function installShareProtocol(
  currentWindow: () => BrowserWindow | null
): void {
  const launchUrl = shareUrlFromArgv(process.argv);
  if (launchUrl !== null) {
    rememberShareUrl(launchUrl);
  }
  try {
    if (process.defaultApp && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('mdxpad', process.execPath, [process.argv[1] ?? '']);
    } else {
      app.setAsDefaultProtocolClient('mdxpad');
    }
  } catch {
    // The scheme can still be handled when this process receives the URL.
  }
  app.on('open-url', (event, url) => {
    event.preventDefault();
    deliverShareUrl(currentWindow(), url);
  });
}
