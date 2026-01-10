# Data Model: Editor Core (002)

**Date**: 2026-01-09
**Feature**: CodeMirror 6 integration for MDX editing

## Entity Overview

This feature implements the editor layer, bridging the shared type contracts from Spec 001 with CodeMirror 6's internal state management.

```
┌─────────────────────────────────────────────────────────────┐
│                     Renderer Process                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 React Component                      │    │
│  │  ┌──────────────────────────────────────────────┐   │    │
│  │  │              useCodeMirror Hook               │   │    │
│  │  │  ┌────────────────────────────────────────┐  │   │    │
│  │  │  │         CodeMirror EditorView          │  │   │    │
│  │  │  │  ┌──────────────────────────────────┐  │  │   │    │
│  │  │  │  │       EditorState (CM)           │  │  │   │    │
│  │  │  │  │  - doc: Text                     │  │  │   │    │
│  │  │  │  │  - selection: SelectionRange     │  │  │   │    │
│  │  │  │  │  - extensions: Extension[]       │  │  │   │    │
│  │  │  │  └──────────────────────────────────┘  │  │   │    │
│  │  │  └────────────────────────────────────────┘  │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            Shared Types (Spec 001)                   │    │
│  │  - EditorState (opaque wrapper)                      │    │
│  │  - Selection, SelectionInfo                          │    │
│  │  - EditorConfig                                      │    │
│  │  - EditorChange                                      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Entities

### EditorState (from Spec 001 - READ-ONLY)

**Source**: `src/shared/types/editor.ts`

```typescript
export interface EditorState {
  readonly doc: string;
  readonly selection: Selection;
}
```

**Purpose**: Opaque wrapper exposing minimal editor state to external consumers.

**Relationship**: Created by mapping CodeMirror's internal `EditorState` to this simplified interface.

---

### Selection (from Spec 001 - READ-ONLY)

**Source**: `src/shared/types/editor.ts`

```typescript
export interface Selection {
  readonly anchor: number;
  readonly head: number;
}
```

**Purpose**: Represents cursor position or selection range.

**Fields**:
- `anchor`: Starting position of selection (where user started selecting)
- `head`: Current position (where cursor is now)

**Invariants**:
- `anchor >= 0`
- `head >= 0`
- Both are character offsets into the document

---

### SelectionInfo (from Spec 001 - READ-ONLY)

**Source**: `src/shared/types/editor.ts`

```typescript
export interface SelectionInfo {
  readonly from: number;
  readonly to: number;
  readonly empty: boolean;
}
```

**Purpose**: Computed properties for easier selection handling.

**Fields**:
- `from`: min(anchor, head)
- `to`: max(anchor, head)
- `empty`: true if from === to (cursor, no selection)

---

### EditorConfig (from Spec 001 - READ-ONLY)

**Source**: `src/shared/types/editor.ts`

```typescript
export interface EditorConfig {
  readonly initialDoc?: string;
  readonly readonly?: boolean;
  readonly lineNumbers?: boolean;
  readonly lineWrapping?: boolean;
  readonly tabSize?: number;
  readonly indentWithTabs?: boolean;
}
```

**Purpose**: Configuration passed to editor on initialization.

**Defaults** (per spec):
- `lineNumbers`: true
- `lineWrapping`: false
- `tabSize`: 2
- `indentWithTabs`: false

---

### EditorChange (from Spec 001 - READ-ONLY)

**Source**: `src/shared/types/editor.ts`

```typescript
export interface EditorChange {
  readonly fromA: number;
  readonly toA: number;
  readonly fromB: number;
  readonly toB: number;
  readonly inserted: string;
}
```

**Purpose**: Change event payload describing a document modification.

**Fields**:
- `fromA`, `toA`: Range in the old document that was replaced
- `fromB`, `toB`: Range in the new document where content was inserted
- `inserted`: The text that was inserted

---

## New Entities (This Spec)

### EditorError

**Purpose**: Structured error event for logging and external consumption (per Clarification).

```typescript
export interface EditorError {
  readonly type: 'syntax' | 'command' | 'extension';
  readonly message: string;
  readonly timestamp: number;
  readonly context?: Record<string, unknown>;
}
```

**Fields**:
- `type`: Category of error
  - `syntax`: Highlighting/parsing failure
  - `command`: Keyboard command execution failure
  - `extension`: Extension initialization or runtime failure
- `message`: Human-readable error description
- `timestamp`: Unix timestamp (ms) when error occurred
- `context`: Optional additional data for debugging

---

### EditorTheme

**Purpose**: Theme configuration for light/dark mode support.

```typescript
export type EditorTheme = 'light' | 'dark' | 'system';
```

**Behavior**:
- `light`: Always use light theme
- `dark`: Always use dark theme
- `system`: Follow `prefers-color-scheme` media query

---

### EditorCallbacks

**Purpose**: Callback configuration for editor events.

```typescript
export interface EditorCallbacks {
  readonly onChange?: (state: EditorState) => void;
  readonly onError?: (error: EditorError) => void;
  readonly onSelectionChange?: (selection: SelectionInfo) => void;
}
```

**Fields**:
- `onChange`: Called when document content changes (debounced)
- `onError`: Called when an error occurs
- `onSelectionChange`: Called when selection/cursor changes

---

### CodeMirrorExtensionConfig

**Purpose**: Internal configuration for CodeMirror extensions.

```typescript
export interface CodeMirrorExtensionConfig {
  readonly lineNumbers: boolean;
  readonly lineWrapping: boolean;
  readonly tabSize: number;
  readonly indentWithTabs: boolean;
  readonly highlightActiveLine: boolean;
  readonly bracketMatching: boolean;
  readonly closeBrackets: boolean;
  readonly indentationGuides: boolean;
  readonly theme: EditorTheme;
}
```

**Relationship**: Maps from `EditorConfig` with additional internal settings.

---

## State Transitions

### Editor Lifecycle

```
[Unmounted] ──create──> [Initializing] ──ready──> [Active] ──destroy──> [Unmounted]
                              │                       │
                              │                       │
                              └───error───> [Error] ──recover──> [Active]
