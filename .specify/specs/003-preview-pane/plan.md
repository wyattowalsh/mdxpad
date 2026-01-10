# Implementation Plan: Preview Pane

**Branch**: `003-preview-pane` | **Date**: 2026-01-09 | **Spec**: [spec.md](../../specs/003-preview-pane/spec.md)
**Input**: Feature specification from `/specs/003-preview-pane/spec.md`

## Summary

Implement the live MDX preview pane for mdxpad. This feature owns MDX compilation, preview rendering in a sandboxed iframe, and real-time updates as the user types. The architecture uses a hardened sandbox (C1-H) with `sandbox="allow-scripts"` only, unidirectional postMessage communication, and Web Worker-based compilation to meet performance budgets.

## Technical Context

**Language/Version**: TypeScript 5.9.x with `strict: true`
**Primary Dependencies**: @mdx-js/mdx 3.x, @mdx-js/react 3.x, React 19.x, Zustand 5.x, Immer 11.x, remark-gfm 4.x, remark-frontmatter 5.x, rehype-highlight 7.x, zod 4.x
**Storage**: N/A (in-memory state only; file I/O deferred to other specs)
**Testing**: Vitest 4.x (unit), Playwright 1.57.x (E2E)
**Target Platform**: macOS (Electron 39.x)
**Project Type**: Electron app (main + renderer processes)
**Performance Goals**: <500ms preview compile, <16ms keystroke latency, 300ms debounce
**Constraints**: Preview iframe MUST use `sandbox="allow-scripts"` only; MDX compilation MUST run in Web Worker; CSP enforced
**Scale/Scope**: Typical documents ~500 lines; graceful degradation for larger documents with performance warning

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| II | TypeScript 5.9.x strict: true | PASS | Using pinned stack |
| II | @mdx-js/mdx 3.x | PASS | Will use 3.1.1 |
| II | React 19.x | PASS | Will use 19.2.3 |
| II | Zustand 5.x + Immer 11.x | PASS | Will use 5.0.9 / 11.1.3 |
| III.2 | contextIsolation: true | PASS | Spec defers to main process config |
| III.2 | sandbox: true (BrowserWindow) | PASS | Renderer config unchanged |
| III.5 | Preview in sandboxed iframe | PASS | FR-002: sandbox="allow-scripts" |
| III.5 | MDX compile in Web Worker | PASS | FR-005: off main thread |
| III.5 | postMessage only | PASS | FR-018: unidirectional |
| III.5 | Components whitelisted | PASS | FR-009-014: built-in components |
| V | MDX compile <500ms | TBD | Validate in implementation |
| V | Keystroke latency <16ms | TBD | Web Worker ensures no blocking |
| VI.1 | strict: true, no any | PASS | Existing types in preview.ts |
| VI.2 | Functions <50 lines | TBD | Will enforce during implementation |
| VI.4 | Unit coverage >80% | TBD | Tests required for services/lib |

**Gate Status**: PASS - All constitutional requirements addressable. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/003-preview-pane/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main/                      # Electron main process (existing)
├── preload/                   # Preload scripts (existing)
├── renderer/
│   ├── components/
│   │   └── preview/           # Preview pane React components
│   │       ├── PreviewPane.tsx
│   │       ├── PreviewFrame.tsx
│   │       ├── ErrorDisplay.tsx
│   │       └── LoadingIndicator.tsx
│   ├── hooks/
│   │   └── usePreview.ts      # Preview state management hook
│   ├── lib/
│   │   └── mdx/               # MDX utilities
│   │       ├── compiler.ts    # Worker message interface
│   │       └── components.ts  # Built-in component registry
│   ├── workers/
│   │   └── mdx-compiler.worker.ts  # Web Worker for MDX compilation
│   └── styles/
│       └── preview/           # Preview-specific styles
│           └── components.css
├── shared/
│   └── types/
│       └── preview.ts         # Existing types (from Spec 001)
└── preview-frame/             # Sandboxed iframe content
    ├── index.html             # Iframe entry point
    ├── renderer.tsx           # MDX runtime renderer
    └── components/            # Built-in MDX components
        ├── index.ts           # Component registry export
        ├── Callout.tsx
        ├── CodeBlock.tsx
        ├── Tabs.tsx
        ├── Card.tsx
        └── FileTree.tsx

tests/
├── unit/
│   └── renderer/
│       ├── lib/
│       │   └── mdx/
│       │       └── compiler.test.ts
│       └── hooks/
│           └── usePreview.test.ts
├── integration/
│   └── preview/
│       └── compilation.test.ts
└── e2e/
    └── preview/
        └── live-preview.spec.ts
```

**Structure Decision**: Electron app structure per Constitution Article III. Preview iframe content isolated in `src/preview-frame/` for CSP enforcement. Web Worker in `src/renderer/workers/` for off-thread compilation. Built-in components centralized for whitelist enforcement.

**Note**: Unit test implementation is deferred to a follow-up task batch. Constitution Article VI.4 requires >80% coverage for `src/renderer/lib/` and `src/shared/`. Test file structure shown above establishes the pattern for test colocation.

## Complexity Tracking

> No constitutional violations requiring justification.

N/A - All design choices align with constitutional requirements.
