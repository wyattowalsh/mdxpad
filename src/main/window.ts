/**
 * BrowserWindow factory with security-first configuration.
 * All security settings are per constitution §3.2 and MUST NOT be modified.
 */

import { BrowserWindow, dialog, type BrowserWindowConstructorOptions } from 'electron';
import { join } from 'node:path';

/**
 * IPC channel for querying dirty state from renderer.
 * Response format: { isDirty: boolean, content?: string }
 *
 * NOTE: Renderer-side implementation deferred to renderer integration phase.
 * For now, dirty check is stubbed to always return false (clean state).
 */
export const DIRTY_CHECK_CHANNEL = 'mdxpad:editor:is-dirty';

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
 * Handles the window close flow with dirty state checking.
 *
 * @param window - The BrowserWindow being closed
 * @returns Promise<boolean> - true if window should close, false to cancel
 */
async function handleCloseWithDirtyCheck(window: BrowserWindow): Promise<boolean> {
  // TODO: Query renderer for dirty state via IPC
  // Once renderer integration is complete, this will use:
  //   const response = await window.webContents.invoke(DIRTY_CHECK_CHANNEL);
  //   const dirtyState: DirtyStateResponse = response;
  //
  // For now, stub to clean state (always allow close)
  const dirtyState: DirtyStateResponse = { isDirty: false };

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
      // TODO: Save file via file service, then close
      // Once file service integration is complete:
      //   const saveResult = await saveCurrentFile(dirtyState.content);
      //   return saveResult.ok;
      //
      // For now, just close (save logic added later)
      console.log('[Window] Save requested before close');
      return true;

    case DIALOG_BUTTON.DISCARD:
      // Close without saving
      console.log('[Window] Discard changes, closing');
      return true;

    case DIALOG_BUTTON.CANCEL:
      // User cancelled, keep window open
      console.log('[Window] Close cancelled by user');
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
