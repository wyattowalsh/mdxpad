# Feature Specification: Interface Contracts

**Feature Branch**: `001-interface-contracts`
**Created**: 2025-12-30
**Status**: Draft
**Input**: User description: "Spec 000.5: Interface Contracts - Pre-declare all cross-lane interfaces, types, and dependencies enabling parallel development"

## Overview

This specification pre-declares **all** cross-lane interfaces, types, and dependencies. Completing this spec enables three parallel development lanes (Editor, Shell, Preview) to proceed without merge conflicts.

### Objectives

1. Populate stub files created in Spec 000 with actual type definitions and contracts
2. Install all dependencies that parallel development lanes will need
3. Make these files **READ-ONLY** for parallel lanes after completion

### Technology Stack Additions

**Editor Lane Dependencies:**
- `@codemirror/state` ^6.5.x - Editor state management
- `@codemirror/view` ^6.36.x - Editor view layer
- `@codemirror/commands` ^6.8.x - Editor commands
- `@codemirror/language` ^6.10.x - Language support infrastructure
- `@codemirror/autocomplete` ^6.18.x - Autocompletion
- `@codemirror/lint` ^6.8.x - Linting infrastructure
- `@codemirror/search` ^6.5.x - Search functionality
- `@codemirror/lang-markdown` ^6.3.x - Markdown language support
- `@codemirror/lang-javascript` ^6.2.x - JavaScript/JSX support for MDX
- `@lezer/highlight` ^1.2.x - Syntax highlighting

**Preview Lane Dependencies:**
- `@mdx-js/mdx` ^3.1.x - MDX compilation
- `@mdx-js/react` ^3.1.x - React integration for MDX
- `react` ^19.2.x - React runtime
- `react-dom` ^19.2.x - React DOM renderer
- `remark-gfm` ^4.0.x - GitHub Flavored Markdown
- `remark-frontmatter` ^5.0.x - Frontmatter parsing
- `rehype-highlight` ^7.0.x - Syntax highlighting in preview

**UI Framework (Shared):**
- `tailwindcss` ^4.1.x - Utility-first CSS
- `@radix-ui/react-slot` ^1.2.x - Component composition
- `class-variance-authority` ^0.7.x - Variant management
- `clsx` ^2.1.x - Class name utility
- `tailwind-merge` ^3.3.x - Tailwind class merging
- `lucide-react` ^0.514.x - Icons
- `cmdk` ^1.1.x - Command palette

**shadcn/ui Components (to install via CLI):**
- `button`, `input`, `textarea`, `label`
- `dialog`, `dropdown-menu`, `popover`, `tooltip`
- `tabs`, `scroll-area`, `separator`
- `command` (uses cmdk)
- `resizable` (for split panes)

**Build/Dev Dependencies:**
- `@tailwindcss/vite` ^4.1.x - Vite plugin for Tailwind
- `@types/react` ^19.1.x - React type definitions
- `@types/react-dom` ^19.1.x - React DOM type definitions

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editor Lane Developer (Priority: P1)

As a developer on the Editor lane, I need stable type definitions for editor state, selections, and commands so I can implement CodeMirror integration without waiting for other lanes.

**Why this priority**: Editor lane is the core feature - all other lanes depend on it producing content.

**Independent Test**: Can fully test by importing types and creating mock implementations that compile without errors.

**Acceptance Scenarios**:

1. **Given** a fresh clone of the repo, **When** I import from `@shared/types/editor`, **Then** I get complete type definitions for EditorState, Selection, Command, and EditorConfig
2. **Given** the editor types are imported, **When** I implement a CodeMirror wrapper, **Then** the types guide correct usage without runtime type errors

---

### User Story 2 - Shell Lane Developer (Priority: P1)

As a developer on the Shell lane (File System), I need stable type definitions for file handles, file state, and IPC contracts so I can implement file operations without coordination overhead.

**Why this priority**: File system is essential for loading and saving user work.

**Independent Test**: Can verify by importing types and implementing mock file system operations.

**Acceptance Scenarios**:

1. **Given** the types are defined, **When** I import `FileHandle` and `FileState` from `@shared/types`, **Then** I can implement file operations with full type safety
2. **Given** IPC contracts are defined, **When** I implement main process handlers, **Then** TypeScript validates my channel names and payload shapes

---

### User Story 3 - Preview Lane Developer (Priority: P1)

As a developer on the Preview lane, I need stable type definitions for MDX compilation results and preview configuration so I can implement the preview pane independently.

**Why this priority**: Preview provides real-time feedback essential for the MDX editing experience.

**Independent Test**: Can verify by importing types and implementing mock MDX compilation that type-checks.

