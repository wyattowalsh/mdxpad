/**
 * Preload script - exposes safe APIs to renderer via contextBridge.
 * This is the ONLY bridge between main and renderer processes.
 *
 * @security Uses contextBridge to prevent prototype pollution
 * @security Uses invoke/handle pattern, never send/on
 * @security Per Constitution III.3: All payloads validated with zod on both ends
 */

import { contextBridge, ipcRenderer } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS, IPC_EVENTS } from '@shared/lib/ipc';
import {
  // Request schemas (sender-side validation)
  FileSaveRequestSchema,
  FileSaveAsRequestSchema,
  FileReadRequestSchema,
  FileWriteRequestSchema,
  // Response schemas (receiver-side validation)
  FileOpenResponseSchema,
  FileSaveResponseSchema,
  FileSaveAsResponseSchema,
  FileReadResponseSchema,
  FileWriteResponseSchema,
  WindowCloseResponseSchema,
  WindowMinimizeResponseSchema,
  WindowMaximizeResponseSchema,
  AppVersionResponseSchema,
  AppReadyResponseSchema,
} from '@shared/contracts/file-schemas';
import {
  AutosaveChannels,
  RecoveryCheckResponseSchema,
  RecoveryListResponseSchema,
  RecoveryPreviewRequestSchema,
  RecoveryPreviewResponseSchema,
  RecoveryRestoreRequestSchema,
  RecoveryRestoreResponseSchema,
  RecoveryDiscardRequestSchema,
  RecoveryDiscardResponseSchema,
  AutosaveTriggerRequestSchema,
  AutosaveTriggerResponseSchema,
  AutosaveStatusResponseSchema,
  SettingsGetResponseSchema,
  SettingsSetRequestSchema,
  SettingsSetResponseSchema,
  ConflictResolveRequestSchema,
  ConflictResolveResponseSchema,
} from '@shared/contracts/autosave-ipc';
import { AutosaveSettingsSchema } from '@shared/contracts/autosave-schemas';
import {
  // Template request schemas
  TemplateListRequestSchema,
  TemplateGetRequestSchema,
  TemplateSaveRequestSchema,
  TemplateDeleteRequestSchema,
  TemplateImportRequestSchema,
  TemplateExportRequestSchema,
  TemplateValidateRequestSchema,
  CreateFromTemplateRequestSchema,
  TemplateOpenDialogRequestSchema,
  TemplateSaveDialogRequestSchema,
  // Template response schemas
  TemplateListResponseSchema,
  TemplateGetResponseSchema,
  TemplateSaveResponseSchema,
  TemplateDeleteResponseSchema,
  TemplateImportResponseSchema,
  TemplateExportResponseSchema,
  TemplateValidateResponseSchema,
  CreateFromTemplateResponseSchema,
  TemplateOpenDialogResponseSchema,
  TemplateSaveDialogResponseSchema,
  TemplateErrorResponseSchema,
} from '@shared/contracts/template-schemas';
import type { MdxpadAPI } from './api';
import type { FileResult, FileHandle } from '@shared/types/file';
import type { AutosaveSettings } from '@shared/contracts/autosave-schemas';
import type {
  RecoveryListResponse,
  RecoveryPreviewResponse,
  RecoveryRestoreResponse,
} from '@shared/contracts/autosave-ipc';
import { aiApi } from './ai-api';

// ============================================================================
// Schema for SecurityInfo (not in file-schemas.ts)
// ============================================================================

/**
 * SecurityInfo response schema.
 * Validates the security configuration returned by getSecurityInfo.
 */
const SecurityInfoResponseSchema = z.object({
  contextIsolation: z.boolean(),
  sandbox: z.boolean(),
  nodeIntegration: z.boolean(),
  webSecurity: z.boolean(),
});

// ============================================================================
// Validated IPC Invoke Helper
// ============================================================================

/**
 * Performs a validated IPC invoke with schema validation on both ends.
 * Per Constitution III.3: All payloads validated with zod on both ends.
 *
 * @param channel - IPC channel name
 * @param requestSchema - Zod schema for request validation (null for void requests)
 * @param responseSchema - Zod schema for response validation
 * @param args - Arguments to pass to the handler (undefined for void requests)
 * @returns Validated response data
 * @throws Error if request or response validation fails
 */
