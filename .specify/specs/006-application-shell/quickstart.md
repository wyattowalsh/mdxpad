# Quickstart Guide: Application Shell

**Branch**: `006-application-shell` | **Date**: 2026-01-10 | **Spec**: [spec.md](./spec.md)

---

## Prerequisites

Before implementing Application Shell, ensure these components are complete:

- [x] Spec 002 (Editor Core): MDXEditor with controlled value
- [x] Spec 003 (Preview Pane): PreviewFrame with source prop
- [x] Spec 004 (File System Shell): IPC handlers for file operations
- [x] Spec 005 (Command Palette): Command registration system

---

## Implementation Order

Follow this sequence for optimal dependencies:

```text
Phase 1: Core State
├── T001: Document store (Zustand + Immer)
├── T002: Extend UI layout store (splitRatio)
└── T003: File lifecycle commands

Phase 2: Shell Components
├── T004: StatusBar components (FileInfo, CursorPosition, ErrorCount)
├── T005: EditorPane wrapper
├── T006: Split-pane layout (App.tsx rewrite)
└── T007: Error click integration

Phase 3: Document Lifecycle
├── T008: Dirty check dialog (useDocumentLifecycle hook)
├── T009: Window close interception
├── T010: External modification detection
└── T011: Menu integration

Phase 4: Polish & Testing
├── T012: Integration tests
├── T013: E2E tests
└── T014: Performance validation
```

---

## Step 1: Create Document Store

**File**: `src/renderer/stores/document-store.ts`

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';
import type { DocumentId, DocumentState, FileHandle } from '@shared/types/document';

const initialState: DocumentState = {
  fileId: null,
  filePath: null,
  fileName: 'Untitled',
  content: '',
  savedContent: '',
  isDirty: false,
  lastKnownMtime: null,
};

export const useDocumentStore = create<DocumentStore>()(
  immer((set, get) => ({
    ...initialState,

    newDocument: () =>
      set((draft) => {
        Object.assign(draft, initialState);
        draft.fileId = uuidv4() as DocumentId;
      }),

    openDocument: (handle: FileHandle, content: string) =>
      set((draft) => {
        draft.fileId = handle.fileId;
        draft.filePath = handle.filePath;
        draft.fileName = handle.filePath.split('/').pop() ?? 'Untitled';
        draft.content = content;
        draft.savedContent = content;
        draft.isDirty = false;
        draft.lastKnownMtime = handle.mtime;
      }),

    updateContent: (content: string) =>
      set((draft) => {
        draft.content = content;
        draft.isDirty = content !== draft.savedContent;
      }),

    markSaved: (mtime?: number) =>
      set((draft) => {
        draft.savedContent = draft.content;
        draft.isDirty = false;
        if (mtime !== undefined) {
          draft.lastKnownMtime = mtime;
        }
      }),

    // ... other actions
  }))
);
```

**Key Points**:
- `isDirty` is computed from `content !== savedContent`
- No localStorage persistence (documents must be saved to disk)
- UUID generated on document creation for tracking

---

## Step 2: Extend UI Layout Store

**File**: `src/renderer/stores/ui-layout-store.ts`

Add splitRatio to existing store:

```typescript
// Add to state interface
interface UILayoutStoreState {
  // ... existing
  readonly splitRatio: number;
}

// Add to initial state
const initialState: UILayoutStoreState = {
  // ... existing
  splitRatio: 0.5,
};

// Add to actions
setSplitRatio: (ratio: number) =>
  set((draft) => {
    draft.splitRatio = Math.max(0.1, Math.min(0.9, ratio));
  }),

// Add to loadFromStorage
const splitRatioRaw = localStorage.getItem(SHELL_STORAGE_KEYS.splitRatio);
if (splitRatioRaw !== null) {
  const parsed = JSON.parse(splitRatioRaw);
  if (typeof parsed === 'number') {
    result.splitRatio = parseSplitRatio(parsed);
  }
}

// Add to persist (debounced)
localStorage.setItem(
  SHELL_STORAGE_KEYS.splitRatio,
  JSON.stringify(state.splitRatio)
);
```

---

## Step 3: Create File Lifecycle Commands

**File**: `src/renderer/commands/file-commands.ts`

```typescript
import type { CommandDefinition, CommandContext } from '@shared/types/commands';
import { useDocumentStore } from '../stores/document-store';

export const newFileCommand: CommandDefinition = {
  id: 'file.new',
  name: 'New File',
  category: 'file',
  shortcut: { key: 'n', modifiers: ['Mod'] },
  execute: async (ctx: CommandContext) => {
    const { isDirty, fileName } = useDocumentStore.getState();

    if (isDirty) {
      const result = await ctx.showDirtyCheckDialog({
        action: 'new',
        fileName,
      });

      if (result === 'cancel') return { ok: true };
      if (result === 'save') await ctx.saveDocument();
    }

    useDocumentStore.getState().newDocument();
    return { ok: true };
  },
};