**Acceptance Scenarios**:

1. **Given** compilation result types exist, **When** I implement MDX compilation, **Then** I can discriminate between success and failure cases with full type safety
2. **Given** preview config types exist, **When** I implement preview rendering, **Then** TypeScript ensures I handle all configuration options

---

### User Story 4 - UI Developer (Priority: P2)

As a developer working on any lane's UI, I need shadcn/ui components and theme utilities available so I can build consistent interfaces without installing packages mid-development.

**Why this priority**: Consistent UI across lanes improves user experience but doesn't block core functionality.

**Independent Test**: Can verify by importing UI components and rendering them without errors.

**Acceptance Scenarios**:

1. **Given** shadcn/ui is configured, **When** I import Button or Dialog, **Then** they render correctly with Tailwind styling
2. **Given** theme types are defined, **When** I implement theme switching, **Then** TypeScript validates theme values

---

### User Story 5 - Integration Developer (Priority: P2)

As a developer merging lanes, I need all interfaces to match exactly so merges are mechanical rather than requiring design decisions.

**Why this priority**: Enables parallel development which multiplies team velocity.

**Independent Test**: Can verify by running type-check across all lanes and confirming no conflicts.

**Acceptance Scenarios**:

1. **Given** all lanes import the same types, **When** lanes are merged, **Then** no type conflicts occur
2. **Given** IPC contracts are pre-defined, **When** main and renderer are integrated, **Then** communication works without runtime errors

---

### Edge Cases

- What happens when a lane needs a type not pre-declared? → Create a `_local/types.ts` in their lane, propose upstream after merge
- How does system handle version mismatches in dependencies? → pnpm lockfile ensures exact versions across all lanes

---

## Requirements *(mandatory)*

### File Ownership Declaration

After this spec completes, the following files are **READ-ONLY** for parallel lanes:

| File | Owner | Consumers |
|------|-------|-----------|
| `src/shared/types/editor.ts` | This spec | Editor, Preview |
| `src/shared/types/file.ts` | This spec | Shell, Editor |
| `src/shared/types/preview.ts` | This spec | Preview, Editor |
| `src/shared/types/ipc.ts` | This spec | Main, All Renderers |
| `src/shared/types/ui.ts` | This spec | All Lanes |
| `src/shared/types/index.ts` | This spec | All |
| `src/shared/lib/result.ts` | This spec | All |
| `src/shared/lib/events.ts` | This spec | All |
| `src/shared/lib/utils.ts` | This spec | All |
| `package.json` (dependencies only) | This spec | All |
| `tailwind.config.ts` | This spec | All |
| `src/renderer/styles/` | This spec | All |
| `components.json` | This spec | All |
| `src/renderer/components/ui/` | This spec | All |

**Parallel lanes MAY NOT modify these files.** They may only import from them.

---

### Functional Requirements

#### R1: Editor Types (`src/shared/types/editor.ts`)

System MUST provide the following type definitions:

```typescript
/** Opaque wrapper for CodeMirror EditorState */
export interface EditorState {
  readonly doc: string;
  readonly selection: Selection;
}

/** Selection range within the document */
export interface Selection {
  readonly anchor: number;
  readonly head: number;
}

/** Computed selection properties */
export interface SelectionInfo {
  readonly from: number;
  readonly to: number;
  readonly empty: boolean;
}

/** Editor command signature */
export type Command = (state: EditorState) => EditorState | null;

/** Editor configuration */
export interface EditorConfig {
  readonly initialDoc?: string;
  readonly readonly?: boolean;
  readonly lineNumbers?: boolean;
  readonly lineWrapping?: boolean;
  readonly tabSize?: number;
  readonly indentWithTabs?: boolean;
}

/** Editor change event payload */
export interface EditorChange {
  readonly fromA: number;
  readonly toA: number;
  readonly fromB: number;
  readonly toB: number;
  readonly inserted: string;
}
```

---

#### R2: File Types (`src/shared/types/file.ts`)

System MUST provide:

```typescript
/** Unique identifier for an open file */
export type FileId = string & { readonly __brand: 'FileId' };

/** Create a new FileId */
export function createFileId(): FileId;

/** Handle to a file (may be untitled) */
export interface FileHandle {
  readonly id: FileId;
  readonly path: string | null; // null for untitled files
  readonly name: string;
}

/** Runtime state of an open file */
export interface FileState {
  readonly handle: FileHandle;
  readonly content: string;
  readonly savedContent: string; // Content at last save
  readonly isDirty: boolean;
}

/** Result of a file operation */
export type FileResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: FileError };

/** File operation errors */
export type FileError =
  | { readonly code: 'NOT_FOUND'; readonly path: string }
  | { readonly code: 'PERMISSION_DENIED'; readonly path: string }
  | { readonly code: 'CANCELLED' }
  | { readonly code: 'UNKNOWN'; readonly message: string };
```

