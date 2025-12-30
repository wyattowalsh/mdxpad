/**
 * BrowserWindow factory with security-first configuration.
 * All security settings are per constitution §3.2 and MUST NOT be modified.
 */

import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';
import { join } from 'node:path';

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

  return mainWindow;
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