export const openFileCommand: CommandDefinition = {
  id: 'file.open',
  name: 'Open File...',
  category: 'file',
  shortcut: { key: 'o', modifiers: ['Mod'] },
  execute: async (ctx: CommandContext) => {
    // Similar dirty check pattern
    // ...
    const result = await ctx.api.openFile();
    if (!result.ok) return result;

    const content = await ctx.api.readFile(result.value.path);
    if (!content.ok) return content;

    useDocumentStore.getState().openDocument(
      { fileId: result.value.fileId, filePath: result.value.path, mtime: result.value.mtime },
      content.value
    );
    return { ok: true };
  },
};

// saveFileCommand, saveFileAsCommand, closeWindowCommand...
```

---

## Step 4: Create StatusBar Component

**File**: `src/renderer/components/shell/StatusBar/StatusBar.tsx`

```typescript
import React from 'react';
import { FileInfo } from './FileInfo';
import { CursorPosition } from './CursorPosition';
import { ErrorCount } from './ErrorCount';
import type { StatusBarProps } from './types';

export function StatusBar({
  fileName,
  isDirty,
  cursorPosition,
  errorCount,
  onErrorClick,
}: StatusBarProps): React.ReactElement {
  return (
    <div className="flex h-6 items-center justify-between border-t bg-muted px-2 text-xs">
      <FileInfo fileName={fileName} isDirty={isDirty} />
      <div className="flex items-center gap-4">
        <CursorPosition line={cursorPosition.line} column={cursorPosition.column} />
        {errorCount > 0 && (
          <ErrorCount count={errorCount} onClick={onErrorClick} />
        )}
      </div>
    </div>
  );
}
```

**ErrorCount with Popover** (FR-031a):

```typescript
import { Popover, PopoverTrigger, PopoverContent } from '@ui/popover';

