# Research: Detecting External File Modifications on Window Focus

## Context

Building mdxpad, an MDX editor requiring detection of external file modifications when the application window regains focus. This is NOT continuous file watching (which already exists via chokidar in `file-watcher.ts`), but a focus-based check to detect changes that may have occurred while the app was in the background.

---

## Decision: Window Focus Event + fs.stat Comparison Pattern

**Approach**: On `BrowserWindow.focus` event, check each open file's modification time (`mtime`) against a stored baseline, then prompt the user with a modal dialog offering Reload/Keep options.

**Rationale**:
1. **Native Electron Support**: `BrowserWindow` emits `focus` and `blur` events natively - no additional dependencies required
2. **Minimal Resource Usage**: Only checks files on focus (no continuous polling or watching overhead)
3. **Industry Standard**: VS Code, IntelliJ, and other editors use this exact pattern
4. **Complements Existing Architecture**: Works alongside the existing `FileWatcher` (chokidar) which handles real-time watching; this handles the "missed changes while unfocused" case
5. **Simple Implementation**: Uses standard Node.js `fs.stat` which is already available in main process

---

## Alternatives Considered

### 1. Rely Solely on Existing FileWatcher (chokidar)
- **Pros**: Already implemented, handles real-time changes
- **Cons**: May miss changes if watcher is temporarily suspended/backlogged; doesn't cover edge cases where watcher events are lost
- **Decision**: Rejected as sole solution - use as complementary system

### 2. Hash-Based Comparison (Content Hashing)
- **Pros**: Detects actual content changes even if mtime is manipulated
- **Cons**: Requires reading entire file contents on every focus (expensive for large files); mtime comparison is sufficient for 99.9% of use cases
- **Decision**: Rejected - overkill for this use case

### 3. Polling-Based Approach
- **Pros**: Works without window focus events
- **Cons**: Wastes CPU cycles; already have chokidar for real-time watching
- **Decision**: Rejected - inefficient

### 4. File System Watcher Only (No Focus Check)
- **Pros**: Simpler architecture
- **Cons**: File watchers can miss events (especially on macOS with fsevents edge cases); focus check provides defense-in-depth
- **Decision**: Rejected - focus check adds robustness

---

## Implementation Notes

### 1. Detecting Window Focus Events in Electron

**Main Process (recommended approach)**:
```typescript
// In src/main/index.ts or window.ts
import { BrowserWindow, app } from 'electron';

// Option A: Per-window focus event
mainWindow.on('focus', () => {
  // Trigger file modification check
  checkOpenFilesForModifications();
});

// Option B: App-level event (for multi-window support)
app.on('browser-window-focus', (event, window) => {
  // Trigger file modification check for this window
  checkOpenFilesForModifications(window);
});
```

**Note**: The `BrowserWindow` `focus` event fires when the window gains keyboard focus, which is exactly the use case (user returns to app after being in another application).

### 2. Comparing File Modification Times with fs.stat

```typescript
import * as fs from 'node:fs/promises';

interface FileModificationInfo {
  fileId: string;
  path: string;
  lastKnownMtime: number;  // Unix timestamp in ms
}

async function checkFileModified(info: FileModificationInfo): Promise<'modified' | 'deleted' | 'unchanged'> {
  try {
    const stats = await fs.stat(info.path);
    const currentMtime = stats.mtimeMs;  // Millisecond precision

    if (currentMtime > info.lastKnownMtime) {
      return 'modified';
    }
    return 'unchanged';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 'deleted';
    }
    throw error;
  }
}
```

**Key API Details**:
- `fs.stat(path)` returns `Stats` object
- `stats.mtimeMs` - modification time in milliseconds (preferred for precision)
- `stats.mtime` - modification time as Date object
- Handle `ENOENT` error for deleted files

### 3. Where to Store Last Known Modification Time

**Recommended Location**: Extend the existing `FileServiceIntegration` class or create a dedicated `ModificationTracker` service in main process.

**Option A: Extend FileServiceIntegration (Recommended)**
```typescript
// In src/main/services/file-service.ts
export class FileServiceIntegration {
  private readonly openFiles = new Map<string, FileHandle>();
  private readonly fileMtimes = new Map<string, number>();  // NEW: fileId -> mtime

  async onFileOpened(handle: FileHandle): Promise<void> {
    this.openFiles.set(handle.id, handle);
    if (handle.path !== null) {
      const stats = await fs.stat(handle.path);
      this.fileMtimes.set(handle.id, stats.mtimeMs);
      // ... existing logic
    }
  }

  async onFileSaved(fileId: FileId, path: string): Promise<void> {
    const stats = await fs.stat(path);
    this.fileMtimes.set(fileId, stats.mtimeMs);
    // ... existing logic
  }

  getLastKnownMtime(fileId: FileId): number | undefined {
    return this.fileMtimes.get(fileId);
  }
}
```

**Option B: Dedicated ModificationTracker Service**
```typescript
// src/main/services/modification-tracker.ts
export class ModificationTracker {
  private readonly mtimes = new Map<string, number>();

  async recordMtime(fileId: string, path: string): Promise<void> {
    const stats = await fs.stat(path);
    this.mtimes.set(fileId, stats.mtimeMs);
  }

  getMtime(fileId: string): number | undefined {
    return this.mtimes.get(fileId);
  }

  clearMtime(fileId: string): void {
    this.mtimes.delete(fileId);
  }
}
```

**Storage Notes**:
- Keep mtime in memory (Map) - no persistence needed
- Update mtime on file open, file save, and after user chooses "Reload"
- Clear mtime on file close

### 4. UX Pattern for Reload/Keep Dialog

