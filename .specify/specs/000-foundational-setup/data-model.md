# Data Model: Foundational Setup

**Feature**: 000-foundational-setup | **Date**: 2025-12-30

## Overview

Spec 000 establishes foundational types and utilities. No persistent data models exist yet—those come in Spec 003 (File System). This document defines the core runtime entities.

## Core Types

### Result<T, E>

Functional error handling monad. All operations that can fail MUST return Result.

```typescript
// src/shared/lib/result.ts

/**
 * Discriminated union for success/failure outcomes.
 * Enables exhaustive pattern matching and explicit error handling.
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Create a successful Result.
 * @param value - The success value
 * @returns Result with ok: true
 * @example
 * const result = ok(42);
 * // { ok: true, value: 42 }
 */
export function ok<T>(value: T): Result<T, never>;

/**
 * Create a failed Result.
 * @param error - The error value
 * @returns Result with ok: false
 * @example
 * const result = err(new Error('Failed'));
 * // { ok: false, error: Error('Failed') }
 */
export function err<E>(error: E): Result<never, E>;

/**
 * Map over a successful Result value.
 * @param result - The Result to map
 * @param fn - Transform function for success value
 * @returns New Result with transformed value or original error
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E>;

/**
 * Chain Results together (flatMap).
 * @param result - The Result to chain
 * @param fn - Function returning new Result
 * @returns Chained Result
 */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E>;

/**
 * Unwrap Result or throw.
 * @param result - The Result to unwrap
 * @returns The success value
 * @throws The error if Result is not ok
 */
export function unwrap<T, E>(result: Result<T, E>): T;

/**
 * Unwrap Result or return default.
 * @param result - The Result to unwrap
 * @param defaultValue - Value to return if error
 * @returns The success value or default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T;
```

### TypedEventEmitter<T>

Type-safe event emitter for pub/sub patterns.

```typescript
// src/shared/lib/events.ts

/**
 * Event map type - maps event names to payload types.
 * @example
 * type AppEvents = {
 *   'file:changed': { path: string };
 *   'theme:updated': { theme: 'light' | 'dark' };
 * };
 */
export type EventMap = Record<string, unknown>;

/**
 * Type-safe event emitter.
 * Ensures event names and payloads are correctly typed.
 */
export class TypedEventEmitter<T extends EventMap> {
  /**
   * Subscribe to an event.
   * @param event - Event name (must be key of T)
   * @param handler - Callback receiving typed payload
   * @returns Unsubscribe function
   */
  on<K extends keyof T>(
    event: K,
    handler: (payload: T[K]) => void
  ): () => void;

  /**
   * Subscribe to an event once.
   * @param event - Event name
   * @param handler - Callback (called once then removed)
   * @returns Unsubscribe function
   */
  once<K extends keyof T>(
    event: K,
    handler: (payload: T[K]) => void
  ): () => void;

  /**
   * Emit an event to all subscribers.
   * @param event - Event name
   * @param payload - Typed payload
   */
  emit<K extends keyof T>(event: K, payload: T[K]): void;

  /**
   * Remove all listeners for an event or all events.
   * @param event - Optional event name
   */
  off<K extends keyof T>(event?: K): void;
}
```

### IPC Channel Definitions

Centralized IPC channel registry per constitution §3.3.

```typescript
// src/shared/lib/ipc.ts

/**
 * IPC channel names following mdxpad:<domain>:<action> pattern.
 * All channels MUST be defined here—no magic strings.
 */
export const IPC_CHANNELS = {
  /** Application lifecycle */
  app: {
    getVersion: 'mdxpad:app:get-version',
    getSecurityInfo: 'mdxpad:app:get-security-info',
  },
} as const;

/**
 * Type helper to extract channel string literals.
 */
export type IpcChannel =
  | typeof IPC_CHANNELS.app[keyof typeof IPC_CHANNELS.app];

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
}

/**
 * Security configuration info returned by getSecurityInfo.
 */
export interface SecurityInfo {
  contextIsolation: boolean;
  sandbox: boolean;
  nodeIntegration: boolean;
  webSecurity: boolean;
}
```

### MdxpadAPI

The API exposed to renderer via contextBridge.

