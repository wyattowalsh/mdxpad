# Data Model: Interface Contracts

**Branch**: `001-interface-contracts` | **Date**: 2025-12-30

## Overview

This document defines the data entities, their attributes, relationships, and state transitions for the Interface Contracts spec. These types form the foundation for all parallel development lanes.

---

## Entity Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Editor Domain                               │
├─────────────────────────────────────────────────────────────────────────┤
│  EditorState ──────── Selection                                          │
│       │                    │                                             │
│       ▼                    ▼                                             │
│  EditorConfig         SelectionInfo                                      │
│       │                                                                  │
│       ▼                                                                  │
│  EditorChange                                                            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                               File Domain                                │
├─────────────────────────────────────────────────────────────────────────┤
│  FileId (branded string)                                                 │
│       │                                                                  │
│       ▼                                                                  │
│  FileHandle ──────── FileState                                           │
│       │                    │                                             │
│       ▼                    ▼                                             │
│  FileResult<T> ───── FileError                                           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                             Preview Domain                               │
├─────────────────────────────────────────────────────────────────────────┤
│  CompileResult ═══════╦═══════ CompileSuccess                            │
│                       ║              │                                   │
│                       ╠═══════ CompileFailure ──── CompileError[]        │
│                       ║                                                  │
│  PreviewConfig        ║                                                  │
│       │               ║                                                  │
│       ▼               ▼                                                  │
│  PreviewState ════════╩════════════════════════                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                               UI Domain                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Theme ('light' | 'dark' | 'system')                                     │
│       │                                                                  │
│       ▼                                                                  │
│  ThemeConfig ──────── LayoutState ──────── PanelConstraints              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                               IPC Domain                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  IpcChannels (const) ──────── IpcChannel (type)                          │
│                                    │                                     │
│                                    ▼                                     │
│                               IpcApi (interface)                         │
│                                    │                                     │
│                                    ▼                                     │
│                           IpcHandler<C> (type helper)                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Entity Definitions

### Editor Domain

#### EditorState
Represents the current state of the CodeMirror editor.

| Field | Type | Description |
|-------|------|-------------|
| `doc` | `string` | Full document content |
| `selection` | `Selection` | Current cursor/selection position |

**Constraints**: Both fields are readonly.

#### Selection
Represents a selection range within the document.

| Field | Type | Description |
|-------|------|-------------|
| `anchor` | `number` | Fixed end of selection (where selection started) |
| `head` | `number` | Moving end of selection (current cursor position) |

**Constraints**: Both fields are non-negative integers. `anchor === head` indicates cursor with no selection.

#### SelectionInfo
Computed properties for a selection.

| Field | Type | Description |
|-------|------|-------------|
| `from` | `number` | Start of selection (min of anchor, head) |
| `to` | `number` | End of selection (max of anchor, head) |
| `empty` | `boolean` | True if anchor === head |

#### EditorConfig
Configuration for initializing an editor instance.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `initialDoc` | `string?` | `''` | Initial document content |
| `readonly` | `boolean?` | `false` | Disable editing |
| `lineNumbers` | `boolean?` | `true` | Show line numbers |
| `lineWrapping` | `boolean?` | `true` | Wrap long lines |
| `tabSize` | `number?` | `2` | Spaces per tab |
| `indentWithTabs` | `boolean?` | `false` | Use tabs for indentation |

#### EditorChange
Represents a document change event.

| Field | Type | Description |
|-------|------|-------------|
| `fromA` | `number` | Start position in old document |
| `toA` | `number` | End position in old document |
| `fromB` | `number` | Start position in new document |
| `toB` | `number` | End position in new document |
| `inserted` | `string` | Text that was inserted |

---

### File Domain

#### FileId
Branded string type for file identification.

| Property | Value |
|----------|-------|
| Base type | `string` |
| Brand | `__brand: 'FileId'` |
| Generation | UUID v4 via `createFileId()` |

**Purpose**: Prevents accidental use of arbitrary strings as file IDs.

#### FileHandle
Reference to a file (open or untitled).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `FileId` | Unique identifier |
| `path` | `string \| null` | File system path (null for untitled) |
| `name` | `string` | Display name (filename or "Untitled") |

**Invariants**:
- `path === null` implies untitled file
- `name` is derived from `path` if present, otherwise "Untitled"

#### FileState
Runtime state of an open file.

| Field | Type | Description |
|-------|------|-------------|
| `handle` | `FileHandle` | File reference |
| `content` | `string` | Current editor content |
| `savedContent` | `string` | Content at last save |
| `isDirty` | `boolean` | True if content !== savedContent |

