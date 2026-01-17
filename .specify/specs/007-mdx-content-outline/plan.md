# Implementation Plan: MDX Content Outline/Navigator

**Branch**: `007-mdx-content-outline` | **Date**: 2026-01-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/007-mdx-content-outline/spec.md`

---

## Summary

Implement a live document outline panel showing headings tree (h1-h6), component hierarchy, and frontmatter sections with click-to-navigate functionality. The outline displays as a collapsible sidebar on the left, updates in real-time as the user edits, and integrates with existing preview AST parsing and useErrorNavigation hook patterns.

**Key Technical Approach**:
- Extend preview store to expose lightweight AST data for outline generation
- Create dedicated outline Zustand store for UI state management
- Reuse and extend useErrorNavigation pattern for cursor positioning with line highlighting
- Follow existing UI layout store patterns for visibility persistence

> **Design Decision**: Reuse AST from preview compilation per FR-029. All AST references in this plan and tasks.md cite this decision rather than restating it.

---

## Technical Context

**Technical Stack**: Per AGENTS.md Active Technologies section and Constitution Article II.
**Storage**: localStorage for outline panel visibility (`mdxpad:ui:outline-visible`)
**Project Type**: Single Electron app (renderer process focus)
**Performance Goals**: <100ms navigation response, <50ms AST extraction overhead, <500ms outline update after debounce timer fires (300ms after last keystroke)
**Constraints**: Must not block main thread, reuse existing AST from preview compilation
**Scale/Scope**: Single document, optimized for documents up to 500 lines, must remain functional for documents up to 2000 lines with graceful degradation

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| II | TypeScript 5.9.x, strict: true | ✅ PASS | Using existing project config |
| II | React 19.x | ✅ PASS | Existing dependency |
| II | Zustand 5.x + Immer 11.x | ✅ PASS | Following existing store patterns |
| II | Tailwind CSS 4.x | ✅ PASS | Existing styling system |
| III.1 | Renderer process only | ✅ PASS | All outline code in renderer |
| III.4 | CodeMirror 6 owns editor state | ✅ PASS | Navigation uses CM transactions |
| V | Keystroke latency <16ms | ✅ PASS | Outline updates debounced, async |
| V | Renderer bundle <5MB | ⏳ PENDING | Estimated ~2KB new code, verification after implementation |
| VI.1 | No `any` types | ✅ PASS | Full type coverage in contracts |
| VI.2 | Functions <50 lines | ✅ PASS | Design follows limits |
| VI.4 | >80% unit coverage | ✅ TBD | Test plan includes coverage |
| VII.2 | Keyboard accessible | ✅ PASS | ARIA roles, keyboard nav specified |
| VIII.2 | Task-based commits | ✅ PASS | Will follow pattern |

**Post-Design Re-check**: All gates PASS. No violations requiring justification.

---

## Project Structure

### Documentation (this feature)

```text
.specify/specs/007-mdx-content-outline/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 research findings
├── data-model.md        # Entity definitions
├── quickstart.md        # Implementation guide
├── contracts/           # TypeScript interfaces
│   ├── index.ts
│   ├── outline-store.ts
│   ├── outline-navigation.ts
│   └── outline-panel.ts
├── checklists/
│   └── requirements.md  # Quality checklist
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/renderer/
├── stores/
│   ├── outline-store.ts           # NEW: Outline state management
│   ├── outline-store.test.ts      # NEW: Store tests
│   ├── preview-store.ts           # EXTEND: Add outline AST field
│   └── ui-layout-store.ts         # EXTEND: Add outlineVisible
├── hooks/
│   ├── useOutlineNavigation.ts    # NEW: Navigation hook
│   └── useOutlineNavigation.test.ts
├── lib/mdx/
│   ├── outline-extractor.ts       # NEW: AST extraction
│   └── outline-extractor.test.ts
├── components/outline/
│   ├── OutlinePanel.tsx           # NEW: Main panel
│   ├── OutlineSection.tsx         # NEW: Section component
│   ├── OutlineItem.tsx            # NEW: Tree item
│   ├── OutlineEmptyState.tsx      # NEW: Empty state
│   └── index.ts                   # NEW: Barrel export
├── commands/
│   └── view-commands.ts           # EXTEND: Add toggle-outline
└── App.tsx                        # EXTEND: Integrate OutlinePanel

src/shared/types/
└── outline.ts                     # NEW: Shared type definitions
```

**Structure Decision**: Single project structure (Option 1). All outline code lives in renderer process. No main process changes needed.

---

## Complexity Tracking

> **No violations requiring justification.**

The implementation follows existing patterns:
- Zustand store pattern (same as preview-store, ui-layout-store)
- Navigation hook pattern (same as useErrorNavigation)
- Command registration pattern (same as view-commands)
- Component structure (same as existing shell components)

---

## Implementation Phases

*See spec.md User Stories for full context on P1/P2/P3 priorities.*

### Phase 1: Core Infrastructure (US1, US2)

**Implements**: FR-001 through FR-010, FR-029

1. Extend preview store with outline AST field
2. Create outline-extractor for AST processing
3. Create outline-store for state management
4. Extend ui-layout-store with outlineVisible
5. Create useOutlineNavigation hook
6. Register toggle-outline command

### Phase 2: UI Components (US1, US2)

**Implements**: FR-020 through FR-024

1. Create OutlinePanel component
2. Create OutlineSection component
3. Create OutlineItem component (recursive tree)
4. Create OutlineEmptyState component
5. Integrate with App.tsx layout
6. Add Tailwind styling

### Phase 3: Components & Frontmatter (US3, US4)

**Implements**: FR-011 through FR-019

1. Add component extraction to outline-extractor
2. Create ComponentGroup component
3. Add frontmatter extraction
4. Create FrontmatterSection component
5. Handle "Show all" expansion

### Phase 4: Polish & Accessibility (US5)

**Implements**: FR-025 through FR-028

1. Add section collapse state
2. Add nested heading collapse
3. Implement keyboard navigation
4. Add ARIA roles and labels
5. Add auto-hide on narrow window
6. Final testing and polish

---

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Spec 003 (Preview Pane) | Must exist | ✅ Complete |
| Spec 005 (Command Palette) | Must exist | ✅ Complete |
| Spec 006 (Application Shell) | Must exist | ✅ Complete |
| preview-store.ts | Extend | Exists |
| ui-layout-store.ts | Extend | Exists |
| useErrorNavigation.ts | Pattern reference | Exists |
| view-commands.ts | Extend | Exists |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| AST extraction slows compilation | Lightweight extraction, <10ms target |
| Line highlighting flickers | Single StateEffect, CSS transition |
| Memory from outline state | Only current document, reset on file change |
| Auto-hide conflicts with user toggle | Preserve preference, auto-restore pattern |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Navigation response | <100ms | Stopwatch in navigateToItem |
| Outline update latency | <500ms | Time from keystroke to UI update |
| Panel toggle response | <50ms | Time from shortcut to visibility change |
| AST extraction overhead | <50ms | Profiling in outline-extractor |
| Heading coverage | 100% | Test with varied documents |
| Component coverage | 100% | Test with JSX-heavy documents |
| Visibility persistence | 100% | E2E test across restart |

---

## Next Steps

Run `/speckit.tasks` to generate implementation tasks from this plan.
