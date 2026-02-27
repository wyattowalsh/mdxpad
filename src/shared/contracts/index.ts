/**
 * API contracts stub.
 * Full contracts will be implemented in Spec 003+.
 * This file exists to complete the shared/ directory structure.
 */

// Re-export IPC contracts for convenience
// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional re-export of legacy API
export { IPC_CHANNELS, IPC_CHANNELS_DEFERRED, IPC_EVENTS } from '../lib/ipc';
// eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional re-export of legacy API
export type {
  IpcChannel,
  IpcEvent,
  IpcPayloads,
  IpcRequest,
  IpcResponse,
  SecurityInfo,
} from '../lib/ipc';

// File system contracts (Spec 004)
export * from './file-schemas';

// Autosave and recovery contracts (Spec 011)
export * from './autosave-schemas';
export * from './autosave-ipc';

// Template contracts (Spec 016)
export * from './template-schemas';
