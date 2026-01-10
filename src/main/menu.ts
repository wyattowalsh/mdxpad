/**
 * Application menu builder for mdxpad.
 *
 * Provides the main application menu with File, Edit, View, Window, and Help menus.
 * The File menu includes a dynamic "Recent Files" submenu populated from RecentFilesService.
 *
 * @module main/menu
 */

import {
  Menu,
  type BrowserWindow,
  type MenuItemConstructorOptions,
  app,
  dialog,
  shell,
} from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

import { RecentFilesService, type RecentFileEntry } from './services/recent-files';
import { readFile, createFileHandle } from './services/file-service';
import type { FileHandle as SchemaFileHandle } from '@shared/contracts/file-schemas';

/** Singleton instance of RecentFilesService */
let recentFilesService: RecentFilesService | null = null;

/** Reference to the main window for menu actions */
let mainWindow: BrowserWindow | null = null;

/**
 * Gets or creates the RecentFilesService singleton.
 * @returns The RecentFilesService instance
 */
function getRecentFilesService(): RecentFilesService {
  recentFilesService ??= new RecentFilesService();
  return recentFilesService;
}

/**
 * Checks if a file exists at the given path.
 * @param filePath - The absolute path to check
 * @returns true if file exists, false otherwise
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens a file from a recent file entry.
 * Handles missing files by showing an error dialog and removing from recent list.
 *
 * @param entry - The recent file entry to open
 * @param window - The BrowserWindow to send the file to
 */
async function openRecentFile(entry: RecentFileEntry, window: BrowserWindow): Promise<void> {
  const exists = await fileExists(entry.path);

  if (!exists) {
    // File no longer exists - show error and remove from recent
    await dialog.showMessageBox(window, {
      type: 'error',
      title: 'File Not Found',
      message: `The file "${path.basename(entry.path)}" could not be found.`,
      detail: `Path: ${entry.path}\n\nThe file may have been moved or deleted. It will be removed from the recent files list.`,
      buttons: ['OK'],
    });

    // Remove from recent files list
    getRecentFilesService().removeRecent(entry.path);

    // Refresh menu to reflect the change
    refreshApplicationMenu();
    return;
  }

  // Read the file content
  const readResult = await readFile(entry.path);

  if (!readResult.ok) {
    // Show error dialog for read failure
    const errorMessage =
      readResult.error.code === 'PERMISSION_DENIED'
        ? 'Permission denied when reading the file.'
        : `An error occurred: ${readResult.error.code}`;

    await dialog.showMessageBox(window, {
      type: 'error',
      title: 'Error Opening File',
      message: `Could not open "${path.basename(entry.path)}"`,
      detail: errorMessage,
      buttons: ['OK'],
    });
    return;
  }

  // Create file handle and update recent files
  const handle = createFileHandle(entry.path);
  getRecentFilesService().addRecent(entry.path);

  // Refresh menu to update recent files order
  refreshApplicationMenu();

  // Send file to renderer via IPC
  // The renderer needs to handle the 'mdxpad:menu:open-file' event
  window.webContents.send('mdxpad:menu:open-file', {
    handle: handle as unknown as SchemaFileHandle,
    content: readResult.value,
  });
}

/**
 * Builds the Recent Files submenu.
 * Returns menu items for each recent file, plus a separator and "Clear Recent" option.
 * Shows a disabled "No Recent Files" item when the list is empty.
 *
 * @returns Array of menu item constructor options for the Recent Files submenu
 */
function buildRecentFilesSubmenu(): MenuItemConstructorOptions[] {
  const entries = getRecentFilesService().getRecent();

  // Empty state
  if (entries.length === 0) {
    return [
      {
        label: 'No Recent Files',
        enabled: false,
      },
    ];
  }

  // Build menu items for each recent file
  const fileItems: MenuItemConstructorOptions[] = entries.map((entry) => ({
    label: path.basename(entry.path),
    toolTip: entry.path,
    click: () => {
      if (mainWindow) {
        void openRecentFile(entry, mainWindow);
      }
    },
  }));

  // Add separator and "Clear Recent" option
  return [
    ...fileItems,
    { type: 'separator' },
    {
      label: 'Clear Recent',
      click: () => {
        getRecentFilesService().clear();
        refreshApplicationMenu();
      },
    },
  ];
}

/**
 * Builds the macOS app menu (only shown on macOS).
 * @returns The app menu configuration or null for non-macOS platforms
 */
function buildAppMenu(): MenuItemConstructorOptions | null {
  if (process.platform !== 'darwin') {
    return null;
  }
  return {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  };
}

/**
 * Builds the File menu with New, Open, Recent Files, Save, and Save As options.
 * @param window - The main BrowserWindow for IPC communication
 * @returns The File menu configuration
 */
