# Quickstart: File System Shell

**Date**: 2026-01-09
**Feature**: 004-file-system-shell

## Prerequisites

- Node.js 22.x or later
- pnpm 10.x or later
- macOS (darwin) - target platform per Constitution

## Setup

```bash
# Clone and checkout feature branch
git checkout 004-file-system-shell

# Install dependencies
pnpm install

# Verify TypeScript compilation
pnpm typecheck
```

## Development Workflow

### Run Development Build

```bash
# Start Electron in dev mode with hot reload
pnpm dev
```

### Run Tests

```bash
# Unit tests (Vitest)
pnpm test

# Run specific test file
pnpm test src/main/services/file-service.test.ts

# E2E tests (Playwright)
pnpm test:e2e

# Run specific E2E spec
pnpm test:e2e tests/e2e/file-operations.spec.ts
```

### Build

```bash
# Production build
pnpm build

# Verify all checks pass
pnpm typecheck && pnpm lint && pnpm build
```

## Key Files to Implement

### Main Process (src/main/)

| File | Purpose |
|------|---------|
| `ipc/file-handlers.ts` | IPC handlers for file operations |
| `ipc/window-handlers.ts` | IPC handlers for window operations |
| `services/file-service.ts` | File read/write logic |
| `services/file-watcher.ts` | chokidar wrapper for watching |
| `services/auto-save.ts` | Auto-save manager (30s interval) |
| `services/recent-files.ts` | Recent files persistence |

### Shared Contracts (src/shared/)

| File | Purpose |
|------|---------|
| `contracts/file-schemas.ts` | Zod schemas for IPC validation |

### Tests

| File | Purpose |
|------|---------|
| `tests/integration/ipc/file-handlers.test.ts` | IPC handler unit tests |
| `tests/e2e/file-operations.spec.ts` | E2E file workflow tests |

## IPC Channel Reference

### File Operations

| Channel | Request | Response |
|---------|---------|----------|
| `mdxpad:file:open` | void | `FileResult<FileHandle>` |
| `mdxpad:file:save` | `{ handle, content }` | `FileResult<void>` |
| `mdxpad:file:save-as` | `{ content }` | `FileResult<FileHandle>` |
| `mdxpad:file:read` | `{ path }` | `FileResult<string>` |
| `mdxpad:file:write` | `{ path, content }` | `FileResult<void>` |

### Window Operations

| Channel | Request | Response |
|---------|---------|----------|
| `mdxpad:window:close` | void | void |
| `mdxpad:window:minimize` | void | void |
| `mdxpad:window:maximize` | void | void |

### App Operations

| Channel | Request | Response |
|---------|---------|----------|
| `mdxpad:app:version` | void | string |
| `mdxpad:app:ready` | void | void |

## Constitution Compliance Checklist

Before PR, verify:

- [ ] All file ops in main process only (§3.1)
- [ ] contextIsolation: true (§3.2)
- [ ] IPC uses invoke/handle pattern (§3.3)
- [ ] Zod validation on all IPC payloads (§3.3)
- [ ] Channel naming: `mdxpad:domain:action` (§3.3)
- [ ] File open 1MB < 500ms (Article V)
- [ ] File open 10MB < 2s (Article V)
- [ ] JSDoc on public APIs (§6.1)
- [ ] Functions max 50 lines (§6.2)
- [ ] Auto-save every 30s (§7.3)

## Troubleshooting

### chokidar not detecting changes

Ensure `awaitWriteFinish` is configured:

```typescript
chokidar.watch(path, {
  awaitWriteFinish: {
    stabilityThreshold: 500,
    pollInterval: 100
  }
});
```

### IPC validation failing

Check zod schema matches payload structure. Use `safeParse()` for debugging:

```typescript
const result = schema.safeParse(payload);
if (!result.success) {
  console.log(result.error.issues);
}
```

### electron-store not persisting

Verify store is created with schema:

```typescript
const store = new Store<StoreSchema>({ schema });
```

Data stored at `app.getPath('userData')`.
