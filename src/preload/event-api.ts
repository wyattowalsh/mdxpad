/**
 * Event Subscription API Module
 *
 * Provides event subscription bridge functions for the renderer process.
 * Handles file change events, menu events, and settings change events.
 *
 * @security Uses IPC event pattern with type validation
 * @module src/preload/event-api
 */

import { ipcRenderer } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS, IPC_EVENTS } from '@shared/lib/ipc';
import { AutosaveSettingsSchema } from '@shared/contracts/autosave-schemas';
import type { AutosaveSettings } from '@shared/contracts/autosave-schemas';
import { FileChangeEventSchema, FileHandleSchema, type FileChangeEvent } from '@shared/contracts/file-schemas';

// ============================================================================
// Event Data Schemas
// ============================================================================

/** Zod schema for MenuFileOpenEvent */
const MenuFileOpenEventSchema = z.object({
  handle: FileHandleSchema,
  content: z.string(),
});

/** Menu file open event data */
export type MenuFileOpenEvent = z.infer<typeof MenuFileOpenEventSchema>;

// ============================================================================
// Event Listener Registries
// ============================================================================

/** File change event listeners registry */
const fileChangeListeners = new Set<(event: FileChangeEvent) => void>();

/** Menu event listeners registries */
const menuCommandPaletteListeners = new Set<() => void>();
const menuNewFileListeners = new Set<() => void>();
const menuOpenFileDialogListeners = new Set<() => void>();
const menuOpenFileListeners = new Set<(event: MenuFileOpenEvent) => void>();
const menuSaveFileListeners = new Set<() => void>();
const menuSaveFileAsListeners = new Set<() => void>();

/** Autosave settings change event listeners registry */
const autosaveSettingsChangeListeners = new Set<(settings: AutosaveSettings) => void>();

// ============================================================================
// Event Listeners Setup (One-Time Initialization)
// ============================================================================

// File change listener
ipcRenderer.on(IPC_CHANNELS.file.change, (_event, data: unknown) => {
  const parsed = FileChangeEventSchema.safeParse(data);
  if (!parsed.success) {
    console.warn('[Preload] Invalid file change event data:', parsed.error.message);
    return;
  }
  for (const listener of fileChangeListeners) {
    listener(parsed.data);
  }
});

// Menu event listeners
ipcRenderer.on(IPC_EVENTS.menuCommandPalette, () => {
  for (const listener of menuCommandPaletteListeners) {
    listener();
  }
});

ipcRenderer.on(IPC_EVENTS.menuNewFile, () => {
  for (const listener of menuNewFileListeners) {
    listener();
  }
});

ipcRenderer.on(IPC_EVENTS.menuOpenFileDialog, () => {
  for (const listener of menuOpenFileDialogListeners) {
    listener();
  }
});

ipcRenderer.on(IPC_EVENTS.menuOpenFile, (_event, data: unknown) => {
  const parsed = MenuFileOpenEventSchema.safeParse(data);
  if (!parsed.success) {
    console.warn('[Preload] Invalid menu open file event data:', parsed.error.message);
    return;
  }
  for (const listener of menuOpenFileListeners) {
    listener(parsed.data);
  }
});

ipcRenderer.on(IPC_EVENTS.menuSaveFile, () => {
  for (const listener of menuSaveFileListeners) {
    listener();
  }
});

ipcRenderer.on(IPC_EVENTS.menuSaveFileAs, () => {
  for (const listener of menuSaveFileAsListeners) {
    listener();
  }
});

// Autosave settings change listener
ipcRenderer.on('mdxpad:autosave:settings:changed', (_event, data: unknown) => {
  const parsed = AutosaveSettingsSchema.safeParse(data);
  if (parsed.success) {
    for (const listener of autosaveSettingsChangeListeners) {
      listener(parsed.data);
    }
  }
});

// ============================================================================
// Event Subscription API
// ============================================================================

export const eventSubscriptions = {
  /** Subscribe to file change events */
  onFileChange: (callback: (event: FileChangeEvent) => void) => {
    fileChangeListeners.add(callback);
    return () => {
      fileChangeListeners.delete(callback);
    };
  },

  /** Subscribe to command palette menu event */
  onMenuCommandPalette: (callback: () => void) => {
    menuCommandPaletteListeners.add(callback);
    return () => {
      menuCommandPaletteListeners.delete(callback);
    };
  },

  /** Subscribe to new file menu event */
  onMenuNewFile: (callback: () => void) => {
    menuNewFileListeners.add(callback);
    return () => {
      menuNewFileListeners.delete(callback);
    };
  },

  /** Subscribe to open file dialog menu event */
  onMenuOpenFileDialog: (callback: () => void) => {
    menuOpenFileDialogListeners.add(callback);
    return () => {
      menuOpenFileDialogListeners.delete(callback);
    };
  },

  /** Subscribe to open file menu event */
  onMenuOpenFile: (callback: (event: MenuFileOpenEvent) => void) => {
    menuOpenFileListeners.add(callback);
    return () => {
      menuOpenFileListeners.delete(callback);
    };
  },

  /** Subscribe to save file menu event */
  onMenuSaveFile: (callback: () => void) => {
    menuSaveFileListeners.add(callback);
    return () => {
      menuSaveFileListeners.delete(callback);
    };
  },

  /** Subscribe to save file as menu event */
  onMenuSaveFileAs: (callback: () => void) => {
    menuSaveFileAsListeners.add(callback);
    return () => {
      menuSaveFileAsListeners.delete(callback);
    };
  },

  /** Subscribe to autosave settings change events */
  onAutosaveSettingsChange: (callback: (settings: AutosaveSettings) => void) => {
    autosaveSettingsChangeListeners.add(callback);
    return () => {
      autosaveSettingsChangeListeners.delete(callback);
    };
  },
};