export function ErrorCount({ count, onClick, errors }: ErrorCountProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={onClick}
          className="flex items-center gap-1 text-destructive hover:underline"
          aria-label={`${count} compilation error${count === 1 ? '' : 's'}`}
        >
          <AlertCircle className="h-3 w-3" />
          {count}
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <ul className="text-sm">
          {errors.map((err, i) => (
            <li key={i}>Line {err.line}: {err.message}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
```

---

## Step 5: Create Split-Pane Layout

**File**: `src/renderer/App.tsx` (rewrite)

```typescript
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@ui/resizable';
import { useUILayoutStore } from './stores/ui-layout-store';
import { useDocumentStore } from './stores/document-store';
import { EditorPane } from './components/shell/EditorPane';
import { PreviewPane } from './components/shell/PreviewPane';
import { StatusBar } from './components/shell/StatusBar';
import { CommandPalette } from './components/CommandPalette';

export function App(): React.ReactElement {
  const { previewVisible, splitRatio, setSplitRatio } = useUILayoutStore();
  const { content, fileName, isDirty } = useDocumentStore();
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });

  const handleLayoutChange = useCallback((sizes: number[]) => {
    if (sizes[0]) {
      setSplitRatio(sizes[0] / 100);
    }
  }, [setSplitRatio]);

  return (
    <div className="flex h-screen flex-col">
      {/* Titlebar area for macOS traffic lights */}
      <div className="h-8 w-full" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      {/* Main content area */}
      <main className="flex-1 overflow-hidden">
        <ResizablePanelGroup
          direction="horizontal"
          onLayout={handleLayoutChange}
        >
          <ResizablePanel
            defaultSize={splitRatio * 100}
            minSize={10}
          >
            <EditorPane
              content={content}
              onContentChange={useDocumentStore.getState().updateContent}
              onCursorChange={setCursorPosition}
            />
          </ResizablePanel>

          {previewVisible && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel minSize={10}>
                <PreviewPane source={content} />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </main>

      {/* Status bar */}
      <StatusBar
        fileName={fileName}
        isDirty={isDirty}
        cursorPosition={cursorPosition}
        errorCount={/* from preview store */}
        onErrorClick={handleErrorClick}
      />

      {/* Command palette overlay */}
      <CommandPalette />
    </div>
  );
}
```

---

## Step 6: Implement Dirty Check Dialog

**File**: `src/renderer/hooks/useDocumentLifecycle.ts`

```typescript
import { useCallback } from 'react';
import { useDocumentStore } from '../stores/document-store';
import type { DirtyCheckResult, DirtyCheckOptions } from '../types';

export function useDocumentLifecycle(): UseDocumentLifecycleReturn {
  const showDirtyCheckDialog = useCallback(
    async (options: DirtyCheckOptions): Promise<DirtyCheckResult> => {
      // Use Electron dialog via IPC
      const result = await window.mdxpad.showMessageBox({
        type: 'question',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        message: `Do you want to save changes to "${options.fileName}"?`,
        detail: 'Your changes will be lost if you close without saving.',
      });

      switch (result.response) {
        case 0: return 'save';
        case 1: return 'discard';
        default: return 'cancel';
      }
    },
    []
  );

  const checkDirty = useCallback(
    async (options: DirtyCheckOptions): Promise<DirtyCheckResult> => {
      const { isDirty } = useDocumentStore.getState();
      if (!isDirty) return 'discard'; // No changes, proceed

      return showDirtyCheckDialog(options);
    },
    [showDirtyCheckDialog]
  );

  // handleNew, handleOpen, handleSave, handleSaveAs, handleClose...
  return { checkDirty, handleNew, handleOpen, handleSave, handleSaveAs, handleClose };
}
```

---

## Step 7: Window Close Interception

**File**: `src/main/index.ts`

```typescript
mainWindow.on('close', async (event) => {
  // Prevent default close
  event.preventDefault();

  // Ask renderer if there are unsaved changes
  const result = await mainWindow.webContents.invoke('mdxpad:document:check-dirty');

  if (result.shouldClose) {
    // User chose to proceed (saved or discarded)
    mainWindow.destroy();
  }
  // If result.shouldClose is false, user cancelled - window stays open
});
```

**File**: `src/preload/api.ts`

```typescript
// Expose handler for close check
contextBridge.exposeInMainWorld('mdxpad', {
  // ... existing
  onCloseRequested: (callback: () => Promise<{ shouldClose: boolean }>) => {
    ipcRenderer.on('mdxpad:window:close-requested', async () => {
      const result = await callback();
      ipcRenderer.send('mdxpad:window:close-response', result);
    });
  },
});
```

---

## Step 8: External Modification Detection

**File**: `src/main/index.ts`

```typescript
mainWindow.on('focus', async () => {
  // Check for external modifications
  mainWindow.webContents.send('mdxpad:window:focus');
});
```

**File**: `src/renderer/App.tsx`

```typescript
useEffect(() => {
  const unsubscribe = window.mdxpad.onWindowFocus(async () => {
    const { filePath, lastKnownMtime } = useDocumentStore.getState();
    if (!filePath || !lastKnownMtime) return;

    const check = await window.mdxpad.checkFileModification(filePath, lastKnownMtime);
    if (check.modified) {
      const reload = await window.mdxpad.showMessageBox({
        type: 'question',
        buttons: ['Reload', 'Keep Mine'],
        message: 'File has been modified',
        detail: `"${filePath}" has been changed by another program. Reload?`,
      });

      if (reload.response === 0) {
        const content = await window.mdxpad.readFile(filePath);
        if (content.ok) {
          useDocumentStore.getState().openDocument(
            { /* handle */ },
            content.value
          );
        }
      } else {
        // User chose to keep - update mtime to avoid repeat prompts
        useDocumentStore.getState().updateMtime(check.newMtime!);
      }
    }
  });

  return unsubscribe;
}, []);
```

---

## Testing Checklist

### Unit Tests (T012)

- [ ] Document store: newDocument, openDocument, updateContent, markSaved
- [ ] UI layout store: splitRatio persistence
- [ ] Dirty check logic: all action/result combinations
- [ ] File commands: new, open, save, saveAs

### Integration Tests (T012)

- [ ] Full document lifecycle: new → edit → save → close
- [ ] Dirty check flow: dirty document → close → save → confirm close
- [ ] External modification: modify file → focus window → prompt → reload

### E2E Tests (T013)

- [ ] Open app → see split pane layout
- [ ] Type content → preview updates
- [ ] Drag divider → ratio persists on reload
- [ ] Cmd+S on untitled → save dialog
- [ ] Close dirty document → dirty check dialog
- [ ] All keyboard shortcuts work

### Performance Validation (T014)

- [ ] Cold start < 2s
- [ ] No flash of default layout on startup
- [ ] Smooth 60fps divider dragging
- [ ] Status bar updates within 50ms

---

## Common Pitfalls

1. **Don't duplicate editor content in React state** - Use document store as single source of truth

2. **Don't use async for localStorage** - Sync load at module import time prevents flash

3. **Don't forget to persist splitRatio** - Add to existing persist() function with debounce

4. **Don't block on dirty check** - Return immediately if not dirty

5. **Don't watch files continuously** - Focus-based detection only (per spec clarification)

---

## Next Steps

After implementation:

1. Run `/speckit.tasks` to generate tasks.md
2. Create PR for review
3. Update CLAUDE.md with new technologies/patterns
