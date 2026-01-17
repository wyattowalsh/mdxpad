# Data Model: Application Shell

**Branch**: `006-application-shell` | **Date**: 2026-01-10 | **Spec**: [spec.md](./spec.md)

---

## Overview

The Application Shell data model consists of three distinct domains:

1. **Document State** - Current file, content, dirty status (domain state)
2. **UI Layout State** - Split ratio, panel visibility (UI state, persisted)
3. **Status Bar State** - Derived display information (computed)

This separation follows the Constitution requirement for clear separation between domain and UI state.

---

## Entity Relationship Diagram

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION STATE                              │
├───────────────────────┬─────────────────────┬───────────────────────────┤
│    Document Store     │   UI Layout Store   │      Preview Store        │
│    (domain state)     │    (UI state)       │   (existing - read only)  │
├───────────────────────┼─────────────────────┼───────────────────────────┤
│ • fileId              │ • previewVisible    │ • compilationErrors       │
│ • filePath            │ • sidebarVisible    │ • isCompiling             │
│ • fileName            │ • zoomLevel         │                           │
│ • content             │ • splitRatio  [NEW] │                           │
│ • savedContent        │                     │                           │
│ • isDirty (derived)   │                     │                           │
│ • lastKnownMtime      │                     │                           │
└───────────────────────┴─────────────────────┴───────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          STATUS BAR (derived)                            │
├─────────────────────────────────────────────────────────────────────────┤
│ • displayName: fileName || "Untitled"                                    │
│ • dirtyIndicator: isDirty                                               │
│ • cursorPosition: { line, column } (from CodeMirror)                    │
│ • errorCount: compilationErrors.length (from Preview Store)             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Core Types

### Document State

```typescript
// src/shared/types/document.ts

/**
 * Unique identifier for a document instance.
 * Uses UUID v4 format for tracking document lifecycle.
 */
export type DocumentId = string & { readonly __brand: 'DocumentId' };

/**
 * Represents the current state of the open document.
 * This is the source of truth for all document-related operations.
 */
export interface DocumentState {
  /**
   * Unique identifier for this document instance.
   * Generated on new/open, used for tracking and file watcher association.
   */
  readonly fileId: DocumentId | null;

  /**
   * Absolute path to the file on disk.
   * null for untitled/unsaved documents.
   */
  readonly filePath: string | null;

  /**
   * Display name for the document.
   * Derived from filePath basename or "Untitled" if null.
   */
  readonly fileName: string;

  /**
   * Current content in the editor.
   * Updated on every keystroke (via controlled component).
   */
  readonly content: string;

  /**
   * Content at the time of last save.
   * Used to compute isDirty state.
   */
  readonly savedContent: string;

  /**
   * Whether the document has unsaved changes.
   * Computed: content !== savedContent
   */
  readonly isDirty: boolean;

  /**
   * Last known modification time of the file on disk.
   * Used for focus-based external modification detection.
   * null for untitled documents.
   */
  readonly lastKnownMtime: number | null;
}

/**
 * File handle information returned from file operations.
 */
export interface FileHandle {
  /** Document identifier */
  readonly fileId: DocumentId;
  /** Absolute file path */
  readonly filePath: string;
  /** File modification time in milliseconds */
  readonly mtime: number;
}

/**
 * Result of checking for external file modification.
 */
export interface ExternalModificationCheck {
  /** Whether the file was modified externally */
  readonly modified: boolean;
  /** New modification time if modified */
  readonly newMtime: number | null;
}
```

### Document Store Actions

```typescript
// src/renderer/stores/document-store.ts

/**
 * Actions available on the document store.
 */
export interface DocumentStoreActions {
  /**
   * Create a new untitled document.
   * Resets all state to initial values.
   */
  newDocument(): void;

  /**
   * Open an existing document from disk.
   * @param handle - File handle from file operation
   * @param content - File content
   */
  openDocument(handle: FileHandle, content: string): void;

  /**
   * Update the document content.
   * Called on every editor change.
   * @param content - New content string
   */
  updateContent(content: string): void;

  /**
   * Mark the document as saved.
   * Updates savedContent and clears isDirty.
   * @param mtime - New modification time from save operation
   */
  markSaved(mtime?: number): void;

  /**
   * Update the file handle after save-as.
   * @param handle - New file handle
   */
  updateFileHandle(handle: FileHandle): void;

  /**
   * Update the last known mtime after external modification check.
   * @param mtime - New modification time
   */
  updateMtime(mtime: number): void;

  /**
   * Get current state snapshot (for dirty check dialogs).
   */
  getSnapshot(): DocumentState;
}

/**
 * Combined document store type.
 */
export type DocumentStore = DocumentState & DocumentStoreActions;
```

