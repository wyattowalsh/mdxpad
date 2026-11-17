import type { BrowserWindow, OnHeadersReceivedListenerDetails, Session } from 'electron';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEV_LOCALHOSTS = new Set(['localhost', '127.0.0.1']);
const DEFAULT_RENDERER_DIR = join(dirname(fileURLToPath(import.meta.url)), '../renderer');

export interface SessionCspOptions {
  readonly rendererDir: string;
  readonly rendererUrl?: string;
}

function isPreviewDocument(url: URL): boolean {
  return (
    url.protocol === 'mdxpad-preview:' ||
    url.pathname.includes('/preview-frame/') ||
    url.pathname.endsWith('/preview-frame/index.html')
  );
}

function isCodeSandbox(url: URL): boolean {
  return url.pathname.endsWith('/code-sandbox.html');
}

function devPolicy(origin: string): string {
  const host = new URL(origin);
  const wsOrigin = `ws://${host.host}`;
  const httpOrigin = `http://${host.host}`;
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${origin} ${wsOrigin} ${httpOrigin}`,
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
  ].join('; ');
}

function sandboxPolicy(): string {
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline' 'unsafe-eval'",
    "style-src 'none'",
    "img-src 'none'",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

function productionPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "worker-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self' mdxpad-preview:",
    "object-src 'none'",
    "base-uri 'none'",
  ].join('; ');
}

function isTrustedRendererUrl(url: URL, options: SessionCspOptions): boolean {
  if (options.rendererUrl !== undefined && options.rendererUrl.length > 0) {
    try {
      const allowed = new URL(options.rendererUrl);
      if (
        url.protocol === 'http:' &&
        allowed.protocol === 'http:' &&
        url.hostname === allowed.hostname &&
        url.port === allowed.port &&
        DEV_LOCALHOSTS.has(url.hostname)
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }

  if (url.protocol !== 'file:') {
    return false;
  }
  try {
    const filePath = resolve(fileURLToPath(url));
    const root = resolve(options.rendererDir);
    return filePath === root || filePath.startsWith(`${root}${sep}`);
  } catch {
    return false;
  }
}

export function selectSessionCsp(requestUrl: string, options?: SessionCspOptions): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }

  if (isPreviewDocument(url)) {
    return null;
  }

  const resolved = options ?? defaultSessionCspOptions();
  if (isCodeSandbox(url) && isTrustedRendererUrl(url, resolved)) {
    return sandboxPolicy();
  }
  if (resolved.rendererUrl !== undefined && resolved.rendererUrl.length > 0) {
    try {
      const allowed = new URL(resolved.rendererUrl);
      if (
        url.protocol === 'http:' &&
        allowed.protocol === 'http:' &&
        url.hostname === allowed.hostname &&
        url.port === allowed.port &&
        DEV_LOCALHOSTS.has(url.hostname)
      ) {
        return devPolicy(allowed.origin);
      }
    } catch {
      // A malformed dev origin does not block the production file policy.
    }
  }

  if (url.protocol === 'file:') {
    try {
      const filePath = resolve(fileURLToPath(url));
      const root = resolve(resolved.rendererDir);
      if (filePath === root || filePath.startsWith(`${root}${sep}`)) {
        return productionPolicy();
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function withSessionCsp(
  headers: OnHeadersReceivedListenerDetails['responseHeaders'],
  policy: string | null
): Record<string, string | string[]> {
  const next: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (policy !== null && key.toLowerCase() === 'content-security-policy') {
      continue;
    }
    next[key] = value;
  }
  if (policy !== null) {
    next['Content-Security-Policy'] = [policy];
  }
  return next;
}

const liveWindows = new Set<BrowserWindow>();
let installedSession: Session | null = null;

function defaultSessionCspOptions(): SessionCspOptions {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl === undefined || rendererUrl.length === 0) {
    return { rendererDir: DEFAULT_RENDERER_DIR };
  }
  return { rendererDir: DEFAULT_RENDERER_DIR, rendererUrl };
}

function readSession(window: BrowserWindow): Session | null {
  const contents = window.webContents as { session?: Session };
  return contents.session ?? null;
}

function deliverSessionCsp(
  details: OnHeadersReceivedListenerDetails,
  callback: (response: { responseHeaders?: Record<string, string | string[]> }) => void,
  rendererDir: string
): void {
  try {
    const rendererUrl = process.env.ELECTRON_RENDERER_URL;
    const policy = selectSessionCsp(details.url, {
      rendererDir,
      ...(rendererUrl !== undefined && rendererUrl.length > 0 ? { rendererUrl } : {}),
    });
    callback({ responseHeaders: withSessionCsp(details.responseHeaders, policy) });
  } catch (error) {
    console.error('[Window] Failed to apply session CSP:', error);
    try {
      if (details.responseHeaders === undefined) {
        callback({});
        return;
      }
      callback({ responseHeaders: details.responseHeaders });
    } catch (callbackError) {
      console.error('[Window] Failed to continue response after CSP error:', callbackError);
    }
  }
}

function bindSessionCleanup(window: BrowserWindow, detach: () => void): void {
  const contents = window.webContents as {
    once?: (event: 'destroyed', listener: () => void) => void;
  };
  if (typeof contents.once === 'function') {
    contents.once('destroyed', detach);
    return;
  }
  if (typeof window.on === 'function') {
    window.on('closed', detach);
  }
}

function detachSession(window: BrowserWindow, session: Session): void {
  liveWindows.delete(window);
  if (liveWindows.size > 0 || installedSession !== session) {
    return;
  }

  installedSession = null;
  try {
    // Electron keeps a single listener; null unsubscribes it.
    session.webRequest.onHeadersReceived(null);
  } catch (error) {
    console.error('[Window] Failed to remove session CSP listener:', error);
  }
}

/**
 * Register one listener on the window session, not defaultSession.
 * Another createWindow on the same session does not stack a second listener.
 * The listener is removed when the last window is destroyed.
 */
export function installSessionCsp(window: BrowserWindow, rendererDir: string): void {
  const session = readSession(window);
  if (session === null) {
    return;
  }

  if (installedSession !== session) {
    installedSession = session;
    session.webRequest.onHeadersReceived((details, callback) => {
      deliverSessionCsp(details, callback, rendererDir);
    });
  }

  liveWindows.add(window);
  bindSessionCleanup(window, () => {
    detachSession(window, session);
  });
}
