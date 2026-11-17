import type { BrowserWindow, OnHeadersReceivedListenerDetails, Session } from 'electron';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEV_LOCALHOSTS = new Set(['localhost', '127.0.0.1']);

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

export function selectSessionCsp(requestUrl: string, options: SessionCspOptions): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }

  if (isPreviewDocument(url)) {
    return null;
  }

  if (options.rendererUrl) {
    try {
      const allowed = new URL(options.rendererUrl);
      if (
        url.protocol === allowed.protocol &&
        url.hostname === allowed.hostname &&
        url.port === allowed.port &&
        DEV_LOCALHOSTS.has(url.hostname)
      ) {
        return devPolicy(allowed.origin);
      }
    } catch {
      return null;
    }
  }

  if (url.protocol === 'file:') {
    try {
      const filePath = resolve(fileURLToPath(url));
      const root = resolve(options.rendererDir);
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

let installedSession: Session | null = null;

function readSession(window: BrowserWindow): Session | null {
  const contents = window.webContents as { session?: Session };
  return contents.session ?? null;
}

export function installSessionCsp(window: BrowserWindow, rendererDir: string): void {
  const session = readSession(window);
  if (session === null || installedSession === session) {
    return;
  }

  installedSession = session;
  session.webRequest.onHeadersReceived((details, callback) => {
    try {
      const policy = selectSessionCsp(details.url, {
        rendererDir,
        ...(process.env.ELECTRON_RENDERER_URL
          ? { rendererUrl: process.env.ELECTRON_RENDERER_URL }
          : {}),
      });
      const responseHeaders = withSessionCsp(details.responseHeaders, policy);
      callback({ responseHeaders });
    } catch {
      if (details.responseHeaders === undefined) {
        callback({});
        return;
      }
      callback({ responseHeaders: details.responseHeaders });
    }
  });

  if (typeof window.on === 'function') {
    window.on('closed', () => {
      if (installedSession !== session) {
        return;
      }
      session.webRequest.onHeadersReceived(null);
      installedSession = null;
    });
  }
}
