/**
 * BrowserWindow factory with security-first configuration.
 * All security settings are per constitution §3.2 and MUST NOT be modified.
 */

import {
  BrowserWindow,
  dialog,
  ipcMain,
  type BrowserWindowConstructorOptions,
  type IpcMainEvent,
} from 'electron';
import { realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IPC_CHANNELS, IPC_EVENTS } from '@shared/lib/ipc';
import { installSessionCsp } from './session-csp';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Timeout for dirty state query in milliseconds */
const DIRTY_CHECK_TIMEOUT_MS = 2000;

/** Timeout to verify save completion before allowing close */
const SAVE_BEFORE_CLOSE_TIMEOUT_MS = 15_000;

/** Polling interval while waiting for save completion */
const SAVE_VERIFICATION_POLL_MS = 100;

/** Channel for renderer to respond with dirty state */
const DIRTY_CHECK_RESPONSE_CHANNEL = IPC_CHANNELS.editor.isDirtyResponse;

/**
 * IPC channel for querying dirty state from renderer.
 * Response format: { isDirty: boolean, content?: string }
 *
 * NOTE: Renderer-side implementation deferred to renderer integration phase.
 * For now, dirty check is stubbed to always return false (clean state).
 */
export const DIRTY_CHECK_CHANNEL = IPC_CHANNELS.editor.isDirty;

/**
 * Response type for dirty state query.
 */
export interface DirtyStateResponse {
  isDirty: boolean;
  content?: string;
}

/**
 * Dialog button indices for unsaved changes dialog.
 */
const DIALOG_BUTTON = {
  SAVE: 0,
  DISCARD: 1,
  CANCEL: 2,
} as const;

/** Allowed localhost hosts for dev-server navigation */
const DEV_LOCALHOSTS = new Set(['localhost', '127.0.0.1']);

/** Real path of renderer/index.html, refreshed when a window is created. */
let appDocumentRealPath: string | null = null;

/**
 * Cache the real app document path. If realpath throws, every file: navigation is denied.
 */
function rememberAppDocumentPath(): void {
  try {
    appDocumentRealPath = realpathSync(join(__dirname, '../renderer/index.html'));
  } catch {
    appDocumentRealPath = null;
  }
}

/**
 * file: is allowed only for the real app document. A hash is allowed. A search is not.
 */
function isAppDocumentFile(targetUrl: URL): boolean {
  if (targetUrl.search.length > 0 || appDocumentRealPath === null) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(targetUrl)) === appDocumentRealPath;
  } catch {
    return false;
  }
}

/**
 * Main-frame navigation and window.open allowlist.
 * file: must realpath to the app document. http: must be the configured Vite origin.
 */
function isAllowedNavigationUrl(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol === 'file:') {
      return isAppDocumentFile(parsed);
    }

    const rendererUrl = process.env.ELECTRON_RENDERER_URL;
    if (rendererUrl === undefined || rendererUrl.length === 0 || parsed.protocol !== 'http:') {
      return false;
    }

    const allowed = new URL(rendererUrl);
    return (
      allowed.protocol === 'http:' &&
      DEV_LOCALHOSTS.has(parsed.hostname) &&
      parsed.hostname === allowed.hostname &&
      parsed.port === allowed.port
    );
  } catch {
    return false;
  }
}

/**
 * Registers navigation/window-open allowlists per Electron security guidance.
 */
function setupNavigationGuards(window: BrowserWindow): void {
  if (typeof window.webContents.setWindowOpenHandler === 'function') {
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (isAllowedNavigationUrl(url)) {
        return { action: 'allow' };
      }

      console.warn('[Window] Blocked window open to untrusted URL:', url);
      return { action: 'deny' };
    });
  }

  if (typeof window.webContents.on === 'function') {
    window.webContents.on('will-navigate', (event, url) => {
      if (isAllowedNavigationUrl(url)) {
        return;
      }

      event.preventDefault();
      console.warn('[Window] Blocked navigation to untrusted URL:', url);
    });
  }
}

/**
 * Create the main application window with secure defaults.
 *
 * Security settings (per constitution §3.2):
 * - contextIsolation: true - Isolates preload context from web page
 * - sandbox: true - Enables Chromium sandbox for renderer
 * - nodeIntegration: false - Prevents Node.js access in renderer
 * - webSecurity: true - Enforces same-origin policy
 */
export function createWindow(): BrowserWindow {
  rememberAppDocumentPath();

  const windowOptions: BrowserWindowConstructorOptions = {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    // macOS HIG: hiddenInset provides integrated titlebar with traffic lights
    // positioned at (15, 10) for visual balance with content
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 10 },
    show: false, // Show after ready-to-show to prevent flash
    webPreferences: {
      // SECURITY: These settings are REQUIRED per constitution §3.2
      // DO NOT MODIFY - violations will fail security verification
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      // Preload script path (CommonJS format for sandboxed preload compatibility)
      preload: join(__dirname, '../preload/index.js'),
    },
  };

  const mainWindow = new BrowserWindow(windowOptions);

  // Show window when ready to prevent white flash
  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window close with dirty state check
  setupCloseHandler(mainWindow);
  setupNavigationGuards(mainWindow);
  installSessionCsp(mainWindow, resolve(join(__dirname, '../renderer')));

  return mainWindow;
}