```

**States**:
1. **Unmounted**: Component not in DOM
2. **Initializing**: EditorView being created, extensions loading
3. **Active**: Editor ready for input
4. **Error**: Error occurred (logged, emitted), attempting recovery
5. **Unmounted**: Cleanup complete

### Theme Switching

```
[Light] <──toggle──> [Dark]
   ▲                    ▲
   │                    │
   └──system change─────┘
              │
        [System Mode]
```

**Transitions**:
- Manual toggle: Immediate reconfigure via Compartment
- System change: Media query listener triggers reconfigure

---

## Validation Rules

### Document Content
- Must be valid UTF-8 string
- No maximum length enforced (performance may degrade at 10MB+)
- Empty string is valid

### Selection
- `anchor` and `head` must be >= 0
- `anchor` and `head` must be <= document length
- Invalid positions clamped to valid range

### Configuration
- `tabSize` must be positive integer (1-8 recommended)
- Invalid config values use defaults

---

## File Locations

New files created by this spec:

```
src/renderer/
├── components/
│   └── editor/
│       ├── MDXEditor.tsx           # React component
│       ├── MDXEditor.test.tsx      # Component tests
│       └── index.ts                # Public exports
├── hooks/
│   └── useCodeMirror/
│       ├── useCodeMirror.ts        # Core hook
│       ├── useCodeMirror.test.ts   # Hook tests
│       ├── extensions.ts           # Extension composition
│       ├── commands.ts             # Custom keyboard commands
│       ├── themes.ts               # Theme configuration
│       └── index.ts                # Public exports
└── lib/
    └── editor/
        ├── mdx-language.ts         # MDX language support
        ├── state-bridge.ts         # CM state to shared types
        ├── errors.ts               # Error handling
        └── index.ts                # Public exports
```
