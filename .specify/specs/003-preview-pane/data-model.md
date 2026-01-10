# Data Model: Preview Pane

**Feature**: 003-preview-pane
**Date**: 2026-01-09
**Status**: Complete

## Overview

This document defines the data structures and state management for the Preview Pane feature. The architecture separates concerns across three contexts:

1. **Renderer Process**: React state management via Zustand
2. **Web Worker**: Stateless compilation service
3. **Preview Iframe**: Isolated rendering context

---

## Core Types

### Existing Types (from Spec 001)

These types are defined in `src/shared/types/preview.ts` and MUST NOT be modified:

```typescript
/** MDX compilation result */
export type CompileResult = CompileSuccess | CompileFailure;

export interface CompileSuccess {
  readonly ok: true;
  readonly code: string;
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
  readonly components: Record<string, unknown>;
}

/** Preview state */
export type PreviewState =
  | { readonly status: 'idle' }
  | { readonly status: 'compiling' }
  | { readonly status: 'success'; readonly result: CompileSuccess }
  | { readonly status: 'error'; readonly errors: CompileError[] };
```

---

## New Types

### Worker Message Types

```typescript
// src/shared/types/preview-worker.ts

/** Request sent from renderer to MDX compilation worker */
export interface CompileRequest {
  readonly id: string;      // UUID for request correlation
  readonly source: string;  // MDX source text
}

/** Response sent from worker to renderer */
export type CompileResponse =
  | CompileResponseSuccess
  | CompileResponseFailure;

export interface CompileResponseSuccess {
  readonly id: string;
  readonly ok: true;
  readonly code: string;
  readonly frontmatter: Record<string, unknown>;
}

export interface CompileResponseFailure {
  readonly id: string;
  readonly ok: false;
  readonly errors: CompileError[];
}
```

### Iframe Message Types

```typescript
// src/shared/types/preview-iframe.ts

/** Messages sent from parent to preview iframe */
export type ParentToIframeMessage =
  | RenderCommand
  | ThemeCommand
  | ScrollCommand;

export interface RenderCommand {
  readonly type: 'render';
  readonly code: string;
  readonly frontmatter: Record<string, unknown>;
}

export interface ThemeCommand {
  readonly type: 'theme';
  readonly value: 'light' | 'dark';
}

export interface ScrollCommand {
  readonly type: 'scroll';
  readonly ratio: number;  // 0-1 scroll position
}

/** Messages sent from iframe to parent */
export type IframeToParentMessage =
  | ReadySignal
  | SizeSignal
  | RuntimeErrorSignal;

export interface ReadySignal {
  readonly type: 'ready';
}

export interface SizeSignal {
  readonly type: 'size';
  readonly height: number;
}

export interface RuntimeErrorSignal {
  readonly type: 'runtime-error';
  readonly message: string;
  readonly componentStack?: string;
}
```

### Preview Store State

```typescript
// src/renderer/stores/preview-store.ts

export interface PreviewStore {
  // State
  readonly state: PreviewState;
  readonly lastSuccessfulRender: CompileSuccess | null;
  readonly theme: 'light' | 'dark';
  readonly config: PreviewConfig;

  // Actions
  setCompiling: () => void;
  setSuccess: (result: CompileSuccess) => void;
  setError: (errors: CompileError[]) => void;
  setIdle: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  updateConfig: (config: Partial<PreviewConfig>) => void;
}
```

---

## State Transitions

```
┌────────┐    compile()    ┌───────────┐
│  IDLE  │ ───────────────▶│ COMPILING │
└────────┘                 └───────────┘
    ▲                           │
    │                     ┌─────┴─────┐
    │                     ▼           ▼
    │               ┌─────────┐  ┌─────────┐
    └───────────────│ SUCCESS │  │  ERROR  │
      (new source)  └─────────┘  └─────────┘
                          │           │
                          └─────┬─────┘
                                │
                         (both cache to
                          lastSuccessfulRender)
```

### State Invariants

1. `lastSuccessfulRender` is updated ONLY when `state.status === 'success'`
2. `lastSuccessfulRender` is preserved when `state.status === 'error'`
3. `state.status === 'compiling'` clears any pending debounced requests
4. `theme` changes do NOT trigger recompilation

---

## Component Props

### PreviewPane

```typescript
export interface PreviewPaneProps {
  /** MDX source text to compile and render */
  readonly source: string;

  /** Callback when preview state changes */
  readonly onStateChange?: (state: PreviewState) => void;

  /** Editor scroll position for synchronization (0-1) */
  readonly scrollRatio?: number;

  /** CSS class for styling */
  readonly className?: string;
}
```

