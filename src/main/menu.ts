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

import { IPC_EVENTS } from '@shared/lib/ipc';
import { RecentFilesService, type RecentFileEntry } from './services/recent-files';
import { readFileWithoutFollowingLinks, createFileHandle } from './services/file-service';
import { grantWriteCapability } from './ipc/document-capability';
import { openableDocumentPath } from './ipc/open-document-path';
import type { FileHandle as SchemaFileHandle } from '@shared/contracts/file-schemas';

/** Singleton instance of RecentFilesService */
let recentFilesService: RecentFilesService | null = null;

/** Reference to the main window for menu actions */
let mainWindow: BrowserWindow | null = null;

/**
 * SEC-1: URL allowlist for external links.
 * Only URLs in this list are allowed to be opened via shell.openExternal.
 */
const ALLOWED_EXTERNAL_URLS = [
  'https://mdxjs.com/',
  'https://mdxjs.com/docs/',
  'https://github.com/mdxpad/mdxpad/issues',
] as const;

/**
 * Gets or creates the RecentFilesService singleton.
 * @returns The RecentFilesService instance
 */
function getRecentFilesService(): RecentFilesService {
  recentFilesService ??= new RecentFilesService();
  return recentFilesService;
}

/**
 * SEC-1: Safely opens an external URL after validating against allowlist.
 * Only URLs in ALLOWED_EXTERNAL_URLS are permitted.
 *
 * @param url - The URL to open
 */
function safeOpenExternal(url: string): void {
  if (!ALLOWED_EXTERNAL_URLS.includes(url as (typeof ALLOWED_EXTERNAL_URLS)[number])) {
    console.error(`[Menu] Blocked attempt to open disallowed URL: ${url}`);
    return;
  }
  void shell.openExternal(url);
}

async function showRecentOpenError(
  window: BrowserWindow,
  filePath: string,
  code: string
): Promise<void> {
  if (code === 'NOT_FOUND') {
    await dialog.showMessageBox(window, {
      type: 'error',
      title: 'File Not Found',
      message: `The file "${path.basename(filePath)}" could not be found.`,
      detail: `Path: ${filePath}\n\nThe file may have been moved or deleted. It will be removed from the recent files list.`,
      buttons: ['OK'],
    });
    getRecentFilesService().removeRecent(filePath);
    refreshApplicationMenu();
    return;
  }

  const detail =
    code === 'PERMISSION_DENIED'
      ? 'Permission denied when reading the file.'
      : `An error occurred: ${code}`;
  await dialog.showMessageBox(window, {
    type: 'error',
    title: 'Error Opening File',
    message: `Could not open "${path.basename(filePath)}"`,
    detail,
    buttons: ['OK'],
  });
}

/**
 * Opens a file from a recent file entry.
 * A link opens the real file. A missing file is removed from the recent list.
 */
async function openRecentFile(entry: RecentFileEntry, window: BrowserWindow): Promise<void> {
  const opened = await openableDocumentPath(entry.path);
  if (!opened.ok) {
    await showRecentOpenError(window, entry.path, opened.error.code);
    return;
  }

  const readResult = await readFileWithoutFollowingLinks(opened.value);
  if (!readResult.ok) {
    await showRecentOpenError(window, opened.value, readResult.error.code);
    return;
  }

  if (opened.value !== entry.path) {
    getRecentFilesService().removeRecent(entry.path);
  }
  grantWriteCapability(opened.value);
  const handle = createFileHandle(opened.value);
  getRecentFilesService().addRecent(opened.value);
  refreshApplicationMenu();
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
        void openRecentFile(entry, mainWindow).catch((error: unknown) => {
          console.error('[Menu] Failed to open recent file:', error);
        });
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
function closeWindowMenuItem(window: BrowserWindow): MenuItemConstructorOptions {
  return {
    label: 'Close Window',
    accelerator: 'CmdOrCtrl+Shift+W',
    click: () => {
      window.close();
    },
  };
}

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
      {
        label: 'Export...',
        accelerator: 'CmdOrCtrl+Shift+E',
        click: () => window.webContents.send('mdxpad:menu:export-file'),
      },
      { type: 'separator' },
      isMac ? closeWindowMenuItem(window) : { role: 'quit' },
    ],
  };
}

/**
 * Builds the Edit menu with standard editing operations.
 * @param _window - The main BrowserWindow for IPC communication
 * @returns The Edit menu configuration
 */
function buildEditMenu(_window: BrowserWindow): MenuItemConstructorOptions {
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
              submenu: [{ role: 'startSpeaking' as const }, { role: 'stopSpeaking' as const }],
            },
          ]
        : [
            { role: 'delete' as const },
            { type: 'separator' as const },
            { role: 'selectAll' as const },
          ]),
    ],
  };
}

/**
 * Builds tab shortcut menu items for switching between tabs.
 * @param window - The main BrowserWindow for IPC communication
 * @returns Array of tab-related menu items
 */
function buildTabMenuItems(window: BrowserWindow): MenuItemConstructorOptions[] {
  const tabItems: MenuItemConstructorOptions[] = [];

  // Cmd+1 through Cmd+9: Switch to tab N
  for (let i = 1; i <= 9; i++) {
    tabItems.push({
      label: `Tab ${i}`,
      accelerator: `CmdOrCtrl+${i}`,
      click: () => window.webContents.send(IPC_EVENTS.menuSwitchTab, i),
      visible: false,
    });
  }

  tabItems.push(
    {
      label: 'Close Tab',
      accelerator: 'CmdOrCtrl+W',
      click: () => window.webContents.send(IPC_EVENTS.menuCloseTab),
    },
    {
      label: 'Reopen Closed Tab',
      accelerator: 'CmdOrCtrl+Shift+T',
      click: () => window.webContents.send(IPC_EVENTS.menuReopenTab),
    },
    {
      label: 'Next Tab',
      accelerator: 'CmdOrCtrl+Shift+]',
      click: () => window.webContents.send(IPC_EVENTS.menuNextTab),
    },
    {
      label: 'Previous Tab',
      accelerator: 'CmdOrCtrl+Shift+[',
      click: () => window.webContents.send(IPC_EVENTS.menuPreviousTab),
    }
  );

  return tabItems;
}

/**
 * Builds the View menu with reload, devtools, command palette, and zoom options.
 * @param window - The main BrowserWindow for IPC communication
 * @returns The View menu configuration
 */
function buildViewMenu(window: BrowserWindow): MenuItemConstructorOptions {
  return {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      {
        label: 'Command Palette...',
        accelerator: 'CmdOrCtrl+Shift+P',
        click: () => window.webContents.send('mdxpad:menu:command-palette'),
      },
      { type: 'separator' },
      ...buildTabMenuItems(window),
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
function buildWindowMenu(window: BrowserWindow): MenuItemConstructorOptions {
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
        : [closeWindowMenuItem(window)]),
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
        click: () => safeOpenExternal('https://mdxjs.com/'),
      },
      {
        label: 'Documentation',
        click: () => safeOpenExternal('https://mdxjs.com/docs/'),
      },
      { type: 'separator' },
      {
        label: 'Report Issue',
        click: () => safeOpenExternal('https://github.com/mdxpad/mdxpad/issues'),
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
    buildViewMenu(window),
    buildWindowMenu(window),
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
