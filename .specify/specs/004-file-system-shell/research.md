# Research: File System Shell

**Date**: 2026-01-09
**Feature**: 004-file-system-shell

## Summary

Research conducted on Electron 39.x file operations, chokidar 5.x file watching, and electron-store for recent files persistence. All findings support the implementation approach outlined in plan.md.

---

## 1. Electron File Dialogs

**Decision**: Use async `dialog.showOpenDialog` / `dialog.showSaveDialog` with typed return values

**Rationale**:
- Async versions don't block main process
- TypeScript types built into Electron 39.x
- Return structured result with `canceled` flag and `filePath`/`filePaths`

**Alternatives considered**:
- Sync dialogs: Rejected (blocks main process, poor UX)
- Custom HTML dialogs: Rejected (Constitution §7.1 requires native macOS HIG)

**Code pattern**:
```typescript
import { dialog } from 'electron';
import type { OpenDialogReturnValue } from 'electron';

const result: OpenDialogReturnValue = await dialog.showOpenDialog({
  properties: ['openFile'],
  filters: [{ name: 'MDX', extensions: ['mdx', 'md'] }]
});

// Returns { canceled: boolean, filePaths: string[] }
```

---

## 2. File Reading with fs/promises

**Decision**: Use `import { promises as fs } from 'node:fs'` with structured error returns

**Rationale**:
- Native Node.js API, no external dependency
- Async/await compatible
- `node:fs` prefix ensures Node.js module (not polyfill)

**Alternatives considered**:
- fs-extra: Rejected (unnecessary dependency for basic ops)
- Sync fs methods: Rejected (blocks main process)

**Code pattern**:
```typescript
import { promises as fs } from 'node:fs';

async function readFile(path: string): Promise<FileResult<string>> {
  try {
    const content = await fs.readFile(path, { encoding: 'utf-8' });
    return { ok: true, value: content };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ok: false, error: { code: 'NOT_FOUND', path } };
    }
    if ((err as NodeJS.ErrnoException).code === 'EACCES') {
      return { ok: false, error: { code: 'PERMISSION_DENIED', path } };
    }
    return { ok: false, error: { code: 'UNKNOWN', message: String(err) } };
  }
}
```

---

## 3. IPC with Zod Validation

**Decision**: Create validated handler wrapper using `safeParse()` on all inputs

**Rationale**:
- Constitution §3.3 requires zod validation on both ends
- `safeParse()` never throws, returns success/error discriminated union
- Generic wrapper reduces boilerplate

**Alternatives considered**:
- Manual validation: Rejected (error-prone, inconsistent)
- io-ts: Rejected (Constitution specifies zod 4.x)

**Code pattern**:
```typescript
import { z } from 'zod';
import { ipcMain } from 'electron';

function createValidatedHandler<TSchema extends z.ZodType, TResult>(
  channel: string,
  schema: TSchema,
  handler: (args: z.infer<TSchema>) => Promise<TResult>
): void {
  ipcMain.handle(channel, async (_event, rawArgs: unknown) => {
    const parsed = schema.safeParse(rawArgs);
    if (!parsed.success) {
      return { ok: false, error: { code: 'VALIDATION', issues: parsed.error.issues } };
    }
    return handler(parsed.data);
  });
}
```

---

## 4. File Watching with Chokidar 5.x

**Decision**: Use chokidar 5.0.0 with `awaitWriteFinish` for debouncing

**Rationale**:
- Constitution §3.1 specifies chokidar
- Built-in TypeScript types (no @types package needed)
- `awaitWriteFinish` handles atomic saves and chunked writes
- `stabilityThreshold: 500` matches FR-011 (500ms debounce)

**Alternatives considered**:
- Node.js fs.watch: Rejected (unreliable across platforms, no debouncing)
- Custom polling: Rejected (chokidar handles this better)

**Code pattern**:
```typescript
import chokidar, { FSWatcher } from 'chokidar';

const watcher: FSWatcher = chokidar.watch(filePath, {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 500,  // FR-011: 500ms debounce
    pollInterval: 100
  },
  atomic: true  // Handle temp-file atomic saves
});

watcher.on('change', (path) => { /* notify renderer via IPC */ });
watcher.on('unlink', (path) => { /* file deleted */ });
```

**Memory management**:
```typescript
// Always close watcher when file is closed or window closes
await watcher.close();
```

---

## 5. Recent Files Persistence

**Decision**: Use electron-store 11.0.2 with JSON Schema validation

**Rationale**:
- Simple key-value storage, no database needed
- JSON Schema validation ensures data integrity
- Automatic storage in `app.getPath('userData')`
- Built-in TypeScript types

**Alternatives considered**:
- SQLite: Rejected (overkill for 10-item list)
- Custom JSON file: Rejected (electron-store handles edge cases)
- localStorage: Rejected (not available in main process)

**Code pattern**:
```typescript
import Store, { Schema } from 'electron-store';

interface StoreSchema {
  recentFiles: string[];
}

const schema: Schema<StoreSchema> = {
  recentFiles: {
    type: 'array',
    items: { type: 'string' },
    default: [],
    maxItems: 10
  }
};

const store = new Store<StoreSchema>({ schema });

function addRecentFile(filePath: string): void {
  const files = store.get('recentFiles').filter(f => f !== filePath);
  store.set('recentFiles', [filePath, ...files].slice(0, 10));
}
```

---

## 6. Auto-Save to Temp Directory

**Decision**: Use `app.getPath('temp')` with document-specific filenames

**Rationale**:
- OS manages temp directory cleanup
- No user configuration needed
- Filename includes FileId for recovery association

**Alternatives considered**:
- app.getPath('userData'): Could use, but temp is cleaner semantically
- Custom directory: Rejected (unnecessary complexity)

**Code pattern**:
```typescript
import { app } from 'electron';
import path from 'node:path';

function getAutoSavePath(fileId: string): string {
  return path.join(app.getPath('temp'), `mdxpad-autosave-${fileId}.mdx`);
}
```

**Recovery flow**:
```typescript
import { promises as fs } from 'node:fs';
import { glob } from 'glob';

async function findRecoverableFiles(): Promise<string[]> {
  const pattern = path.join(app.getPath('temp'), 'mdxpad-autosave-*.mdx');
  return glob(pattern);
}
```

---

## Dependencies Summary

| Package | Version | Purpose |
|---------|---------|---------|
| electron | 39.2.7 | Shell, dialogs, IPC |
| chokidar | 5.0.0 | File watching |
| electron-store | 11.0.2 | Recent files persistence |
| zod | 4.3.5 | IPC payload validation |
| glob | 11.0.0 | Auto-save recovery file discovery |

---

## Constitution Compliance

All research decisions align with Constitution requirements:

| Section | Requirement | Decision |
|---------|-------------|----------|
| §3.1 | File ops in main process | ✓ All handlers in main |
| §3.1 | chokidar for watching | ✓ chokidar 5.0.0 |
| §3.3 | zod validation | ✓ safeParse on all IPC |
| §3.3 | invoke/handle pattern | ✓ ipcMain.handle |
| §7.3 | Auto-save every 30s | ✓ temp directory approach |