**Dialog Design (following VS Code/IntelliJ pattern)**:

```typescript
import { dialog, BrowserWindow } from 'electron';

interface FileModificationPromptResult {
  action: 'reload' | 'keep' | 'compare';  // compare is optional enhancement
}

async function promptFileModified(
  window: BrowserWindow,
  fileName: string,
  filePath: string
): Promise<FileModificationPromptResult> {
  const { response } = await dialog.showMessageBox(window, {
    type: 'question',
    buttons: ['Reload', 'Keep Current'],
    defaultId: 0,  // Reload is default (safer - preserves external changes)
    cancelId: 1,   // Keep Current on Escape
    title: 'File Changed Externally',
    message: `"${fileName}" has been modified outside the editor.`,
    detail: `Path: ${filePath}\n\nDo you want to reload the file from disk or keep your current changes?`,
  });

  return {
    action: response === 0 ? 'reload' : 'keep'
  };
}
```

**UX Considerations**:
- **Default to Reload**: External changes are usually intentional (git checkout, external tool, etc.)
- **Show File Name**: Clear identification of which file changed
- **Show Path**: For disambiguation when multiple files have same name
- **Non-blocking**: Dialog is modal to window but doesn't block the entire app
- **Keyboard accessible**: Escape = Keep Current, Enter = Reload

**Alternative: Non-modal Notification (Enhancement)**
For less intrusive UX, consider a toast/notification bar instead of modal dialog:
```
[File] document.mdx was modified externally. [Reload] [Dismiss]
```

### 5. Handling File Deletion

```typescript
async function promptFileDeleted(
  window: BrowserWindow,
  fileName: string,
  filePath: string
): Promise<'keep' | 'close'> {
  const { response } = await dialog.showMessageBox(window, {
    type: 'warning',
    buttons: ['Keep in Editor', 'Close File'],
    defaultId: 0,  // Keep is safer (preserves user's work)
    cancelId: 0,
    title: 'File Deleted',
    message: `"${fileName}" was deleted from disk.`,
    detail: `Path: ${filePath}\n\nThe file no longer exists. Keep it open in the editor (you can save it to restore), or close it?`,
  });

  return response === 0 ? 'keep' : 'close';
}
```

**Deletion Handling Notes**:
- Default to "Keep in Editor" - user may want to save their work
- Mark file as "untitled" or add visual indicator (e.g., strikethrough in tab)
- If user chooses to save after deletion, should trigger Save As dialog

---

## Integration Architecture

### Proposed Architecture

```
Window Focus Event (BrowserWindow)
        |
        v
+------------------+
| Focus Handler    | (main/services/focus-handler.ts or in index.ts)
+------------------+
        |
        v
+------------------+     +---------------------+
| For each open    |---->| fs.stat(path)       |
| file in registry |     | Compare with stored |
+------------------+     | mtime               |
        |                +---------------------+
        v
+------------------+
| If modified:     |
| Show dialog      |
+------------------+
        |
        v (on reload)
+------------------+     +---------------------+
| IPC to renderer  |---->| Renderer reloads    |
| mdxpad:file:     |     | content into editor |
| external-reload  |     +---------------------+
+------------------+
```

### New IPC Channels Needed

```typescript
// In src/shared/lib/ipc.ts
export const IPC_EVENTS = {
  // ... existing events

  /** File reload requested after external modification detected */
  fileExternalReload: 'mdxpad:file:external-reload',

  /** File deleted externally notification */
  fileExternalDelete: 'mdxpad:file:external-delete',
} as const;
```

### Relationship with Existing FileWatcher

The focus-based check complements (not replaces) the existing FileWatcher:

| Scenario | FileWatcher (chokidar) | Focus Check |
|----------|------------------------|-------------|
| File modified while app focused | Handles immediately | N/A |
| File modified while app unfocused | May handle (if watcher active) | Catches on return |
| Watcher event lost/delayed | Missed | Catches on focus |
| System sleep/resume | May miss events | Reliable on wake |

**Recommendation**: Keep both systems:
1. FileWatcher for real-time notification
2. Focus check for defense-in-depth and catching edge cases

---

## Edge Cases to Handle

1. **Multiple files modified**: Queue dialogs or show single dialog listing all files
2. **File modified AND has unsaved local changes**: Offer merge/diff option (enhancement)
3. **Very rapid focus/blur cycles**: Debounce focus events (500ms recommended)
4. **Network/remote files with clock skew**: Consider content hash fallback
5. **Large files**: fs.stat is fast (metadata only), no content reading needed
6. **Permission errors on stat**: Treat as "unchanged" with warning log

---

## Implementation Checklist

- [ ] Add `mtime` tracking to `FileServiceIntegration` or new tracker service
- [ ] Add focus event handler in main process
- [ ] Implement `checkOpenFilesForModifications()` function
- [ ] Add dialog prompts for modification and deletion cases
- [ ] Add IPC event for renderer to reload content
- [ ] Update mtime after reload
- [ ] Add debouncing for rapid focus cycles
- [ ] Handle file deletion case with appropriate UX
- [ ] Test with various modification scenarios
- [ ] Ensure works alongside existing FileWatcher

---

## References

- Electron BrowserWindow events: https://www.electronjs.org/docs/latest/api/browser-window#event-focus
- Node.js fs.stat: https://nodejs.org/api/fs.html#fsstatsyncpath-options
- VS Code file watching discussion: https://github.com/microsoft/vscode/issues/169942
- Existing mdxpad FileWatcher: `/Users/ww/dev/projects/mdxpad/src/main/services/file-watcher.ts`
- Existing FileServiceIntegration: `/Users/ww/dev/projects/mdxpad/src/main/services/file-service.ts`