/**
 * Sets up the window close handler with dirty state checking.
 *
 * When the user attempts to close the window (via close button, Cmd+W, etc.):
 * 1. Queries renderer for dirty state via IPC
 * 2. If dirty: shows confirmation dialog with Save/Discard/Cancel
 * 3. Handles user response:
 *    - Save: calls file save handler, then closes window
 *    - Discard: closes window without saving
 *    - Cancel: prevents close, keeps window open
 *
 * @param window - The BrowserWindow to attach the close handler to
 */
function setupCloseHandler(window: BrowserWindow): void {
  // Track if we should allow the close (bypasses dirty check)
  let forceClose = false;

  window.on('close', (event) => {
    // If force close is set, allow immediate close
    if (forceClose) {
      return;
    }

    // Prevent default close behavior while we check dirty state
    event.preventDefault();

    // Handle the dirty check and close flow asynchronously
    void handleCloseWithDirtyCheck(window).then((shouldClose) => {
      if (shouldClose) {
        forceClose = true;
        window.close();
      }
      // If shouldClose is false, window stays open (user cancelled)
    });
  });
}

/**
 * Query the renderer for dirty state and wait for a response.
 */
function queryDirtyState(
  window: BrowserWindow,
  options?: {
    timeoutMs?: number;
    defaultIsDirty?: boolean;
  }
): Promise<DirtyStateResponse> {
  const timeoutMs = options?.timeoutMs ?? DIRTY_CHECK_TIMEOUT_MS;
  const defaultIsDirty = options?.defaultIsDirty ?? true;

  return new Promise((resolve) => {
    if (window.isDestroyed()) {
      resolve({ isDirty: defaultIsDirty });
      return;
    }

    let settled = false;
    const timeoutId = setTimeout(() => {
      console.warn('[Window] Dirty state query timed out');
      finish({ isDirty: defaultIsDirty });
    }, timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timeoutId);
      ipcMain.removeListener(DIRTY_CHECK_RESPONSE_CHANNEL, onResponse);
    };

    const finish = (response: DirtyStateResponse): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(response);
    };

    const onResponse = (event: IpcMainEvent, response: DirtyStateResponse): void => {
      if (event.sender !== window.webContents) {
        return;
      }
      finish(response);
    };

    ipcMain.on(DIRTY_CHECK_RESPONSE_CHANNEL, onResponse);

    try {
      window.webContents.send(DIRTY_CHECK_CHANNEL);
    } catch (error) {
      console.error('[Window] Failed to request dirty state:', error);
      finish({ isDirty: defaultIsDirty });
    }
  });
}

/**
 * Sleep helper used when waiting for renderer save completion.
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Trigger renderer save and verify that dirty state clears before closing.
 */
async function saveBeforeClose(window: BrowserWindow): Promise<boolean> {
  try {
    window.webContents.send(IPC_EVENTS.menuSaveFile);
  } catch (error) {
    console.error('[Window] Failed to trigger save before close:', error);
    return false;
  }

  const deadline = Date.now() + SAVE_BEFORE_CLOSE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const dirtyState = await queryDirtyState(window, { defaultIsDirty: true });
    if (!dirtyState.isDirty) {
      return true;
    }
    await wait(SAVE_VERIFICATION_POLL_MS);
  }

  console.warn('[Window] Save before close timed out, keeping window open');
  return false;
}

/**
 * Handles the window close flow with dirty state checking.
 *
 * @param window - The BrowserWindow being closed
 * @returns Promise<boolean> - true if window should close, false to cancel
 */
async function handleCloseWithDirtyCheck(window: BrowserWindow): Promise<boolean> {
  const dirtyState = await queryDirtyState(window, { defaultIsDirty: true });

  // If not dirty, allow close immediately
  if (!dirtyState.isDirty) {
    return true;
  }

  // Show confirmation dialog for unsaved changes
  const { response } = await dialog.showMessageBox(window, {
    type: 'question',
    buttons: ['Save', 'Discard', 'Cancel'],
    defaultId: DIALOG_BUTTON.SAVE,
    cancelId: DIALOG_BUTTON.CANCEL,
    title: 'Unsaved Changes',
    message: 'Do you want to save your changes?',
    detail: 'Your changes will be lost if you close without saving.',
  });

  switch (response) {
    case DIALOG_BUTTON.SAVE:
      return saveBeforeClose(window);

    case DIALOG_BUTTON.DISCARD:
      // Close without saving
      return true;

    case DIALOG_BUTTON.CANCEL:
      // User cancelled, keep window open
      return false;

    default:
      // Unexpected response, keep window open to be safe
      console.warn('[Window] Unexpected dialog response:', response);
      return false;
  }
}

/**
 * Load content into the window.
 * In development, loads from Vite dev server.
 * In production, loads from bundled files.
 */
export function loadContent(window: BrowserWindow): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    // Development: Load from Vite dev server
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    // Production: Load from bundled files
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}
