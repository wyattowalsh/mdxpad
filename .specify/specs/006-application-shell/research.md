# Research: Application Shell

**Branch**: `006-application-shell` | **Date**: 2026-01-10 | **Spec**: [spec.md](./spec.md)

---

## Summary

The Application Shell integrates existing components (MDXEditor, PreviewPane, CommandPalette, file operations) into a cohesive document-editing experience. Research confirms all major technical decisions are already established by existing patterns in the codebase.

---

## Technical Decision 1: Split-Pane Library

### Decision: Use `react-resizable-panels` (Already Installed)

**Status**: CONFIRMED - Library already in use

**Current State**:
- `react-resizable-panels` v4.1.0 installed in package.json
- UI wrapper exists at `src/renderer/components/ui/resizable.tsx`
- Exports: `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`

**Implementation Approach**:
```typescript
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@ui/resizable';

<ResizablePanelGroup direction="horizontal">
  <ResizablePanel defaultSize={50} minSize={10}> {/* 10% = ~100px min at 1000px width */}
    <Editor />
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={50} minSize={10}>
    <Preview />
  </ResizablePanel>
</ResizablePanelGroup>
```

**Features Needed** (all supported):
- `minSize` prop for FR-003 (100px minimum)
- `onLayout` callback for split ratio persistence
- Keyboard accessibility (built-in)
- Collapse support via `collapsible` + `collapsedSize` props

**Alternatives Considered**: None - library is already established in the codebase.

---

## Technical Decision 2: Settings Persistence

### Decision: Hybrid Approach (localStorage + electron-store)

**Status**: CONFIRMED - Pattern established

**Existing Pattern Documentation**: `.claude/workspace/results/research-settings-persistence-result.md`

| Storage Backend | Use For | Rationale |
|-----------------|---------|-----------|
| `localStorage` | Renderer-only UI state (panel visibility, zoom level, split ratio) | Synchronous, instant access, no IPC overhead |
| `electron-store` | Main process data (recent files, window bounds) | Atomic writes, JSON Schema validation, accessible from main process |

**Existing Implementations**:
- `src/renderer/stores/ui-layout-store.ts` - localStorage for `previewVisible`, `zoomLevel`
- `src/main/services/recent-files.ts` - electron-store for recent files

**New State for Spec 006**:
| Key | Storage | Location |
|-----|---------|----------|
| `splitRatio` | localStorage | Add to `ui-layout-store.ts` |
| `documentState` | Memory only | New `document-store.ts` (not persisted - documents must be saved explicitly) |

**Synchronous Initialization Pattern** (from existing `ui-layout-store.ts`):
```typescript
// Load at module import time, before any React render
function loadPersistedState(): Partial<State> { ... }
useStore.getState().loadFromStorage(); // Called synchronously on module load
```

This prevents flash of default state (FR-035, SC-003).

---

## Technical Decision 3: External File Modification Detection

### Decision: Focus-based detection (NOT continuous watching)

**Status**: NEW - Per spec clarification Q1

**Spec Requirement**:
> "Detect on window focus only (no continuous watching)" - Clarification Session 2026-01-10

**Existing Infrastructure**:
- `FileWatcher` service exists at `src/main/services/file-watcher.ts` using chokidar
- IPC channel `mdxpad:file:change` already defined
- **Note**: The existing FileWatcher uses continuous watching - this is for a different purpose (Spec 004)

**Implementation Approach for Spec 006**:

For focus-based detection, we need a simpler approach:

1. **On window focus** (in main process):
   - Check if open file's mtime has changed since last known state
   - If changed, send `mdxpad:file:external-change` event to renderer

2. **In renderer**:
   - Show dialog: "File has been modified. Reload from disk or keep current version?"
   - Options: "Reload" | "Keep Mine"

```typescript
// Main process - window focus handler
mainWindow.on('focus', async () => {
  const currentFile = getCurrentOpenFile();
  if (currentFile && currentFile.path) {
    const stat = await fs.stat(currentFile.path);
    if (stat.mtimeMs > currentFile.lastKnownMtime) {
      mainWindow.webContents.send('mdxpad:file:external-change', {
        path: currentFile.path,
        newMtime: stat.mtimeMs,
      });
    }
  }
});
```

**Why NOT use existing FileWatcher**:
- FileWatcher is designed for continuous watching (chokidar)
- Focus-based detection is simpler and sufficient per spec
- Avoids resource overhead of persistent file watchers
- Clearer separation: FileWatcher for Spec 004 features, focus-check for Spec 006

