/**
 * API contracts stub.
 * Full contracts will be implemented in Spec 003+.
 * This file exists to complete the shared/ directory structure.
 */

// Re-export IPC contracts for convenience
export { IPC_CHANNELS, IPC_CHANNELS_DEFERRED, IPC_EVENTS } from '../lib/ipc';
export type { IpcChannel, IpcEvent, IpcPayloads, IpcRequest, IpcResponse, SecurityInfo } from '../lib/ipc';

// File system contracts (Spec 004)
export * from './file-schemas';

// Template contracts (Spec 016)
export * from './template-schemas';
