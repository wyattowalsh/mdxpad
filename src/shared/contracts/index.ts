/**
 * API contracts stub.
 * Full contracts will be implemented in Spec 003+.
 * This file exists to complete the shared/ directory structure.
 */

// Re-export IPC contracts for convenience
export { IPC_CHANNELS, IPC_CHANNELS_DEFERRED } from '../lib/ipc';
export type { IpcPayloads, IpcRequest, IpcResponse } from '../lib/ipc';

// Future contracts will be added here:
// - FileContract (Spec 003)
// - WorkspaceContract (Spec 003)
// - PluginContract (Spec 004+)
