/**
 * Shared type definitions.
 * Re-exports types for convenient importing.
 */

// Re-export types from lib
export type { Result } from '../lib/result';
export type { EventMap, EventHandler } from '../lib/events';
export type {
  IpcChannel,
  SecurityInfo,
  IpcPayloads,
  IpcRequest,
  IpcResponse,
} from '../lib/ipc';

// Additional shared types can be defined here

/**
 * Platform information exposed to renderer.
 */
export interface PlatformInfo {
  os: 'darwin'; // macOS only per constitution
  arch: 'arm64' | 'x64';
}

/**
 * Application metadata.
 */
export interface AppInfo {
  name: string;
  version: string;
  platform: PlatformInfo;
}
