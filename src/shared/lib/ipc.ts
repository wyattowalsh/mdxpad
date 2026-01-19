/**
 * IPC channel definitions.
 * Centralized IPC channel registry per constitution §3.3.
 * All channels MUST be defined here—no magic strings.
 *
 * Channel naming: mdxpad:{domain}:{action}
 */

/**
 * All IPC channels for mdxpad.
 * Grouped by domain per Constitution §3.3.
 */
export const IPC_CHANNELS = {
  /** File operations (Spec 004) */
  file: {
    open: 'mdxpad:file:open',
    save: 'mdxpad:file:save',
    saveAs: 'mdxpad:file:save-as',
    read: 'mdxpad:file:read',
    write: 'mdxpad:file:write',
    change: 'mdxpad:file:change',
  },
  /** Window operations (Spec 004) */
  window: {
    close: 'mdxpad:window:close',
    minimize: 'mdxpad:window:minimize',
    maximize: 'mdxpad:window:maximize',
  },
  /** Application lifecycle */
  app: {
    getVersion: 'mdxpad:app:get-version',
    getSecurityInfo: 'mdxpad:app:get-security-info',
    version: 'mdxpad:app:version',
    ready: 'mdxpad:app:ready',
  },
  /** Editor operations */
  editor: {
    isDirty: 'mdxpad:editor:is-dirty',
    save: 'mdxpad:editor:save',
  },
} as const;

/**
 * Deferred channels for future specs.
 */
export const IPC_CHANNELS_DEFERRED = {} as const;

/**
 * Event channels (main → renderer).
 * Used with webContents.send / ipcRenderer.on pattern.
 */
export const IPC_EVENTS = {
  /** File change notification from watcher */
  fileChange: 'mdxpad:file:change',
  /** Recovered documents notification from crash recovery */
  filesRecovered: 'mdxpad:file:recovered',
  /** Menu events - command palette toggle */
  menuCommandPalette: 'mdxpad:menu:command-palette',
  /** Menu events - new file */
  menuNewFile: 'mdxpad:menu:new-file',
  /** Menu events - open file dialog */
  menuOpenFileDialog: 'mdxpad:menu:open-file-dialog',
  /** Menu events - open file (with data) */
  menuOpenFile: 'mdxpad:menu:open-file',
  /** Menu events - save file */
  menuSaveFile: 'mdxpad:menu:save-file',
  /** Menu events - save file as */
  menuSaveFileAs: 'mdxpad:menu:save-file-as',
} as const;

/**
 * Type helper to extract channel string literals.
 */
export type IpcChannel =
  | (typeof IPC_CHANNELS.file)[keyof typeof IPC_CHANNELS.file]
  | (typeof IPC_CHANNELS.window)[keyof typeof IPC_CHANNELS.window]
  | (typeof IPC_CHANNELS.app)[keyof typeof IPC_CHANNELS.app]
  | (typeof IPC_CHANNELS.editor)[keyof typeof IPC_CHANNELS.editor];

/**
 * Type helper for event channels.
 */
export type IpcEvent = (typeof IPC_EVENTS)[keyof typeof IPC_EVENTS];

/**
 * Security configuration info returned by getSecurityInfo.
 */
export interface SecurityInfo {
  contextIsolation: boolean;
  sandbox: boolean;
  nodeIntegration: boolean;
  webSecurity: boolean;
}

/**
 * Payload types for each IPC channel.
 * Request and response types for invoke/handle pattern.
 */
export interface IpcPayloads {
  [IPC_CHANNELS.app.getVersion]: {
    request: void;
    response: string;
  };
  [IPC_CHANNELS.app.getSecurityInfo]: {
    request: void;
    response: SecurityInfo;
  };
  // Note: Full payload types for file/window channels are defined
  // in file-schemas.ts using Zod schemas for runtime validation.
  // See IPC_SCHEMAS in contracts/file-schemas.ts for the authoritative
  // request/response schema registry.
}

/**
 * Helper type to get request type for a channel.
 */
export type IpcRequest<C extends keyof IpcPayloads> = IpcPayloads[C]['request'];

/**
 * Helper type to get response type for a channel.
 */
export type IpcResponse<C extends keyof IpcPayloads> = IpcPayloads[C]['response'];