### ErrorDisplay

```typescript
export interface ErrorDisplayProps {
  /** Compilation errors to display */
  readonly errors: readonly CompileError[];

  /** Callback when user clicks error line number */
  readonly onErrorClick?: (line: number, column?: number) => void;
}
```

### Built-in Component Props

```typescript
// Callout
export interface CalloutProps {
  readonly type: 'info' | 'warning' | 'error' | 'success' | 'note' | 'tip';
  readonly title?: string;
  readonly children: React.ReactNode;
}

// CodeBlock
export interface CodeBlockProps {
  readonly children: string;
  readonly className?: string;  // Contains language from highlight
  readonly title?: string;
  readonly showLineNumbers?: boolean;
}

// Tabs
export interface TabsProps {
  readonly defaultValue?: string;
  readonly children: React.ReactNode;
}

export interface TabProps {
  readonly value: string;
  readonly label: string;
  readonly children: React.ReactNode;
}

// Card
export interface CardProps {
  readonly title: string;
  readonly href?: string;
  readonly icon?: React.ReactNode;
  readonly children?: React.ReactNode;
}

export interface CardGridProps {
  readonly columns?: 2 | 3 | 4;
  readonly children: React.ReactNode;
}

// FileTree
export interface FileTreeProps {
  readonly data: FileTreeNode[];
}

export interface FileTreeNode {
  readonly name: string;
  readonly type: 'file' | 'directory';
  readonly children?: FileTreeNode[];
}
```

---

## Validation Schemas (Zod)

```typescript
// src/shared/schemas/preview.ts

import { z } from 'zod';

export const compileRequestSchema = z.object({
  id: z.string().uuid(),
  source: z.string(),
});

export const compileErrorSchema = z.object({
  message: z.string(),
  line: z.number().optional(),
  column: z.number().optional(),
  source: z.string().optional(),
});

export const compileResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    id: z.string().uuid(),
    ok: z.literal(true),
    code: z.string(),
    frontmatter: z.record(z.unknown()),
  }),
  z.object({
    id: z.string().uuid(),
    ok: z.literal(false),
    errors: z.array(compileErrorSchema),
  }),
]);

export const parentToIframeMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('render'),
    code: z.string(),
    frontmatter: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal('theme'),
    value: z.enum(['light', 'dark']),
  }),
  z.object({
    type: z.literal('scroll'),
    ratio: z.number().min(0).max(1),
  }),
]);

export const iframeToParentMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('size'), height: z.number() }),
  z.object({
    type: z.literal('runtime-error'),
    message: z.string(),
    componentStack: z.string().optional(),
  }),
]);
```

---

## Default Values

```typescript
export const DEFAULT_PREVIEW_CONFIG: PreviewConfig = {
  debounceMs: 300,
  components: {},
};

export const INITIAL_PREVIEW_STATE: PreviewState = {
  status: 'idle',
};

export const RECOMMENDED_DOC_SIZE_CHARS = 50_000;  // ~1000 lines
export const PERFORMANCE_WARNING_THRESHOLD = RECOMMENDED_DOC_SIZE_CHARS;
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        RENDERER PROCESS                          │
│                                                                   │
│  ┌──────────┐    source    ┌────────────┐   CompileRequest      │
│  │  Editor  │ ───────────▶ │ usePreview │ ─────────────────────┐│
│  └──────────┘              │   (hook)   │                      ││
│                            └────────────┘                      ││
│                                  │                             ││
│                                  ▼                             ▼│
│                            ┌────────────┐              ┌───────────┐
│                            │  Preview   │◀─────────────│   Web     │
│                            │   Store    │ CompileResp  │  Worker   │
│                            │ (Zustand)  │              │  (MDX)    │
│                            └────────────┘              └───────────┘
│                                  │
│                       PreviewState
│                                  ▼
│                            ┌────────────┐
│                            │ PreviewPane│
│                            │ (React)    │
│                            └────────────┘
│                                  │
│                        RenderCommand
│                        (postMessage)
│                                  ▼
└──────────────────────────────────┼──────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │       SANDBOXED IFRAME       │
                    │                              │
                    │  ┌────────────────────────┐  │
                    │  │   MDX Runtime Renderer │  │
                    │  │   + Built-in Components│  │
                    │  └────────────────────────┘  │
                    │              │               │
                    │     SizeSignal/ErrorSignal  │
                    │         (postMessage)       │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                            [Back to Renderer]
```