### UI Layout State (Extended)

```typescript
// src/renderer/stores/ui-layout-store.ts (additions)

/**
 * Extended UI layout state with split ratio.
 */
export interface UILayoutStoreState {
  /** Whether preview pane is visible */
  readonly previewVisible: boolean;
  /** Whether sidebar is visible (future use) */
  readonly sidebarVisible: boolean;
  /** Current zoom level (50-200) */
  readonly zoomLevel: number;
  /** Split ratio between editor and preview (0-1) - NEW */
  readonly splitRatio: number;
}

/**
 * Extended UI layout actions with split ratio.
 */
export interface UILayoutStoreActions {
  // ... existing actions ...

  /**
   * Set the split ratio between editor and preview panes.
   * @param ratio - Value between 0.1 and 0.9 (enforces minimum pane size)
   */
  setSplitRatio(ratio: number): void;
}
```

### Status Bar State (Derived)

```typescript
// src/renderer/components/shell/StatusBar/types.ts

/**
 * Cursor position in the editor.
 * Line and column are 1-indexed for display.
 */
export interface CursorPosition {
  /** Line number (1-indexed) */
  readonly line: number;
  /** Column number (1-indexed) */
  readonly column: number;
}

/**
 * Props for the StatusBar component.
 * All values are derived from stores; StatusBar is a pure display component.
 */
export interface StatusBarProps {
  /** Document filename or "Untitled" */
  readonly fileName: string;
  /** Whether document has unsaved changes */
  readonly isDirty: boolean;
  /** Current cursor position */
  readonly cursorPosition: CursorPosition;
  /** Number of compilation errors */
  readonly errorCount: number;
  /** Callback when error count is clicked */
  readonly onErrorClick: () => void;
}

/**
 * Single error entry for error popover display.
 */
export interface CompilationError {
  /** Error message */
  readonly message: string;
  /** Line number where error occurred (1-indexed) */
  readonly line: number;
  /** Column number where error occurred (1-indexed) */
  readonly column: number;
}
```

### Dirty Check Dialog

```typescript
// src/renderer/hooks/useDocumentLifecycle.ts

/**
 * Result of a dirty check prompt.
 */
export type DirtyCheckResult = 'save' | 'discard' | 'cancel';

/**
 * Options for dirty check dialog.
 */
export interface DirtyCheckOptions {
  /** Action being performed (for dialog message) */
  readonly action: 'close' | 'open' | 'new';
  /** Document filename for display */
  readonly fileName: string;
}

/**
 * Hook return type for document lifecycle management.
 */
export interface UseDocumentLifecycleReturn {
  /**
   * Check if document is dirty and prompt user if needed.
   * @param options - Dialog options
   * @returns User's choice, or 'cancel' if dialog dismissed
   */
  checkDirty(options: DirtyCheckOptions): Promise<DirtyCheckResult>;

  /**
   * Create a new document (with dirty check).
   */
  handleNew(): Promise<void>;

  /**
   * Open a file (with dirty check).
   */
  handleOpen(): Promise<void>;

  /**
   * Save the current document.
   * Shows save-as dialog if untitled.
   */
  handleSave(): Promise<void>;

  /**
   * Save the current document to a new location.
   */
  handleSaveAs(): Promise<void>;

  /**
   * Close the window (with dirty check).
   */
  handleClose(): Promise<void>;
}
```

### External File Modification

