/**
 * Preload script - exposes safe APIs to renderer via contextBridge.
 * This is the ONLY bridge between main and renderer processes.
 *
 * @security Uses contextBridge to prevent prototype pollution
 * @security Uses invoke/handle pattern, never send/on
 * @security Per Constitution III.3: All payloads validated with zod on both ends
 */

import { contextBridge } from 'electron';
import type { MdxpadAPI } from './api';

// Import modularized APIs
import { appInfo, fileOperations, windowOperations } from './file-api';
import { recoveryOperations, autosaveOperations, settingsOperations } from './recovery-api';
import { templateApi } from './template-api';
import { eventSubscriptions } from './event-api';
import { aiApi } from './ai-api';
import { syncApi, collaborationApi, extensionPlatformApi, publishApi } from './platform-api';

// ============================================================================
// Platform Detection
// ============================================================================

/**
 * Detect architecture at runtime.
 * Note: In sandboxed preload, process.arch is available but may vary by Electron version.
 * We wrap in try-catch for safety.
 */
function getArch(): 'arm64' | 'x64' {
  try {
    return process.arch === 'arm64' ? 'arm64' : 'x64';
  } catch {
    // Default to x64 if process.arch is unavailable
    return 'x64';
  }
}

// ============================================================================
// API Composition
// ============================================================================

/**
 * Full API implementation exposed to renderer.
 * Composes all modular APIs into a single unified interface.
 */
const api: MdxpadAPI = {
  // App Info (from file-api)
  getVersion: appInfo.getVersion,
  getSecurityInfo: appInfo.getSecurityInfo,
  signalReady: appInfo.signalReady,

  // File Operations (from file-api)
  openFile: fileOperations.openFile,
  saveFile: fileOperations.saveFile,
  saveFileAs: fileOperations.saveFileAs,
  exportFile: fileOperations.exportFile,
  readFile: fileOperations.readFile,
  writeFile: fileOperations.writeFile,

  // Window Operations (from file-api)
  closeWindow: windowOperations.closeWindow,
  minimizeWindow: windowOperations.minimizeWindow,
  maximizeWindow: windowOperations.maximizeWindow,

  // Recovery & Autosave Operations (from recovery-api)
  recoveryCheck: recoveryOperations.recoveryCheck,
  recoveryList: recoveryOperations.recoveryList,
  recoveryPreview: recoveryOperations.recoveryPreview,
  recoveryRestore: recoveryOperations.recoveryRestore,
  recoveryDiscard: recoveryOperations.recoveryDiscard,

  autosaveTrigger: autosaveOperations.autosaveTrigger,
  autosaveStatus: autosaveOperations.autosaveStatus,
  conflictResolve: autosaveOperations.conflictResolve,

  // Settings Operations (from recovery-api)
  autosaveSettingsGet: settingsOperations.autosaveSettingsGet,
  autosaveSettingsSet: settingsOperations.autosaveSettingsSet,
  settings: {
    get: settingsOperations.autosaveSettingsGet,
    set: settingsOperations.autosaveSettingsSet,
    onChange: eventSubscriptions.onAutosaveSettingsChange,
  },

  // Event Subscriptions (from event-api)
  onFileChange: eventSubscriptions.onFileChange,
  onMenuCommandPalette: eventSubscriptions.onMenuCommandPalette,
  onMenuNewFile: eventSubscriptions.onMenuNewFile,
  onMenuOpenFileDialog: eventSubscriptions.onMenuOpenFileDialog,
  onMenuOpenFile: eventSubscriptions.onMenuOpenFile,
  onMenuSaveFile: eventSubscriptions.onMenuSaveFile,
  onMenuSaveFileAs: eventSubscriptions.onMenuSaveFileAs,
  onMenuExportFile: eventSubscriptions.onMenuExportFile,
  onAutosaveSettingsChange: eventSubscriptions.onAutosaveSettingsChange,
  onEditorDirtyCheck: eventSubscriptions.onEditorDirtyCheck,

  // Platform Info
  platform: {
    os: 'darwin',
    arch: getArch(),
  },

  // AI Provider API (from ai-api)
  ai: aiApi,

  // Template Operations (from template-api)
  template: templateApi,

  // Fleet Wave 3/4 platform foundations
  sync: syncApi,
  collaboration: collaborationApi,
  extensions: extensionPlatformApi,
  publish: publishApi,
};

// ============================================================================
// ContextBridge Exposure
// ============================================================================

// Expose API to renderer via contextBridge
contextBridge.exposeInMainWorld('mdxpad', api);

console.log('mdxpad preload script loaded');