function buildFileMenu(window: BrowserWindow): MenuItemConstructorOptions {
  const isMac = process.platform === 'darwin';
  return {
    label: 'File',
    submenu: [
      {
        label: 'New',
        accelerator: 'CmdOrCtrl+N',
        click: () => window.webContents.send('mdxpad:menu:new-file'),
      },
      {
        label: 'Open...',
        accelerator: 'CmdOrCtrl+O',
        click: () => window.webContents.send('mdxpad:menu:open-file-dialog'),
      },
      { type: 'separator' },
      { label: 'Recent Files', submenu: buildRecentFilesSubmenu() },
      { type: 'separator' },
      {
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        click: () => window.webContents.send('mdxpad:menu:save-file'),
      },
      {
        label: 'Save As...',
        accelerator: 'CmdOrCtrl+Shift+S',
        click: () => window.webContents.send('mdxpad:menu:save-file-as'),
      },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' },
    ],
  };
}

/**
 * Builds the Edit menu with standard editing operations.
 * @param window - The main BrowserWindow for IPC communication
 * @returns The Edit menu configuration
 */
function buildEditMenu(window: BrowserWindow): MenuItemConstructorOptions {
  const isMac = process.platform === 'darwin';
  return {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      ...(isMac
        ? [
            { role: 'pasteAndMatchStyle' as const },
            { role: 'delete' as const },
            { role: 'selectAll' as const },
            { type: 'separator' as const },
            {
              label: 'Speech',
              submenu: [
                { role: 'startSpeaking' as const },
                { role: 'stopSpeaking' as const },
              ],
            },
          ]
        : [
            { role: 'delete' as const },
            { type: 'separator' as const },
            { role: 'selectAll' as const },
          ]),
      { type: 'separator' },
      {
        label: 'Command Palette...',
        accelerator: 'CmdOrCtrl+Shift+P',
        click: () => window.webContents.send('mdxpad:menu:command-palette'),
      },
    ],
  };
}

/**
 * Builds the View menu with reload, devtools, and zoom options.
 * @returns The View menu configuration
 */
function buildViewMenu(): MenuItemConstructorOptions {
  return {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  };
}

/**
 * Builds the Window menu with minimize, zoom, and window management options.
 * @returns The Window menu configuration
 */
function buildWindowMenu(): MenuItemConstructorOptions {
  const isMac = process.platform === 'darwin';
  return {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      ...(isMac
        ? [
            { type: 'separator' as const },
            { role: 'front' as const },
            { type: 'separator' as const },
            { role: 'window' as const },
          ]
        : [{ role: 'close' as const }]),
    ],
  };
}

/**
 * Builds the Help menu with links to documentation and issue reporting.
 * @returns The Help menu configuration
 */
function buildHelpMenu(): MenuItemConstructorOptions {
  return {
    label: 'Help',
    submenu: [
      {
        label: 'Learn More',
        click: () => void shell.openExternal('https://mdxjs.com/'),
      },
      {
        label: 'Documentation',
        click: () => void shell.openExternal('https://mdxjs.com/docs/'),
      },
      { type: 'separator' },
      {
        label: 'Report Issue',
        click: () => void shell.openExternal('https://github.com/mdxpad/mdxpad/issues'),
      },
    ],
  };
}

/**
 * Builds the complete application menu template.
 *
 * @param window - The main BrowserWindow
 * @returns Array of menu item constructor options
 */
function buildMenuTemplate(window: BrowserWindow): MenuItemConstructorOptions[] {
  const template: MenuItemConstructorOptions[] = [];

  const appMenu = buildAppMenu();
  if (appMenu) {
    template.push(appMenu);
  }

  template.push(
    buildFileMenu(window),
    buildEditMenu(window),
    buildViewMenu(),
    buildWindowMenu(),
    buildHelpMenu()
  );

  return template;
}

/**
 * Builds and sets the application menu.
 *
 * @param window - The main BrowserWindow
 */
export function buildApplicationMenu(window: BrowserWindow): void {
  mainWindow = window;
  const template = buildMenuTemplate(window);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Refreshes the application menu.
 * Call this when recent files change to update the Recent Files submenu.
 */
export function refreshApplicationMenu(): void {
  if (mainWindow) {
    buildApplicationMenu(mainWindow);
  }
}

/**
 * Adds a file to the recent files list and refreshes the menu.
 * Call this from file handlers when a file is opened or saved.
 *
 * @param filePath - The absolute path of the file to add
 */
export function addToRecentFiles(filePath: string): void {
  getRecentFilesService().addRecent(filePath);
  refreshApplicationMenu();
}

/**
 * Removes a file from the recent files list and refreshes the menu.
 * Call this when a file is known to be missing or deleted.
 *
 * @param filePath - The absolute path of the file to remove
 */
export function removeFromRecentFiles(filePath: string): void {
  getRecentFilesService().removeRecent(filePath);
  refreshApplicationMenu();
}

/**
 * Clears all recent files and refreshes the menu.
 */
export function clearRecentFiles(): void {
  getRecentFilesService().clear();
  refreshApplicationMenu();
}

/**
 * Gets the current list of recent files.
 *
 * @returns Array of recent file entries
 */
export function getRecentFiles(): RecentFileEntry[] {
  return getRecentFilesService().getRecent();
}

/**
 * Initializes the application menu.
 * Should be called once during app initialization after window creation.
 *
 * @param window - The main BrowserWindow
 */
export function initializeApplicationMenu(window: BrowserWindow): void {
  buildApplicationMenu(window);
}