**State Transitions**:
```
[New] ──open──► [Clean] ──edit──► [Dirty] ──save──► [Clean]
                   │                  │
                   └───── close ◄─────┘
```

#### FileError
Discriminated union of file operation errors.

| Code | Additional Fields | Description |
|------|-------------------|-------------|
| `NOT_FOUND` | `path: string` | File does not exist |
| `PERMISSION_DENIED` | `path: string` | Insufficient permissions |
| `CANCELLED` | - | User cancelled operation |
| `UNKNOWN` | `message: string` | Unexpected error |

---

### Preview Domain

#### CompileResult
Discriminated union of MDX compilation outcomes.

| Discriminator | Value | Type |
|---------------|-------|------|
| `ok: true` | Success | `CompileSuccess` |
| `ok: false` | Failure | `CompileFailure` |

#### CompileSuccess
Successful MDX compilation.

| Field | Type | Description |
|-------|------|-------------|
| `ok` | `true` | Discriminator |
| `code` | `string` | Compiled JavaScript code |
| `frontmatter` | `Record<string, unknown>` | Parsed YAML front matter |

#### CompileFailure
Failed MDX compilation.

| Field | Type | Description |
|-------|------|-------------|
| `ok` | `false` | Discriminator |
| `errors` | `CompileError[]` | List of compilation errors |

#### CompileError
Individual compilation error.

| Field | Type | Description |
|-------|------|-------------|
| `message` | `string` | Human-readable error message |
| `line` | `number?` | Line number (1-indexed) |
| `column` | `number?` | Column number (1-indexed) |
| `source` | `string?` | Source snippet |

#### PreviewConfig
Configuration for preview rendering.

| Field | Type | Description |
|-------|------|-------------|
| `debounceMs` | `number` | Recompile debounce delay |
| `components` | `Record<string, unknown>` | MDX component overrides |

#### PreviewState
Current state of the preview pane.

| Status | Additional Fields | Description |
|--------|-------------------|-------------|
| `idle` | - | No compilation in progress |
| `compiling` | - | Compilation running |
| `success` | `result: CompileSuccess` | Last compilation succeeded |
| `error` | `errors: CompileError[]` | Last compilation failed |

---

### UI Domain

#### Theme
Theme selection value.

| Value | Description |
|-------|-------------|
| `'light'` | Force light theme |
| `'dark'` | Force dark theme |
| `'system'` | Follow OS preference |

#### ThemeConfig
Theme configuration state.

| Field | Type | Description |
|-------|------|-------------|
| `theme` | `Theme` | User's theme selection |
| `resolvedTheme` | `'light' \| 'dark'` | Actual theme after resolving 'system' |

#### LayoutState
Application layout configuration.

| Field | Type | Description |
|-------|------|-------------|
| `sidebarVisible` | `boolean` | Sidebar panel visible |
| `sidebarWidth` | `number` | Sidebar width in pixels |
| `previewVisible` | `boolean` | Preview panel visible |
| `previewWidth` | `number` | Preview width in pixels |

#### PanelConstraints
Constraints for resizable panels.

| Field | Type | Description |
|-------|------|-------------|
| `minSize` | `number` | Minimum size in pixels |
| `maxSize` | `number` | Maximum size in pixels |
| `defaultSize` | `number` | Initial size in pixels |

---

### IPC Domain

#### IpcChannels
Const object defining all IPC channel names.

| Domain | Channel | Full Name |
|--------|---------|-----------|
| file | open | `mdxpad:file:open` |
| file | save | `mdxpad:file:save` |
| file | save-as | `mdxpad:file:save-as` |
| file | read | `mdxpad:file:read` |
| file | write | `mdxpad:file:write` |
| window | close | `mdxpad:window:close` |
| window | minimize | `mdxpad:window:minimize` |
| window | maximize | `mdxpad:window:maximize` |
| app | version | `mdxpad:app:version` |
| app | ready | `mdxpad:app:ready` |

#### IpcApi
Type-safe interface mapping channels to handler signatures.

See `contracts/ipc-api.ts` for full type definitions.

---

## Validation Rules

1. **FileId**: Must be valid UUID v4 format
2. **Selection positions**: Must be non-negative integers within document bounds
3. **Panel sizes**: Must be within min/max constraints
4. **IPC channels**: Must be one of defined IpcChannel values

---

## Cross-Domain Relationships

```
FileState.content ←──syncs──► EditorState.doc
         │
         └──── triggers ────► CompileResult (via Preview lane)
                                    │
                                    ▼
                              PreviewState.result/errors
```

The Editor lane updates `FileState.content`, which triggers Preview lane recompilation. This relationship is managed via the `TypedEventEmitter` utility.
