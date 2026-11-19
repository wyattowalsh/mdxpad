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
import { shareTokenFromUrl } from '@shared/lib/share-url';
import { AutosaveSettingsSchema } from '@shared/contracts/autosave-schemas';
import type { AutosaveSettings } from '@shared/contracts/autosave-schemas';
import {
  FileChangeEventSchema,
  FileHandleSchema,
  type FileChangeEvent,
} from '@shared/contracts/file-schemas';

// ============================================================================
// Event Data Schemas
// ============================================================================

const RecoveryRestoreEntrySchema = z.object({
  displayName: z.string().min(1),
  content: z.string(),
  savedAt: z.number(),
});

export type RecoveryRestoreEntry = z.infer<typeof RecoveryRestoreEntrySchema>;

const RECOVERY_RESTORE_EVENT = 'mdxpad:recovery:restore';

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
const menuExportFileListeners = new Set<() => void>();
const menuCloseTabListeners = new Set<() => void>();
const menuReopenTabListeners = new Set<() => void>();
const menuNextTabListeners = new Set<() => void>();
const menuPreviousTabListeners = new Set<() => void>();
const menuSwitchTabListeners = new Set<(index: number) => void>();
const shareOpenListeners = new Set<(url: string) => void>();
const recoveryRestoreListeners = new Set<(entries: RecoveryRestoreEntry[]) => void>();

/** Autosave settings change event listeners registry */
const autosaveSettingsChangeListeners = new Set<(settings: AutosaveSettings) => void>();

const AUTOSAVE_SETTINGS_CHANGED_EVENT = 'mdxpad:autosave:settings:changed';

/** Editor dirty-state query listeners (used by main-process close flow) */
const editorDirtyCheckListeners = new Set<() => boolean>();

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

ipcRenderer.on(IPC_EVENTS.menuExportFile, () => {
  for (const listener of menuExportFileListeners) {
    listener();
  }
});

ipcRenderer.on(IPC_EVENTS.menuCloseTab, () => {
  for (const listener of menuCloseTabListeners) {
    listener();
  }
});

ipcRenderer.on(IPC_EVENTS.menuReopenTab, () => {
  for (const listener of menuReopenTabListeners) {
    listener();
  }
});

ipcRenderer.on(IPC_EVENTS.menuNextTab, () => {
  for (const listener of menuNextTabListeners) {
    listener();
  }
});

ipcRenderer.on(IPC_EVENTS.menuPreviousTab, () => {
  for (const listener of menuPreviousTabListeners) {
    listener();
  }
});

const menuSwitchTabIndexSchema = z.number().int().min(1).max(9);

ipcRenderer.on(RECOVERY_RESTORE_EVENT, (_event, data: unknown) => {
  const parsed = z.array(RecoveryRestoreEntrySchema).safeParse(data);
  if (!parsed.success) {
    console.warn('[Preload] Invalid recovery restore event:', parsed.error.message);
    return;
  }
  for (const listener of recoveryRestoreListeners) {
    listener(parsed.data);
  }
});

ipcRenderer.on(IPC_EVENTS.menuSwitchTab, (_event, data: unknown) => {
  const parsed = menuSwitchTabIndexSchema.safeParse(data);
  if (!parsed.success) {
    return;
  }
  for (const listener of menuSwitchTabListeners) {
    listener(parsed.data);
  }
});

ipcRenderer.on(IPC_EVENTS.shareOpenUrl, (_event, data: unknown) => {
  if (typeof data !== 'string' || shareTokenFromUrl(data) === null) {
    return;
  }
  for (const listener of shareOpenListeners) {
    listener(data);
  }
});

// Autosave settings change listener
ipcRenderer.on(AUTOSAVE_SETTINGS_CHANGED_EVENT, (_event, data: unknown) => {
  const parsed = AutosaveSettingsSchema.safeParse(data);
  if (!parsed.success) {
    console.warn('[Preload] Invalid autosave settings event data:', parsed.error.message);
    return;
  }

  for (const listener of autosaveSettingsChangeListeners) {
    listener(parsed.data);
  }
});

// Editor dirty-state query listener (main -> renderer -> main response)
ipcRenderer.on(IPC_CHANNELS.editor.isDirty, () => {
  let isDirty = false;

  for (const listener of editorDirtyCheckListeners) {
    try {
      if (listener()) {
        isDirty = true;
        break;
      }
    } catch (error) {
      console.warn('[Preload] Dirty check listener failed:', error);
    }
  }

  ipcRenderer.send(IPC_CHANNELS.editor.isDirtyResponse, { isDirty });
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

  /** Subscribe to export file menu event */
  onMenuExportFile: (callback: () => void) => {
    menuExportFileListeners.add(callback);
    return () => {
      menuExportFileListeners.delete(callback);
    };
  },

  /** Subscribe to close-tab menu event */
  onMenuCloseTab: (callback: () => void) => {
    menuCloseTabListeners.add(callback);
    return () => {
      menuCloseTabListeners.delete(callback);
    };
  },

  /** Subscribe to reopen-tab menu event */
  onMenuReopenTab: (callback: () => void) => {
    menuReopenTabListeners.add(callback);
    return () => {
      menuReopenTabListeners.delete(callback);
    };
  },

  /** Subscribe to next-tab menu event */
  onMenuNextTab: (callback: () => void) => {
    menuNextTabListeners.add(callback);
    return () => {
      menuNextTabListeners.delete(callback);
    };
  },

  /** Subscribe to previous-tab menu event */
  onMenuPreviousTab: (callback: () => void) => {
    menuPreviousTabListeners.add(callback);
    return () => {
      menuPreviousTabListeners.delete(callback);
    };
  },

  /** Subscribe to switch-tab menu event. The index is 1 through 9. */
  onMenuSwitchTab: (callback: (index: number) => void) => {
    menuSwitchTabListeners.add(callback);
    return () => {
      menuSwitchTabListeners.delete(callback);
    };
  },

  /** Subscribe to an operating-system open of an mdxpad share link. */
  onShareOpen: (callback: (url: string) => void) => {
    shareOpenListeners.add(callback);
    return () => {
      shareOpenListeners.delete(callback);
    };
  },

  /** Subscribe to autosave files recovered before the window opened. */
  onRecoveryRestore: (callback: (entries: RecoveryRestoreEntry[]) => void) => {
    recoveryRestoreListeners.add(callback);
    return () => {
      recoveryRestoreListeners.delete(callback);
    };
  },

  /** Subscribe to autosave settings change events */
  onAutosaveSettingsChange: (callback: (settings: AutosaveSettings) => void) => {
    autosaveSettingsChangeListeners.add(callback);
    return () => {
      autosaveSettingsChangeListeners.delete(callback);
    };
  },

  /** Subscribe to editor dirty-state checks from main process */
  onEditorDirtyCheck: (callback: () => boolean) => {
    editorDirtyCheckListeners.add(callback);
    return () => {
      editorDirtyCheckListeners.delete(callback);
    };
  },
};