---

## Technical Decision 4: Document State Store

### Decision: New Zustand store with Immer (per Constitution Article II)

**Store Design**:
```typescript
// src/renderer/stores/document-store.ts
interface DocumentState {
  fileId: string | null;
  filePath: string | null;
  fileName: string;
  content: string;
  savedContent: string;
  isDirty: boolean; // derived: content !== savedContent
  lastKnownMtime: number | null; // for external modification detection
}

interface DocumentActions {
  newDocument(): void;
  openDocument(fileId: string, path: string, content: string, mtime: number): void;
  updateContent(content: string): void;
  markSaved(savedContent: string, mtime?: number): void;
  markClean(): void;
}
```

**Key Implementation Details**:
- `isDirty` computed by comparing `content !== savedContent` (not a separate flag)
- `savedContent` stores the content at last save point
- `lastKnownMtime` tracks file modification time for focus-based detection
- NOT persisted to localStorage (documents must be saved explicitly to disk)

---

## Technical Decision 5: Status Bar Component

### Decision: New StatusBar component with ErrorPopover

**Component Structure**:
```text
<StatusBar>
  <FileInfo fileName={} isDirty={} />
  <CursorPosition line={} column={} />
  <ErrorCount count={} onClick={} />
</StatusBar>
```

**Error Click Behavior** (per spec clarification Q3):
1. Jump cursor to first error line in editor
2. Show error details popover
3. Scroll preview to show error

**Integration Points**:
- Document store → FileInfo (fileName, isDirty)
- Editor → CursorPosition (via CodeMirror selection state)
- Preview store → ErrorCount (compilation errors)

---

## Technical Decision 6: Preview Compilation Timeout

### Decision: 3 second timeout (per spec clarification Q4)

**Implementation**:
```typescript
// In preview worker or compilation service
const COMPILATION_TIMEOUT = 3000; // 3 seconds per spec clarification

const compileWithTimeout = async (source: string) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Compilation timeout')), COMPILATION_TIMEOUT)
  );

  return Promise.race([
    compileMdx(source),
    timeoutPromise
  ]);
};
```

**Error State**:
- Show "Compilation timeout" error in preview pane
- Allow continued editing (non-blocking)
- Status bar shows error count

---

## Constitution Compliance Check

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| I | Security > Performance > UX | PASS | Focus-based detection over continuous watching |
| II | Zustand + Immer for state | PASS | Document store uses Zustand + Immer |
| II | TypeScript strict: true | PASS | All types fully defined |
| II | zod for validation | PASS | File operations validate with zod |
| III.2 | contextIsolation: true | PASS | No changes to Electron config |
| III.3 | IPC invoke/handle pattern | PASS | File operations use existing IPC |
| III.5 | Preview in sandboxed iframe | PASS | Existing pattern maintained |
| V | Cold start < 2s | TBD | No new heavy dependencies |
| V | Keystroke latency < 16ms | TBD | Document store is lightweight |
| V | Preview compile < 500ms | PASS | 3s timeout for edge cases only |
| VI.1 | JSDoc for public APIs | WILL COMPLY | |
| VI.2 | Functions < 50 lines | WILL COMPLY | |
| VI.4 | Unit coverage > 80% | WILL COMPLY | |
| VII.2 | Keyboard navigation | WILL COMPLY | All shortcuts defined in spec |
| VII.3 | Graceful error handling | PASS | Focus-based detection with fallbacks |

---

## Dependencies

| Dependency | Version | Purpose | Already Installed |
|------------|---------|---------|-------------------|
| react-resizable-panels | ^4.1.0 | Split-pane layout | YES |
| electron-store | 11.0.2 | Settings persistence | YES |
| zustand | ^5.0.0 | Document state | YES |
| immer | ^10.0.0 | Immutable updates | YES |

**No new dependencies required.**

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Split ratio persistence race condition | Debounce persist by 500ms |
| Focus-based detection false positives | Compare content hash, not just mtime |
| Document state loss on crash | Out of scope per spec; design does not preclude autosave |
| Preview timeout UX | Clear error state, allow retry via manual compile button |

---

## Next Steps

1. **Phase 1**: Generate data-model.md with TypeScript interfaces
2. **Phase 1**: Generate contracts/ with Zod schemas and API contracts
3. **Phase 1**: Generate quickstart.md with implementation guide
