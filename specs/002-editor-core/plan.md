# Implementation Plan: Editor Core

**Branch**: `002-editor-core` | **Date**: 2026-01-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-editor-core/spec.md`

## Summary

Implement the CodeMirror 6 editor integration for mdxpad. This feature provides the core MDX editing experience including syntax highlighting (Markdown + JSX + frontmatter), keyboard commands, find/replace, and theme support. The editor syncs with shared types from Spec 001 and follows CodeMirror 6 idioms per Constitution Article III Section 3.4.

## Technical Context

**Language/Version**: TypeScript 5.9.x (strict: true)
**Primary Dependencies**:
- @codemirror/state ^6.5.3
- @codemirror/view ^6.39.9
- @codemirror/commands ^6.10.1
- @codemirror/language ^6.12.1
- @codemirror/lang-markdown ^6.5.0
- @codemirror/lang-javascript ^6.2.4
- @codemirror/lang-yaml ^6.1.2
- @codemirror/search ^6.5.11
- @codemirror/theme-one-dark ^6.1.3
- React 19.x

**Storage**: N/A (state managed by CodeMirror)
**Testing**: Vitest 4.x + @testing-library/react
**Target Platform**: Electron renderer process (macOS)
**Project Type**: Electron (main/renderer/preload/shared)
**Performance Goals**: Keystroke latency < 16ms (p99), render < 100ms
**Constraints**: < 200MB memory, renderer bundle < 5MB gzipped
**Scale/Scope**: Documents up to 10MB, typical use 10K characters

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| II | TypeScript 5.9.x strict: true | PASS | Existing tsconfig verified |
| II | React 19.x | PASS | Existing package.json verified |
| II | CodeMirror 6.x | PASS | All packages are 6.x versions |
| III.4 | CodeMirror owns all editor state | PASS | Custom hook, no React state duplication |
| III.4 | Extensions follow CM idioms | PASS | Using Extension/Facet/StateField |
| III.4 | MDX extends lang-markdown with JSX | PASS | yamlFrontmatter + markdown + jsx pattern |
| V | Keystroke latency < 16ms | TBD | Validate with benchmark after implementation |
| V | Render < 100ms | TBD | Validate with benchmark after implementation |
| VI.1 | strict: true, JSDoc for public APIs | PLANNED | Will include in implementation |
| VI.2 | Functions max 50 lines | PLANNED | Will enforce during implementation |
| VI.4 | Unit coverage > 80% for lib/ | PLANNED | Tests colocated with features |
| VII.1 | System light/dark mode | PASS | Compartment + prefers-color-scheme |
| VII.2 | Keyboard navigation | PASS | Full keyboard support via commands |

**Post-Design Check (Phase 1 Complete)**: All PASS or PLANNED. No violations.

## Project Structure

### Documentation (this feature)

```text
.specify/specs/002-editor-core/
├── plan.md              # This file
├── research.md          # Phase 0 output (complete)
├── data-model.md        # Phase 1 output (complete)
├── quickstart.md        # Phase 1 output (complete)
├── contracts/           # Phase 1 output (complete)
│   └── editor-api.ts    # TypeScript API contract
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
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

src/shared/types/
└── editor.ts                       # (Spec 001 - READ-ONLY)
```

**Structure Decision**: Using existing Electron structure from Spec 000/001. New code goes in `src/renderer/` as this is a renderer-process feature per Constitution Article III Section 3.1.

## Implementation Phases

### Phase 1: Core Editor Setup
1. Install CodeMirror dependencies
2. Create `lib/editor/mdx-language.ts` - MDX language support
3. Create `lib/editor/state-bridge.ts` - Type conversion utilities
4. Create `lib/editor/errors.ts` - Error handling

### Phase 2: React Integration
1. Create `hooks/useCodeMirror/useCodeMirror.ts` - Core hook
2. Create `hooks/useCodeMirror/extensions.ts` - Extension composition
3. Create `hooks/useCodeMirror/themes.ts` - Theme configuration
4. Write hook tests

### Phase 3: Commands
1. Create `hooks/useCodeMirror/commands.ts` - All keyboard commands
2. Test each command behavior

### Phase 4: Component
1. Create `components/editor/MDXEditor.tsx` - React component
2. Write component tests
3. Integration tests

### Phase 5: Polish & Performance
1. Verify performance budgets
2. Add remaining tests to meet coverage
3. Documentation and cleanup

## Complexity Tracking

> No Constitution Check violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

## Research References

See [research.md](./research.md) for:
- Package version verification
- MDX syntax highlighting approach
- Frontmatter support decision
- React integration strategy
- Custom command patterns
- Debouncing implementation
- Theme switching mechanism
- Error handling approach

## Contract References

See [contracts/editor-api.ts](./contracts/editor-api.ts) for:
- EditorError interface
- EditorTheme type
- EditorCallbacks interface
- MDXEditorConfig interface
- MDXEditorProps interface
- UseCodeMirrorReturn interface
- EditorCommandName type
- EDITOR_COMMANDS constant

## Dependencies

- **Spec 001**: Interface Contracts - `EditorState`, `Selection`, `EditorConfig`, `EditorChange` types
- **Spec 000**: Foundational Setup - Build pipeline, project structure

## Next Steps

Run `/speckit.tasks` to generate detailed task breakdown with acceptance criteria.