```typescript
// src/preload/api.ts (additions)

/**
 * Event payload for external file modification detection.
 */
export interface ExternalFileChangeEvent {
  /** Path to the modified file */
  readonly path: string;
  /** New modification time */
  readonly newMtime: number;
}

/**
 * Extended mdxpad API for Application Shell.
 */
export interface MdxpadApiExtensions {
  /**
   * Subscribe to external file modification events.
   * Called when window gains focus and open file has changed.
   * @param callback - Handler for external change events
   * @returns Unsubscribe function
   */
  onExternalFileChange(callback: (event: ExternalFileChangeEvent) => void): () => void;

  /**
   * Check if a file has been modified since the given mtime.
   * @param filePath - Path to check
   * @param lastKnownMtime - Last known modification time
   * @returns Modification check result
   */
  checkFileModification(filePath: string, lastKnownMtime: number): Promise<ExternalModificationCheck>;
}
```

---

## State Transitions

### Document Lifecycle

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        DOCUMENT STATE MACHINE                            │
└─────────────────────────────────────────────────────────────────────────┘

                            ┌──────────┐
                            │  EMPTY   │ (app start)
                            └────┬─────┘
                                 │ newDocument()
                                 ▼
                         ┌──────────────┐
              ┌──────────│  UNTITLED    │◄─────────────────┐
              │          │  (clean)     │                  │
              │          └──────┬───────┘                  │
              │                 │ updateContent()          │
              │                 ▼                          │
              │          ┌──────────────┐                  │
              │          │  UNTITLED    │                  │
              │          │  (dirty)     │                  │
              │          └──────┬───────┘                  │
              │                 │ handleSave() → saveAs    │
              │                 ▼                          │
              │          ┌──────────────┐                  │
              │          │   SAVED      │◄─────────────────┤
              │          │  (clean)     │                  │
              │          └──────┬───────┘                  │
              │                 │ updateContent()          │
              │                 ▼                          │
              │          ┌──────────────┐                  │
              │          │   SAVED      │──────────────────┘
              │          │  (dirty)     │ handleSave()
              │          └──────────────┘
              │
              │ openDocument()
              ▼
       ┌──────────────┐
       │   SAVED      │
       │  (clean)     │
       └──────────────┘
```

### Dirty Check Flow

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        DIRTY CHECK FLOW                                  │
└─────────────────────────────────────────────────────────────────────────┘

User triggers: Close/Open/New
         │
         ▼
    ┌─────────┐
    │ isDirty │───NO───▶ Proceed with action
    └────┬────┘
         │YES
         ▼
   ┌───────────────────────────────────────┐
   │ Dialog: "Save changes to {fileName}?" │
   │ [Save] [Don't Save] [Cancel]          │
   └───────────────────────────────────────┘
         │
    ┌────┴────┬──────────────┐
    ▼         ▼              ▼
  [Save]   [Don't Save]   [Cancel]
    │         │              │
    ▼         │              │
handleSave() │              │
    │         │              │
    ▼         ▼              ▼
Proceed   Proceed      Stay in current
with      with         state (no action)
action    action
```

---

## Persistence Strategy

| Data | Storage | Load Time | Persist Time |
|------|---------|-----------|--------------|
| `splitRatio` | localStorage | Module import (sync) | On change (debounced 500ms) |
| `previewVisible` | localStorage | Module import (sync) | On change (debounced 500ms) |
| `zoomLevel` | localStorage | Module import (sync) | On change (debounced 500ms) |
| `recentFiles` | electron-store | On demand (async) | On file open/save |
| Document content | NOT persisted | N/A | User must save explicitly |

---

## Validation Constraints

| Field | Constraint | Validation |
|-------|------------|------------|
| `splitRatio` | 0.1 - 0.9 | Clamp on set |
| `zoomLevel` | 50 - 200 | Clamp on set |
| `filePath` | Valid absolute path | zod path validation |
| `content` | No size limit | N/A (trust 3s timeout) |
| `mtime` | Positive number | zod positive number |

---

## Integration Points

| Component | Reads From | Writes To |
|-----------|------------|-----------|
| Editor (CodeMirror) | documentStore.content | documentStore.updateContent() |
| Preview (iframe) | documentStore.content | previewStore.errors |
| StatusBar | documentStore, previewStore | N/A (display only) |
| CommandPalette | documentStore (for context) | documentStore (via commands) |
| File Commands | documentStore | documentStore, file system |
| Menu | N/A | Triggers commands |
