# Implementation Plan: Interface Contracts

**Branch**: `001-interface-contracts` | **Date**: 2025-12-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-interface-contracts/spec.md`

## Summary

This spec pre-declares all cross-lane TypeScript interfaces, types, and dependencies to enable parallel development of Editor, Shell (File System), and Preview lanes without merge conflicts. The implementation:

1. Populates stub type files (`src/shared/types/*.ts`) with complete type definitions
2. Implements utility libraries (`src/shared/lib/*.ts`) for Result monad, EventEmitter, and common utilities
3. Installs all dependencies required by parallel lanes (CodeMirror, MDX, React, Tailwind, shadcn/ui)
4. Configures Tailwind CSS v4 and shadcn/ui component library
5. Establishes path aliases for clean imports

## Technical Context

**Language/Version**: TypeScript 5.9.x with `strict: true` (per Constitution Article II)
**Primary Dependencies**:
- CodeMirror 6.x (`@codemirror/state` 6.5.x, `@codemirror/view` 6.39.x)
- MDX 3.x (`@mdx-js/mdx` 3.1.x, `@mdx-js/react` 3.1.x)
- React 19.x (`react` 19.2.x, `react-dom` 19.2.x)
- Tailwind CSS 4.x (`tailwindcss` 4.1.x)
- Zustand 5.x + Immer 11.x (state management - deferred to implementation lanes)
- Zod 4.x (validation - deferred to implementation lanes)
**Storage**: N/A (type definitions only)
**Testing**: Vitest 4.x (unit), Playwright 1.57.x (E2E) - existing from Spec 000
**Target Platform**: macOS (Electron 39.x) per Constitution Article II
**Project Type**: Electron (main/preload/renderer processes)
**Performance Goals**: Per Constitution Article V - no direct impact from type definitions
**Constraints**: All type files must compile with `--strict`; no runtime code in type files except designated utilities
**Scale/Scope**: ~15 type/utility files, ~30 npm packages, ~15 shadcn/ui components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| II | TypeScript 5.9.x, strict: true | PASS | Existing config from Spec 000 |
| II | React 19.x | TBD | Will install 19.2.x |
| II | CodeMirror 6.x | TBD | Will install 6.39.x |
| II | Tailwind CSS 4.x | TBD | Will install 4.1.x |
| II | Zod 4.x | TBD | Will install 4.1.x |
| III.1 | Process separation (main/renderer/preload) | PASS | IPC types respect boundaries |
| III.2 | contextIsolation: true | PASS | Already configured in Spec 000 |
| III.3 | IPC channel pattern | PASS | Types define channels per pattern |
| III.3 | Max 10 top-level IPC channels | PASS | Spec defines 10 channels |
| III.3 | Channel naming: mdxpad:domain:action | PASS | Spec uses correct `mdxpad:file:open` pattern |
| V | Performance budgets | N/A | Type definitions have no runtime impact |
| VI.1 | strict: true, no any | PASS | Type files enforce this |
| VI.2 | Max 50 lines/function | PASS | Utility functions are small |
| VI.2 | Max 400 lines/file | PASS | Each type file is focused |

**GATE RESULT**: PASS with one update needed (IPC channel naming convention)

## Project Structure

### Documentation (this feature)

```text
.specify/specs/001-interface-contracts/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── ipc-api.ts       # IPC contract reference
└── tasks.md             # Phase 2 output (from /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main/
│   └── index.ts                    # Existing from Spec 000
├── preload/
│   └── index.ts                    # Existing from Spec 000
├── renderer/
│   ├── index.tsx                   # Existing from Spec 000
│   ├── App.tsx                     # Existing from Spec 000
│   ├── styles/
│   │   └── globals.css             # CSS variables + Tailwind imports
│   └── components/
│       └── ui/                     # shadcn/ui components
│           ├── button.tsx
│           ├── input.tsx
│           ├── dialog.tsx
│           ├── dropdown-menu.tsx
│           ├── popover.tsx
│           ├── tooltip.tsx
│           ├── tabs.tsx
│           ├── scroll-area.tsx
│           ├── separator.tsx
│           ├── command.tsx
│           └── index.ts            # Re-exports
└── shared/
    ├── types/
    │   ├── editor.ts               # R1: Editor types
    │   ├── file.ts                 # R2: File types
    │   ├── preview.ts              # R3: Preview types
    │   ├── ipc.ts                  # R4: IPC types
    │   ├── ui.ts                   # R5: UI types
    │   └── index.ts                # R6: Re-exports
    └── lib/
        ├── result.ts               # R7: Result monad
        ├── events.ts               # R8: Event emitter
        ├── utils.ts                # R9: Utilities (cn, debounce, etc.)
        └── index.ts                # R10: Re-exports

# Root config files (new/modified)
├── tailwind.config.ts              # Tailwind v4 configuration
├── postcss.config.js               # PostCSS for Tailwind
└── components.json                 # shadcn/ui configuration
```

**Structure Decision**: Electron multi-process structure (existing from Spec 000). This spec adds to `src/shared/` for cross-process types and `src/renderer/components/ui/` for UI components.

## Complexity Tracking

No constitution violations requiring justification. All requirements align with constitutional boundaries.

## Dependencies to Install

### Production Dependencies

```json
{
  "@codemirror/state": "^6.5.2",
  "@codemirror/view": "^6.39.7",
  "@codemirror/commands": "^6.8.0",
  "@codemirror/language": "^6.10.8",
  "@codemirror/autocomplete": "^6.18.6",
  "@codemirror/lint": "^6.8.4",
  "@codemirror/search": "^6.5.10",
  "@codemirror/lang-markdown": "^6.3.2",
  "@codemirror/lang-javascript": "^6.2.3",
  "@lezer/highlight": "^1.2.1",
  "@mdx-js/mdx": "^3.1.0",
  "@mdx-js/react": "^3.1.0",
  "react": "^19.2.3",
  "react-dom": "^19.2.3",
  "remark-gfm": "^4.0.1",
  "remark-frontmatter": "^5.0.0",
  "rehype-highlight": "^7.0.2",
  "tailwindcss": "^4.1.18",
  "@radix-ui/react-slot": "^1.2.0",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.3.0",
  "lucide-react": "^0.514.0",
  "cmdk": "^1.1.0"
}
```

### Dev Dependencies

```json
{
  "@tailwindcss/vite": "^4.1.18",
  "@types/react": "^19.1.0",
  "@types/react-dom": "^19.1.0"
}
```

## IPC Channel Naming Update

Per Constitution Article III.3, IPC channels MUST follow `mdxpad:<domain>:<action>` pattern.

**Updated channel names** (from spec):

| Original | Constitutional |
|----------|---------------|
| `file:open` | `mdxpad:file:open` |
| `file:save` | `mdxpad:file:save` |
| `file:save-as` | `mdxpad:file:save-as` |
| `file:read` | `mdxpad:file:read` |
| `file:write` | `mdxpad:file:write` |
| `window:close` | `mdxpad:window:close` |
| `window:minimize` | `mdxpad:window:minimize` |
| `window:maximize` | `mdxpad:window:maximize` |
| `app:version` | `mdxpad:app:version` |
| `app:ready` | `mdxpad:app:ready` |

## shadcn/ui Component Strategy

shadcn/ui v4 uses the `shadcn` CLI with Tailwind CSS v4. Components will be installed via:

```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input dialog dropdown-menu popover tooltip tabs scroll-area separator command
```

Configuration in `components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/renderer/styles/globals.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "aliases": {
    "components": "@renderer/components",
    "utils": "@shared/lib/utils",
    "ui": "@ui",
    "lib": "@shared/lib",
    "hooks": "@renderer/hooks"
  },
  "iconLibrary": "lucide"
}
```

## Task Batching Summary

| Batch | Tasks | Parallelizable | Dependencies |
|-------|-------|----------------|--------------|
| 1 | T001-T006: Type files | Yes (6 parallel) | None |
| 2 | T007-T010: Lib utilities | Yes (4 parallel) | Batch 1 (types) |
| 3 | T011-T014: Tailwind/CSS | Yes (4 parallel) | None |
| 4 | T015-T017: shadcn/ui | Partial (setup then components) | Batch 3 |
| 5 | T018: Verification | No (sequential) | All batches |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| shadcn/ui v4 breaking changes | Low | Medium | Pin versions, use official CLI |
| Tailwind v4 Vite integration issues | Low | Medium | Follow official Vite plugin docs |
| React 19.2.x type mismatches | Low | Low | Use matching @types/react |
| Path alias resolution in Electron | Medium | Medium | Configure in all tsconfig files + vite |

## Post-Implementation Validation

After all tasks complete:

1. `pnpm typecheck` - All types compile
2. `pnpm lint` - No lint errors
3. `pnpm build` - Production build succeeds
4. `pnpm dev` - Dev server starts, UI renders
5. Import test - Each export from `@shared/types` and `@shared/lib` resolves
6. shadcn/ui test - Button component renders in App.tsx