async function validatedInvoke<TReq, TRes>(
  channel: string,
  requestSchema: z.ZodType<TReq> | null,
  responseSchema: z.ZodType<TRes>,
  args?: unknown
): Promise<TRes> {
  // Validate request if schema provided (sender-side validation)
  if (requestSchema && args !== undefined) {
    const reqParsed = requestSchema.safeParse(args);
    if (!reqParsed.success) {
      throw new Error(`Request validation failed: ${reqParsed.error.message}`);
    }
  }

  // Invoke IPC - cast to unknown since Electron returns any
  const response: unknown = await ipcRenderer.invoke(channel, args);

  // Validate response (receiver-side validation)
  const resParsed = responseSchema.safeParse(response);
  if (!resParsed.success) {
    throw new Error(`Response validation failed: ${resParsed.error.message}`);
  }

  return resParsed.data;
}

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
// File Change Event Handling
// ============================================================================

/**
 * File change event listeners registry.
 * Allows multiple subscriptions and cleanup.
 */
const fileChangeListeners = new Set<(event: { fileId: string; path: string; type: 'change' | 'unlink' }) => void>();

// Set up IPC listener for file changes (once, shared across all subscriptions)
ipcRenderer.on(IPC_CHANNELS.file.change, (_event, data: unknown) => {
  // Validate incoming data matches expected shape
  const validData = data as { fileId: string; path: string; type: 'change' | 'unlink' };
  for (const listener of fileChangeListeners) {
    listener(validData);
  }
});

// ============================================================================
// Menu Event Handling
// ============================================================================

/**
 * Menu event listeners registries.
 * Each menu event has its own listener set.
 */
const menuCommandPaletteListeners = new Set<() => void>();
const menuNewFileListeners = new Set<() => void>();
const menuOpenFileDialogListeners = new Set<() => void>();
const menuOpenFileListeners = new Set<(event: { handle: unknown; content: string }) => void>();
const menuSaveFileListeners = new Set<() => void>();
const menuSaveFileAsListeners = new Set<() => void>();