---

#### R3: Preview Types (`src/shared/types/preview.ts`)

System MUST provide:

```typescript
/** MDX compilation result */
export type CompileResult = CompileSuccess | CompileFailure;

export interface CompileSuccess {
  readonly ok: true;
  readonly code: string; // Compiled JavaScript
  readonly frontmatter: Record<string, unknown>;
}

export interface CompileFailure {
  readonly ok: false;
  readonly errors: CompileError[];
}

export interface CompileError {
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly source?: string;
}

/** Preview configuration */
export interface PreviewConfig {
  readonly debounceMs: number;
  readonly components: Record<string, unknown>; // Component overrides
}

/** Preview state */
export type PreviewState =
  | { readonly status: 'idle' }
  | { readonly status: 'compiling' }
  | { readonly status: 'success'; readonly result: CompileSuccess }
  | { readonly status: 'error'; readonly errors: CompileError[] };
```

---

#### R4: IPC Types (`src/shared/types/ipc.ts`)

System MUST provide typed IPC contracts:

```typescript
/** All IPC channel names (per Constitution Article III.3: mdxpad:domain:action) */
export const IpcChannels = {
  // File operations
  FILE_OPEN: 'mdxpad:file:open',
  FILE_SAVE: 'mdxpad:file:save',
  FILE_SAVE_AS: 'mdxpad:file:save-as',
  FILE_READ: 'mdxpad:file:read',
  FILE_WRITE: 'mdxpad:file:write',

  // Window operations
  WINDOW_CLOSE: 'mdxpad:window:close',
  WINDOW_MINIMIZE: 'mdxpad:window:minimize',
  WINDOW_MAXIMIZE: 'mdxpad:window:maximize',

  // App info
  APP_VERSION: 'mdxpad:app:version',
  APP_READY: 'mdxpad:app:ready',
} as const;

export type IpcChannel = typeof IpcChannels[keyof typeof IpcChannels];

/** Type-safe IPC invoke/handle signatures */
export interface IpcApi {
  // File operations
  [IpcChannels.FILE_OPEN]: () => Promise<FileResult<FileHandle>>;
  [IpcChannels.FILE_SAVE]: (handle: FileHandle, content: string) => Promise<FileResult<void>>;
  [IpcChannels.FILE_SAVE_AS]: (content: string) => Promise<FileResult<FileHandle>>;
  [IpcChannels.FILE_READ]: (path: string) => Promise<FileResult<string>>;
  [IpcChannels.FILE_WRITE]: (path: string, content: string) => Promise<FileResult<void>>;

  // Window operations
  [IpcChannels.WINDOW_CLOSE]: () => Promise<void>;
  [IpcChannels.WINDOW_MINIMIZE]: () => Promise<void>;
  [IpcChannels.WINDOW_MAXIMIZE]: () => Promise<void>;

  // App info
  [IpcChannels.APP_VERSION]: () => Promise<string>;
}

/** Type helper for implementing handlers */
export type IpcHandler<C extends IpcChannel> = IpcApi[C];
```

---

#### R5: UI Types (`src/shared/types/ui.ts`)

System MUST provide:

```typescript
/** Application layout state */
export interface LayoutState {
  readonly sidebarVisible: boolean;
  readonly sidebarWidth: number;
  readonly previewVisible: boolean;
  readonly previewWidth: number;
}

/** Theme variants */
export type Theme = 'light' | 'dark' | 'system';

/** Theme configuration */
export interface ThemeConfig {
  readonly theme: Theme;
  readonly resolvedTheme: 'light' | 'dark'; // After resolving 'system'
}

/** Panel resize constraints */
export interface PanelConstraints {
  readonly minSize: number;
  readonly maxSize: number;
  readonly defaultSize: number;
}
```

---

#### R6: Index Export (`src/shared/types/index.ts`)

System MUST re-export all types:

```typescript
export * from './editor';
export * from './file';
export * from './preview';
export * from './ipc';
export * from './ui';
```

---

#### R7: Result Monad (`src/shared/lib/result.ts`)

System MUST provide:

```typescript
/** Type-safe Result monad */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Create success result */
export function ok<T>(value: T): Result<T, never>;

/** Create error result */
export function err<E>(error: E): Result<never, E>;

/** Map over success value */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E>;

/** Map over error value */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F>;

/** Chain results */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E>;

/** Unwrap with default */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T;

/** Unwrap or throw */
export function unwrap<T, E>(result: Result<T, E>): T;
```

