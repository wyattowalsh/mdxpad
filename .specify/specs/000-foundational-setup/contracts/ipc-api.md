# IPC API Contract: Foundational Setup

**Feature**: 000-foundational-setup | **Date**: 2025-12-30 | **Version**: 1.0.0

## Overview

This document defines the Inter-Process Communication (IPC) contract between Electron's main and renderer processes for Spec 000. All IPC follows the invoke/handle pattern per constitution §3.3.

## Security Model

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│    Renderer     │         │     Preload     │         │      Main       │
│   (sandboxed)   │         │ (contextBridge) │         │   (Node.js)     │
│                 │         │                 │         │                 │
│  window.mdxpad  │────────▶│  ipcRenderer    │────────▶│  ipcMain        │
│   .getVersion() │ invoke  │   .invoke()     │ channel │   .handle()     │
│                 │◀────────│                 │◀────────│                 │
│                 │ Promise │                 │ result  │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

**Constraints**:
- Renderer MUST NOT access `ipcRenderer` directly (no `nodeIntegration`)
- All IPC goes through `window.mdxpad` API exposed by preload
- Channel names defined in `src/shared/lib/ipc.ts` only
- All payloads validated with zod schemas

## Channel Registry

### Domain: `app`

Application lifecycle and system information.

#### `mdxpad:app:get-version`

Get the application version string.

| Property | Value |
|----------|-------|
| Channel | `mdxpad:app:get-version` |
| Direction | Renderer → Main |
| Pattern | invoke/handle |
| Auth | None |

**Request**:
```typescript
type Request = void;
```

**Response**:
```typescript
type Response = string;  // Semantic version, e.g., "0.1.0"
```

**Validation**:
```typescript
import { z } from 'zod';

const RequestSchema = z.void();
const ResponseSchema = z.string().regex(/^\d+\.\d+\.\d+/);
```

**Implementation**:

```typescript
// Main process handler (src/main/ipc/index.ts)
ipcMain.handle(IPC_CHANNELS.app.getVersion, () => {
  return app.getVersion();
});

// Preload exposure (src/preload/index.ts)
contextBridge.exposeInMainWorld('mdxpad', {
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.app.getVersion),
});

// Renderer usage
const version = await window.mdxpad.getVersion();
```

---

#### `mdxpad:app:get-security-info`

Get current BrowserWindow security configuration. Used by `verify-security.ts` script.

| Property | Value |
|----------|-------|
| Channel | `mdxpad:app:get-security-info` |
| Direction | Renderer → Main |
| Pattern | invoke/handle |
| Auth | None |

**Request**:
```typescript
type Request = void;
```

**Response**:
```typescript
interface SecurityInfo {
  contextIsolation: boolean;
  sandbox: boolean;
  nodeIntegration: boolean;
  webSecurity: boolean;
}
```

**Validation**:
```typescript
import { z } from 'zod';

const RequestSchema = z.void();

// Strict validation - these values are constitutional requirements
const ResponseSchema = z.object({
  contextIsolation: z.literal(true),
  sandbox: z.literal(true),
  nodeIntegration: z.literal(false),
  webSecurity: z.literal(true),
});
```

**Implementation**:

```typescript
// Main process handler (src/main/ipc/index.ts)
ipcMain.handle(IPC_CHANNELS.app.getSecurityInfo, (event) => {
  const webContents = event.sender;
  const window = BrowserWindow.fromWebContents(webContents);

  if (!window) {
    throw new Error('No window found for webContents');
  }

  const prefs = window.webContents.getWebPreferences();

  return {
    contextIsolation: prefs.contextIsolation ?? false,
    sandbox: prefs.sandbox ?? false,
    nodeIntegration: prefs.nodeIntegration ?? false,
    webSecurity: prefs.webSecurity ?? true,
  };
});

// Preload exposure (src/preload/index.ts)
contextBridge.exposeInMainWorld('mdxpad', {
  getSecurityInfo: () => ipcRenderer.invoke(IPC_CHANNELS.app.getSecurityInfo),
});

// Renderer usage (typically in verify-security.ts)
const info = await window.mdxpad.getSecurityInfo();
assert(info.contextIsolation === true, 'contextIsolation must be true');
```

---

## Error Handling

IPC errors are propagated as rejected Promises. The preload layer wraps responses in Result type for explicit error handling:

```typescript
// src/preload/index.ts
import { ok, err, type Result } from '../shared/lib/result';

async function safeInvoke<T>(
  channel: string,
  ...args: unknown[]
): Promise<Result<T, Error>> {
  try {
    const result = await ipcRenderer.invoke(channel, ...args);
    return ok(result as T);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}
```

**Error Categories**:

| Category | Example | Handling |
|----------|---------|----------|
| Channel not found | Typo in channel name | Log error, show generic message |
| Validation failure | Invalid response shape | Log error, return err() Result |
| Main process error | Internal exception | Propagate via err() Result |

## Testing Requirements

Per constitution §6.4, integration tests required for all IPC channels:

```typescript
// src/main/__tests__/ipc.test.ts
import { describe, it, expect } from 'vitest';

describe('IPC: app domain', () => {
  it('mdxpad:app:get-version returns valid semver', async () => {
    // Test implementation
  });

  it('mdxpad:app:get-security-info returns constitutional values', async () => {
    // Test implementation
  });
});
```

## Future Channels

Spec 000 establishes the pattern. Future specs will add:

| Spec | Domain | Channels |
|------|--------|----------|
| 003 | `file` | `read`, `write`, `watch`, `unwatch` |
| 003 | `workspace` | `open`, `close`, `list-recent` |
| 004+ | `plugin` | `load`, `unload`, `list`, `grant-permission` |

## Versioning

IPC contract versions follow semantic versioning:
- **Major**: Breaking changes to existing channels
- **Minor**: New channels added
- **Patch**: Documentation or validation updates

Current version: **1.0.0** (Spec 000 baseline)
