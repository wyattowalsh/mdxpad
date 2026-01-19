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
export {
  type EventMap,
  type EventHandler,
  TypedEventEmitter,
  createEventEmitter,
} from './events';

// Utility functions
export { cn, debounce, throttle, uid } from './utils';

// IPC
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