```typescript
// src/preload/api.ts

import { z } from 'zod';
import type { Result } from '../shared/lib/result';

/**
 * API surface exposed to renderer process via contextBridge.
 * This is the ONLY way renderer can communicate with main process.
 *
 * @security All methods use invoke/handle pattern.
 * @security All responses validated with zod before returning.
 */
export interface MdxpadAPI {
  /**
   * Get application version.
   * @returns Semantic version string (e.g., "0.1.0")
   */
  getVersion(): Promise<string>;

  /**
   * Get current security configuration.
   * Used by verify-security script and debug info.
   * @returns Security settings object
   */
  getSecurityInfo(): Promise<SecurityInfo>;

  /**
   * Platform information.
   */
  platform: {
    os: 'darwin';  // macOS only per constitution
    arch: 'arm64' | 'x64';
  };
}

/**
 * Zod schema for SecurityInfo validation.
 */
export const SecurityInfoSchema = z.object({
  contextIsolation: z.literal(true),
  sandbox: z.literal(true),
  nodeIntegration: z.literal(false),
  webSecurity: z.literal(true),
});

export type SecurityInfo = z.infer<typeof SecurityInfoSchema>;
```

## Type Declarations

### Global Window Extension

```typescript
// src/renderer/env.d.ts

/// <reference types="vite/client" />

import type { MdxpadAPI } from '../preload/api';

declare global {
  interface Window {
    /** API exposed by preload script */
    mdxpad: MdxpadAPI;
  }
}

export {};
```

### Electron Module Types

```typescript
// src/shared/types/index.ts

/**
 * Re-export all shared types for convenience.
 */
export type { Result } from '../lib/result';
export type { EventMap, TypedEventEmitter } from '../lib/events';
export type { IpcChannel, IpcPayloads, SecurityInfo } from '../lib/ipc';
export type { MdxpadAPI } from '../../preload/api';
```

## Entity Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                        Main Process                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   app.ts    │────▶│  window.ts  │────▶│ BrowserWindow│       │
│  │  lifecycle  │     │   factory   │     │   instance   │       │
│  └─────────────┘     └─────────────┘     └──────┬──────┘       │
│                                                  │               │
│  ┌─────────────────────────────────────────────┐│               │
│  │              ipc/handlers.ts                 ││               │
│  │  IPC_CHANNELS.app.getVersion ────────────────┤│               │
│  │  IPC_CHANNELS.app.getSecurityInfo ───────────┤│               │
│  └─────────────────────────────────────────────┘│               │
└──────────────────────────────────────────────────┼───────────────┘
                                                   │ contextBridge
┌──────────────────────────────────────────────────┼───────────────┐
│                      Preload                     │               │
│  ┌─────────────────────────────────────────────┐│               │
│  │              index.ts                        ││               │
│  │  contextBridge.exposeInMainWorld(           ││               │
│  │    'mdxpad',                                 ││               │
│  │    { getVersion, getSecurityInfo, platform }││               │
│  │  )                                          ││               │
│  └─────────────────────────────────────────────┘│               │
└──────────────────────────────────────────────────┼───────────────┘
                                                   │ window.mdxpad
┌──────────────────────────────────────────────────┼───────────────┐
│                     Renderer                     ▼               │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   App.tsx   │────▶│  hooks/     │────▶│window.mdxpad│       │
│  │  root comp  │     │  (future)   │     │    API      │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        Shared                                    │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │  result.ts  │     │  events.ts  │     │   ipc.ts    │       │
│  │ Result<T,E> │     │TypedEmitter │     │IPC_CHANNELS │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## Validation Requirements

Per constitution §3.3, all IPC payloads MUST be validated with zod:

| Channel | Request Schema | Response Schema |
|---------|---------------|-----------------|
| `mdxpad:app:get-version` | `z.void()` | `z.string()` |
| `mdxpad:app:get-security-info` | `z.void()` | `SecurityInfoSchema` |

## Future Extensions

Spec 000 establishes patterns. Future specs will add:

| Spec | New Entities |
|------|--------------|
| 001 | CodeMirror state types, editor extensions |
| 002 | MDX AST types, component registry |
| 003 | Document, Workspace, FileWatcher |
| 004+ | Plugin manifest, capability grants |