// Set up IPC listeners for menu events
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
  const validData = data as { handle: unknown; content: string };
  for (const listener of menuOpenFileListeners) {
    listener(validData);
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

// ============================================================================
// Autosave Settings Change Event Handling
// ============================================================================

/**
 * Autosave settings change event listeners registry.
 */
const autosaveSettingsChangeListeners = new Set<(settings: AutosaveSettings) => void>();

// Set up IPC listener for settings changes (once, shared across all subscriptions)
ipcRenderer.on('mdxpad:autosave:settings:changed', (_event, data: unknown) => {
  // Validate incoming data
  const parsed = AutosaveSettingsSchema.safeParse(data);
  if (parsed.success) {
    for (const listener of autosaveSettingsChangeListeners) {
      listener(parsed.data);
    }
  }
});

// ============================================================================
// API Implementation
// ============================================================================

/**
 * API implementation exposed to renderer.
 * All methods use validatedInvoke for schema validation on both ends.
 *
 * Note: Type assertions are used for FileResult types because the zod-inferred
 * types are structurally equivalent but not identical due to branded types
 * (FileId) and readonly modifiers. The validation ensures runtime correctness.
 */
const api: MdxpadAPI = {
  // === App Info ===
  getVersion: () =>
    validatedInvoke(
      IPC_CHANNELS.app.getVersion,
      null, // void request
      AppVersionResponseSchema
    ),

  getSecurityInfo: () =>
    validatedInvoke(
      IPC_CHANNELS.app.getSecurityInfo,
      null, // void request
      SecurityInfoResponseSchema
    ),

  // === File Operations ===
  openFile: async (): Promise<FileResult<FileHandle>> => {
    const result = await validatedInvoke(
      IPC_CHANNELS.file.open,
      null, // void request
      FileOpenResponseSchema
    );
    // Cast validated result to expected type (structurally equivalent)
    return result as unknown as FileResult<FileHandle>;
  },

  saveFile: async (handle, content): Promise<FileResult<void>> => {
    const result = await validatedInvoke(
      IPC_CHANNELS.file.save,
      FileSaveRequestSchema,
      FileSaveResponseSchema,
      { handle, content }
    );
    // Cast validated result to expected type (structurally equivalent)
    return result as unknown as FileResult<void>;
  },

  saveFileAs: async (content): Promise<FileResult<FileHandle>> => {
    const result = await validatedInvoke(
      IPC_CHANNELS.file.saveAs,
      FileSaveAsRequestSchema,
      FileSaveAsResponseSchema,
      { content }
    );
    // Cast validated result to expected type (structurally equivalent)
    return result as unknown as FileResult<FileHandle>;
  },

  readFile: async (path): Promise<FileResult<string>> => {
    const result = await validatedInvoke(
      IPC_CHANNELS.file.read,
      FileReadRequestSchema,
      FileReadResponseSchema,
      { path }
    );
    // Cast validated result to expected type (structurally equivalent)
    return result as unknown as FileResult<string>;
  },

  writeFile: async (path, content): Promise<FileResult<void>> => {
    const result = await validatedInvoke(
      IPC_CHANNELS.file.write,
      FileWriteRequestSchema,
      FileWriteResponseSchema,
      { path, content }
    );
    // Cast validated result to expected type (structurally equivalent)
    return result as unknown as FileResult<void>;
  },

  // === Window Operations ===
  closeWindow: () =>
    validatedInvoke(
      IPC_CHANNELS.window.close,
      null, // void request
      WindowCloseResponseSchema
    ),

  minimizeWindow: () =>
    validatedInvoke(
      IPC_CHANNELS.window.minimize,
      null, // void request
      WindowMinimizeResponseSchema
    ),

  maximizeWindow: () =>
    validatedInvoke(
      IPC_CHANNELS.window.maximize,
      null, // void request
      WindowMaximizeResponseSchema
    ),

  // === App Lifecycle ===
  signalReady: () =>
    validatedInvoke(
      IPC_CHANNELS.app.ready,
      null, // void request
      AppReadyResponseSchema
    ),

  // === Events ===
  onFileChange: (callback) => {
    fileChangeListeners.add(callback);
    return () => {
      fileChangeListeners.delete(callback);
    };
  },

  // === Menu Events ===
  onMenuCommandPalette: (callback) => {
    menuCommandPaletteListeners.add(callback);
    return () => {
      menuCommandPaletteListeners.delete(callback);
    };
  },

  onMenuNewFile: (callback) => {
    menuNewFileListeners.add(callback);
    return () => {
      menuNewFileListeners.delete(callback);
    };
  },

  onMenuOpenFileDialog: (callback) => {
    menuOpenFileDialogListeners.add(callback);
    return () => {
      menuOpenFileDialogListeners.delete(callback);
    };
  },

  onMenuOpenFile: (callback) => {
    menuOpenFileListeners.add(callback as (event: { handle: unknown; content: string }) => void);
    return () => {
      menuOpenFileListeners.delete(callback as (event: { handle: unknown; content: string }) => void);
    };
  },

  onMenuSaveFile: (callback) => {
    menuSaveFileListeners.add(callback);
    return () => {
      menuSaveFileListeners.delete(callback);
    };
  },

  onMenuSaveFileAs: (callback) => {
    menuSaveFileAsListeners.add(callback);
    return () => {
      menuSaveFileAsListeners.delete(callback);
    };
  },

  // === Autosave & Recovery (Spec 011) ===
  recoveryCheck: () =>
    validatedInvoke(
      AutosaveChannels.RECOVERY_CHECK,
      null,
      RecoveryCheckResponseSchema
    ),

  recoveryList: async (): Promise<RecoveryListResponse> => {
    const result = await validatedInvoke(
      AutosaveChannels.RECOVERY_LIST,
      null,
      RecoveryListResponseSchema
    );
    // Cast validated result to expected type (structurally equivalent, branded types)
    return result as unknown as RecoveryListResponse;
  },

  recoveryPreview: async (request): Promise<RecoveryPreviewResponse> => {
    const result = await validatedInvoke(
      AutosaveChannels.RECOVERY_PREVIEW,
      RecoveryPreviewRequestSchema,
      RecoveryPreviewResponseSchema,
      request
    );
    // Cast validated result to expected type (structurally equivalent, branded types)
    return result as unknown as RecoveryPreviewResponse;
  },

  recoveryRestore: async (request): Promise<RecoveryRestoreResponse> => {
    const result = await validatedInvoke(
      AutosaveChannels.RECOVERY_RESTORE,
      RecoveryRestoreRequestSchema,
      RecoveryRestoreResponseSchema,
      request
    );
    // Cast validated result to expected type (structurally equivalent, branded types)
    return result as unknown as RecoveryRestoreResponse;
  },

  recoveryDiscard: (request) =>
    validatedInvoke(
      AutosaveChannels.RECOVERY_DISCARD,
      RecoveryDiscardRequestSchema,
      RecoveryDiscardResponseSchema,
      request
    ),

  autosaveTrigger: (request) =>
    validatedInvoke(
      AutosaveChannels.AUTOSAVE_TRIGGER,
      AutosaveTriggerRequestSchema,
      AutosaveTriggerResponseSchema,
      request
    ),

  autosaveStatus: () =>
    validatedInvoke(
      AutosaveChannels.AUTOSAVE_STATUS,
      null,
      AutosaveStatusResponseSchema
    ),

  autosaveSettingsGet: () =>
    validatedInvoke(
      AutosaveChannels.SETTINGS_GET,
      null,
      SettingsGetResponseSchema
    ),

  autosaveSettingsSet: (settings) =>
    validatedInvoke(
      AutosaveChannels.SETTINGS_SET,
      SettingsSetRequestSchema,
      SettingsSetResponseSchema,
      settings
    ),

  conflictResolve: (request) =>
    validatedInvoke(
      AutosaveChannels.CONFLICT_RESOLVE,
      ConflictResolveRequestSchema,
      ConflictResolveResponseSchema,
      request
    ),

  onAutosaveSettingsChange: (callback) => {
    autosaveSettingsChangeListeners.add(callback);
    return () => {
      autosaveSettingsChangeListeners.delete(callback);
    };
  },

  // === Platform Info ===
  platform: {
    os: 'darwin',
    arch: getArch(),
  },

  // === AI Provider API (Spec 028) ===
  ai: aiApi,

  // === Template Operations (Spec 016) ===
  template: {
    list: async (source = 'all') => {
      const request = { action: 'list' as const, source };
      const reqParsed = TemplateListRequestSchema.safeParse(request);
      if (!reqParsed.success) {
        return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
      }

      const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.list, request);
      const resParsed = TemplateListResponseSchema.safeParse(response);
      if (resParsed.success) {
        return { success: true, data: resParsed.data.templates };
      }
      const errParsed = TemplateErrorResponseSchema.safeParse(response);
      if (errParsed.success) {
        return errParsed.data;
      }
      return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
    },

    get: async (id) => {
      const request = { action: 'get' as const, id };
      const reqParsed = TemplateGetRequestSchema.safeParse(request);
      if (!reqParsed.success) {
        return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
      }

      const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.get, request);
      const resParsed = TemplateGetResponseSchema.safeParse(response);
      if (resParsed.success) {
        return { success: true, data: resParsed.data.template };
      }
      const errParsed = TemplateErrorResponseSchema.safeParse(response);
      if (errParsed.success) {
        return errParsed.data;
      }
      return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
    },

    save: async (template, replace = false) => {
      const request = { action: 'save' as const, template, replace };
      const reqParsed = TemplateSaveRequestSchema.safeParse(request);
      if (!reqParsed.success) {
        return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
      }

      const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.save, request);
      const resParsed = TemplateSaveResponseSchema.safeParse(response);
      if (resParsed.success) {
        return { success: true, data: resParsed.data.template };
      }
      const errParsed = TemplateErrorResponseSchema.safeParse(response);
      if (errParsed.success) {
        return errParsed.data;
      }
      return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
    },

    delete: async (id) => {
      const request = { action: 'delete' as const, id };
      const reqParsed = TemplateDeleteRequestSchema.safeParse(request);
      if (!reqParsed.success) {
        return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
      }

      const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.delete, request);
      const resParsed = TemplateDeleteResponseSchema.safeParse(response);
      if (resParsed.success) {
        return { success: true, data: { id: resParsed.data.id } };
      }
      const errParsed = TemplateErrorResponseSchema.safeParse(response);
      if (errParsed.success) {
        return errParsed.data;
      }
      return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
    },

    import: async (path, replace = false) => {
      const request = { action: 'import' as const, path, replace };
      const reqParsed = TemplateImportRequestSchema.safeParse(request);
      if (!reqParsed.success) {
        return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
      }

      const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.import, request);
      const resParsed = TemplateImportResponseSchema.safeParse(response);
      if (resParsed.success) {
        return { success: true, data: resParsed.data.template };
      }
      const errParsed = TemplateErrorResponseSchema.safeParse(response);
      if (errParsed.success) {
        return errParsed.data;
      }
      return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
    },

    export: async (id, path) => {
      const request = { action: 'export' as const, id, path };
      const reqParsed = TemplateExportRequestSchema.safeParse(request);
      if (!reqParsed.success) {
        return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
      }

      const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.export, request);
      const resParsed = TemplateExportResponseSchema.safeParse(response);
      if (resParsed.success) {
        return { success: true, data: { path: resParsed.data.path } };
      }
      const errParsed = TemplateErrorResponseSchema.safeParse(response);
      if (errParsed.success) {
        return errParsed.data;
      }
      return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
    },

    validate: async (content) => {
      const request = { action: 'validate' as const, content };
      const reqParsed = TemplateValidateRequestSchema.safeParse(request);
      if (!reqParsed.success) {
        return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
      }

      const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.validate, request);
      const resParsed = TemplateValidateResponseSchema.safeParse(response);
      if (resParsed.success) {
        return { success: true, data: { valid: resParsed.data.valid, errors: resParsed.data.errors } };
      }
      const errParsed = TemplateErrorResponseSchema.safeParse(response);
      if (errParsed.success) {
        return errParsed.data;
      }
      return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
    },

    createFromTemplate: async (templateId, variables, savePath) => {
      const request = { templateId, variables, savePath };
      const reqParsed = CreateFromTemplateRequestSchema.safeParse(request);
      if (!reqParsed.success) {
        return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
      }

      const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.createFromTemplate, request);
      const resParsed = CreateFromTemplateResponseSchema.safeParse(response);
      if (resParsed.success) {
        const data: { content: string; path?: string } = { content: resParsed.data.content };
        if (resParsed.data.path !== undefined) {
          data.path = resParsed.data.path;
        }
        return { success: true, data };
      }
      const errParsed = TemplateErrorResponseSchema.safeParse(response);
      if (errParsed.success) {
        return errParsed.data;
      }
      return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
    },

    showOpenDialog: async () => {
      const request = { action: 'showOpenDialog' as const };
      const reqParsed = TemplateOpenDialogRequestSchema.safeParse(request);
      if (!reqParsed.success) {
        return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
      }

      const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.showOpenDialog, request);
      const resParsed = TemplateOpenDialogResponseSchema.safeParse(response);
      if (resParsed.success) {
        return { success: true, data: { path: resParsed.data.path, canceled: resParsed.data.canceled } };
      }
      const errParsed = TemplateErrorResponseSchema.safeParse(response);
      if (errParsed.success) {
        return errParsed.data;
      }
      return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
    },

    showSaveDialog: async (defaultName) => {
      const request = { action: 'showSaveDialog' as const, defaultName };
      const reqParsed = TemplateSaveDialogRequestSchema.safeParse(request);
      if (!reqParsed.success) {
        return { success: false, error: reqParsed.error.message, code: 'VALIDATION_ERROR' as const };
      }

      const response: unknown = await ipcRenderer.invoke(IPC_CHANNELS.template.showSaveDialog, request);
      const resParsed = TemplateSaveDialogResponseSchema.safeParse(response);
      if (resParsed.success) {
        return { success: true, data: { path: resParsed.data.path, canceled: resParsed.data.canceled } };
      }
      const errParsed = TemplateErrorResponseSchema.safeParse(response);
      if (errParsed.success) {
        return errParsed.data;
      }
      return { success: false, error: 'Invalid response from main process', code: 'VALIDATION_ERROR' as const };
    },
  },
};

// Expose API to renderer via contextBridge
contextBridge.exposeInMainWorld('mdxpad', api);

console.log('mdxpad preload script loaded');
