/**
 * Shared library exports.
 * Re-exports all shared utilities for convenient importing.
 */

// Result monad
export {
  type Result,
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  andThen,
  flatMap,
  orElse,
  unwrap,
  unwrapOr,
  unwrapErr,
  match,
} from './result';

// Typed events
export { type EventMap, type EventHandler, TypedEventEmitter, createEventEmitter } from './events';

// Utility functions
export { cn, debounce, throttle, uid } from './utils';

// Atomic file operations
export { atomicWrite } from './atomic-write';

// Content integrity
export { computeChecksum } from './checksum';

// Metadata utilities
export {
  type NormalizedFrontmatterValue,
  type ExtractedDocumentMetadata,
  parseFrontmatterYaml,
  normalizeFrontmatterValue,
  normalizeFrontmatter,
  toSlug,
  deriveTags,
  deriveSlug,
  extractDocumentMetadata,
} from './metadata';

// IPC
/* eslint-disable @typescript-eslint/no-deprecated -- intentional re-export of legacy API */
export {
  IPC_CHANNELS,
  IPC_EVENTS,
  type IpcChannel,
  type IpcEvent,
  type SecurityInfo,
  type IpcPayloads,
  type IpcRequest,
  type IpcResponse,
} from './ipc';
/* eslint-enable @typescript-eslint/no-deprecated */
