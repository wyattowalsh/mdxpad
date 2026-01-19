# Implementation Plan: Frontmatter Visual Editor

**Branch**: `020-frontmatter-editor` | **Date**: 2026-01-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-frontmatter-editor/spec.md`

## Summary

Implement a collapsible sidebar panel for form-based YAML frontmatter editing with bidirectional sync to the document content. The feature provides visual field editing with type-appropriate controls, raw YAML mode toggle, schema detection from project config or user settings, field validation, and common field suggestions.

## Technical Context

**Language/Version**: TypeScript 5.9.x, strict: true (per Constitution Article II)
**Primary Dependencies**: React 19.x, Zustand 5.x + Immer 11.x, zod 4.x, yaml (YAML parsing library)
**Storage**: localStorage for panel visibility state, electron-store for user schema defaults
**User Settings Schema** (electron-store):
```typescript
interface FrontmatterUserSettings {
  defaultSchema: {
    fields: Array<{ name: string; type: FieldType; required?: boolean }>;
  };
  panelWidth: number;
  lastUsedFields: string[];
}
```
**Testing**: Vitest 4.x (unit), Playwright 1.57.x (E2E)
**Target Platform**: macOS (Electron 39.x)
**Project Type**: Electron desktop application (renderer process feature)
**Performance Goals**: Panel open < 200ms, sync latency < 300ms, validation feedback < 100ms
**Constraints**: Renderer process only (no Node.js), runs in sidebar alongside editor
**Scale/Scope**: Single document frontmatter, typical 5-20 fields

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| II | TypeScript 5.9.x strict | PASS | Using project TypeScript config |
| II | React 19.x | PASS | Component-based UI |
| II | Zustand + Immer for state | PASS | Panel state management |
| II | zod for validation | PASS | Schema and field validation |
| III.1 | Renderer process owns UI | PASS | Sidebar panel in renderer |
| III.2 | contextIsolation: true | N/A | No IPC for this feature |
| III.4 | CodeMirror owns editor state | PASS | Syncs via editor state, doesn't duplicate |
| V | Panel open < 200ms | TBD | Will validate in implementation |
| VI.1 | JSDoc for public APIs | PASS | Will document all exports |
| VI.2 | Functions < 50 lines | PASS | Will enforce during implementation |
| VI.4 | Unit coverage > 80% | PASS | Will test all business logic |
| VII.1 | macOS HIG compliance | PASS | Native sidebar pattern |
| VII.2 | Keyboard navigation | PASS | Tab through fields, shortcuts |
| VII.3 | Actionable errors | PASS | Clear validation messages |

**Gate Status**: PASS - No violations, proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
.specify/specs/020-frontmatter-editor/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── frontmatter-schema.json
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── renderer/
│   ├── components/
│   │   └── frontmatter/
│   │       ├── FrontmatterPanel.tsx       # Main sidebar panel component
│   │       ├── FrontmatterForm.tsx        # Visual form renderer
│   │       ├── FrontmatterRawEditor.tsx   # Raw YAML textarea
│   │       ├── fields/
│   │       │   ├── TextField.tsx          # Single-line text input
│   │       │   ├── TextareaField.tsx      # Multi-line text input
│   │       │   ├── NumberField.tsx        # Numeric input
│   │       │   ├── BooleanField.tsx       # Checkbox/switch
│   │       │   ├── DateField.tsx          # Date picker
│   │       │   ├── ArrayField.tsx         # Tag input for arrays
│   │       │   ├── ObjectField.tsx        # Nested object editor
│   │       │   └── index.ts               # Field type registry
│   │       ├── AddFieldDropdown.tsx       # Common field suggestions
│   │       ├── ValidationIndicator.tsx    # Error badge on toggle
│   │       └── index.ts                   # Public exports
│   ├── App.tsx                            # Application root (from Spec 006)
│   ├── stores/
│   │   └── frontmatter-store.ts           # Zustand store for panel state
│   └── lib/
│       └── frontmatter/
│           ├── parser.ts                  # YAML parsing/serialization
│           ├── schema.ts                  # Schema loading and validation
│           ├── type-inference.ts          # Infer field types from values
│           ├── sync.ts                    # Bidirectional sync logic
│           ├── validation.ts              # Field validation utilities
│           └── index.ts                   # Public exports
├── shared/
│   └── types/
│       └── frontmatter.ts                 # Shared type definitions
└── main/
    └── (no changes - renderer-only feature)

# Unit tests are colocated with source files per Constitution Article VI Section 6.4
# Example: src/renderer/lib/frontmatter/parser.test.ts
#
# E2E tests:
tests/
└── e2e/
    └── frontmatter-editor.spec.ts
```

**Structure Decision**: Single project (Option 1) - this is a renderer-only feature extending the existing Electron application structure. All components live in `src/renderer/` with shared types in `src/shared/`.

## Complexity Tracking

> No constitution violations requiring justification.

| Component | Complexity | Justification |
|-----------|------------|---------------|
| Bidirectional sync | Medium | Debounced updates prevent conflicts; last-write-wins for simultaneous edits |
| Schema detection | Low | Simple file lookup + fallback to user settings |
| Field type inference | Low | Pattern matching on values (string, number, boolean, array, date) |
| Nested objects | Low | Visual editing limited to 2 levels; deeper nesting falls back to raw mode |
