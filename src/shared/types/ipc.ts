/**
 * IPC type definitions.
 * Type-safe contracts for Electron IPC communication.
 */

import type { FileHandle, FileResult } from './file';

/** All IPC channel names (per Constitution Article III.3: mdxpad:domain:action) */
export const IpcChannels = {
  // File operations
  FILE_OPEN: 'mdxpad:file:open',
  FILE_SAVE: 'mdxpad:file:save',
  FILE_SAVE_AS: 'mdxpad:file:save-as',
  FILE_READ: 'mdxpad:file:read',
  FILE_WRITE: 'mdxpad:file:write',

  // Window operations
  WINDOW_CLOSE: 'mdxpad:window:close',
  WINDOW_MINIMIZE: 'mdxpad:window:minimize',
  WINDOW_MAXIMIZE: 'mdxpad:window:maximize',

  // App info
  APP_VERSION: 'mdxpad:app:version',
  APP_READY: 'mdxpad:app:ready',
} as const;

export type IpcChannel = typeof IpcChannels[keyof typeof IpcChannels];

/** Type-safe IPC invoke/handle signatures */
export interface IpcApi {
  // File operations
  [IpcChannels.FILE_OPEN]: () => Promise<FileResult<FileHandle>>;
  [IpcChannels.FILE_SAVE]: (handle: FileHandle, content: string) => Promise<FileResult<void>>;
  [IpcChannels.FILE_SAVE_AS]: (content: string) => Promise<FileResult<FileHandle>>;
  [IpcChannels.FILE_READ]: (path: string) => Promise<FileResult<string>>;
  [IpcChannels.FILE_WRITE]: (path: string, content: string) => Promise<FileResult<void>>;

  // Window operations
  [IpcChannels.WINDOW_CLOSE]: () => Promise<void>;
  [IpcChannels.WINDOW_MINIMIZE]: () => Promise<void>;
  [IpcChannels.WINDOW_MAXIMIZE]: () => Promise<void>;

  // App info
  [IpcChannels.APP_VERSION]: () => Promise<string>;
  [IpcChannels.APP_READY]: () => Promise<void>;
}

/** Type helper for implementing handlers */
export type IpcHandler<C extends IpcChannel> = C extends keyof IpcApi ? IpcApi[C] : never;