---

#### R8: Event Emitter (`src/shared/lib/events.ts`)

System MUST provide:

```typescript
/** Type-safe event emitter */
export interface TypedEventEmitter<Events extends Record<string, unknown>> {
  on<K extends keyof Events>(
    event: K,
    handler: (payload: Events[K]) => void
  ): () => void; // Returns unsubscribe function

  once<K extends keyof Events>(
    event: K,
    handler: (payload: Events[K]) => void
  ): () => void;

  emit<K extends keyof Events>(event: K, payload: Events[K]): void;

  off<K extends keyof Events>(
    event: K,
    handler?: (payload: Events[K]) => void
  ): void;
}

/** Create a new typed event emitter */
export function createEventEmitter<
  Events extends Record<string, unknown>
>(): TypedEventEmitter<Events>;
```

---

#### R9: Utility Library (`src/shared/lib/utils.ts`)

System MUST provide:

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Debounce a function */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void;

/** Throttle a function */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void;

/** Generate unique ID */
export function uid(): string;
```

---

#### R10: Lib Index (`src/shared/lib/index.ts`)

System MUST re-export all utilities:

```typescript
export * from './result';
export * from './events';
export * from './utils';
```

---

#### R11: Package Dependencies

System MUST add all dependencies listed in Technology Stack Additions to `package.json`.

---

#### R12: Tailwind Configuration

System MUST configure Tailwind CSS v4 with Vite plugin and theme variables.

---

#### R13: shadcn/ui Setup

System MUST:
1. Create `components.json` with correct paths
2. Install base components: button, input, textarea, label, dialog, dropdown-menu, popover, tooltip, tabs, scroll-area, separator, command, resizable

---

#### R14: CSS Variables

System MUST define CSS variables in `src/renderer/styles/globals.css` for theming.

---

#### R15: Path Aliases

System MUST configure these TypeScript path aliases in all relevant `tsconfig.json` files:

```json
{
  "paths": {
    "@shared/*": ["./src/shared/*"],
    "@main/*": ["./src/main/*"],
    "@preload/*": ["./src/preload/*"],
    "@renderer/*": ["./src/renderer/*"],
    "@ui/*": ["./src/renderer/components/ui/*"]
  }
}
```

---

#### R16: Type Exports

All type files MUST export only types and interfaces (no runtime code) except where implementations are integral (Result monad, EventEmitter, utils).

---

#### R17: Compilation Verification

After completion:
1. `pnpm typecheck` MUST pass with no errors
2. `pnpm lint` MUST pass with no errors
3. `pnpm build` MUST succeed

---

### Key Entities

- **EditorState**: Represents the current state of the CodeMirror editor including document content and selection
- **FileHandle**: Represents a reference to a file (may be untitled with null path)
- **FileState**: Runtime state of an open file including dirty tracking
- **CompileResult**: Discriminated union for MDX compilation outcomes
- **IpcApi**: Type-safe contract for Electron IPC communication
- **Result<T, E>**: Monadic error handling type

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All type files compile with `--strict` mode enabled
- **SC-002**: `pnpm typecheck` passes with zero errors after implementation
- **SC-003**: `pnpm lint` passes with zero errors
- **SC-004**: `pnpm build` succeeds and produces working application
- **SC-005**: All dependencies in Technology Stack are installed and importable
- **SC-006**: shadcn/ui components render correctly in development mode
- **SC-007**: CSS variables for theming are functional (light/dark modes)
- **SC-008**: Path aliases resolve correctly in all TypeScript contexts

---

## Task Batching Guidance

### Phase 1: Setup (Sequential)
- T001-T004: Dependency installation (CodeMirror, MDX, React, Tailwind, dev deps)

### Phase 2: Foundational (Parallel Batches)
- Batch 2.1 (T005-T010): Type definition files (editor.ts, file.ts, preview.ts, ipc.ts, ui.ts, index.ts)
- Batch 2.2 (T011-T014): Utility implementations (result.ts, events.ts, utils.ts, lib/index.ts)
- Batch 2.3 (T015-T018): Tailwind/CSS setup (tailwind.config.ts, postcss.config.js, globals.css, vite integration)

### Phase 3: shadcn/ui (Depends on Phase 2)
- Batch 3.1 (T019-T021): Configuration (components.json, tsconfig paths, vite aliases)
- Batch 3.2-3.3 (T022-T027): Component installation (parallel)
- Batch 3.4 (T028): UI index export

### Phase 4: Integration (Sequential)
- T029-T030: App wiring (CSS import, sample component)

### Phase 5: Verification (Sequential)
- T031-T034: Full verification (typecheck, lint, build, dev server)
