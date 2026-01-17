# Remediation Edits for plan.md

**Date**: 2026-01-10
**Target File**: `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/plan.md`

---

## Fix I5: Add useErrorNavigation.ts to hooks section

**File:** plan.md
**Location:** After line 96
**Action:** INSERT

**New text:**
```
│       ├── useErrorNavigation.ts    # NEW: Error click coordination hook
```

**Rationale:** The hook `useErrorNavigation.ts` is defined in T007 of tasks.md but was omitted from the plan.md project structure. Adding it under hooks/ maintains consistency between plan and tasks.

---

## Fix I11: Correct PreviewPane.tsx label from "existing" to CREATE

**File:** plan.md
**Location:** Line 79
**Action:** REPLACE

**Current text:**
```
│   │   │   ├── PreviewPane.tsx   # Preview wrapper (existing, wire up)
```

**New text:**
```
│   │   │   └── PreviewPane.tsx   # NEW: Preview wrapper for shell integration
```

**Rationale:** PreviewPane.tsx in the shell/ directory is a new wrapper component that integrates the existing PreviewFrame.tsx from components/preview/. The label "existing, wire up" is misleading. This is consistent with T006 in tasks.md which lists it as CREATE.

---

## Fix I1: Clarify StatusBar directory structure

**File:** plan.md
**Location:** Lines 80-84
**Action:** REPLACE

**Current text:**
```
│   │   │   └── StatusBar.tsx     # Status bar component
│   │   │   └── StatusBar/
│   │   │       ├── FileInfo.tsx
│   │   │       ├── CursorPosition.tsx
│   │   │       └── ErrorCount.tsx
```

**New text:**
```
│   │   │   └── StatusBar/             # NEW: Status bar component directory
│   │   │       ├── StatusBar.tsx      # Main StatusBar component
│   │   │       ├── FileInfo.tsx       # Filename + dirty indicator
│   │   │       ├── CursorPosition.tsx # Line:Col display
│   │   │       ├── ErrorCount.tsx     # Error badge with popover
│   │   │       ├── types.ts           # Props interfaces
│   │   │       └── index.ts           # Barrel export
```

**Rationale:** The original structure incorrectly showed both StatusBar.tsx as a sibling file AND a StatusBar/ directory, which is structurally impossible. T004 in tasks.md clearly defines StatusBar as a directory with multiple subcomponents. This fix aligns plan.md with the actual intended structure from tasks.md.

---

## Fix I3: Add file commands index.ts to plan structure

**File:** plan.md
**Location:** After line 94
**Action:** INSERT

**New text:**
```
│   │   │   └── index.ts              # MODIFY: Register file commands
```

**Rationale:** T003 in tasks.md lists `src/renderer/commands/index.ts` as MODIFY to register file commands, but this file was missing from the plan.md structure. Adding it ensures completeness.

---

## Fix I7: Add FR-006 titlebar implementation guidance

**File:** plan.md
**Location:** After line 26 (after Performance Goals line)
**Action:** INSERT

**New text:**
```
**Window Chrome**: macOS hiddenInset titlebar with traffic lights inset via electron BrowserWindow config (titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 10, y: 10 })
```

**Rationale:** FR-006 requires "titlebar/header area compatible with macOS traffic lights (hiddenInset style)" but the plan lacks implementation guidance. This addition provides the specific Electron configuration needed without introducing complexity. The existing main/index.ts already handles window creation, making this a minor config addition.

---

## Fix I9: Review T010 dependency on T009 for parallelization

**File:** plan.md
**Location:** After line 114 (end of Complexity Tracking section, before Phase Summary)
**Action:** INSERT

**New text:**
```
## Parallelization Notes

> T010 (External Modification Detection) lists dependency on T009 (Window Close Interception) in tasks.md, but these tasks are independent. T010 requires:
> - T001: Document store for file state (mtime tracking)
> - IPC patterns for focus events (no dependency on close interception)
>
> **Recommendation**: T010 can execute in parallel with T009 if resources permit. Both require main process modifications but operate on different events (focus vs close).

```

**Rationale:** The T010 → T009 dependency appears artificial. External modification detection (T010) triggers on window focus and checks file mtime, while window close interception (T009) handles the close event flow. They share no implementation dependencies beyond T001 (document store) and T008 (dirty check dialog). Adding this note documents the potential for parallel execution.

---

## Fix I12: Add checklists/ directory to documentation structure

**File:** plan.md
**Location:** Line 63 (after tasks.md line in documentation structure)
**Action:** REPLACE

**Current text:**
```
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

**New text:**
```
├── tasks.md             # Phase 2 output (/speckit.tasks command)
└── checklists/          # Validation outputs
    ├── requirements.md  # Requirements checklist (existing)
    └── performance.md   # Performance validation results (T014 output)
```

**Rationale:** T014 references creating `.specify/specs/006-application-shell/checklists/performance.md` but the checklists/ directory is not shown in the plan.md documentation structure. The directory already exists (with requirements.md), so this fix adds it to the structure for completeness.

---

## Summary of Changes

| Fix ID | Severity | Issue | Action |
|--------|----------|-------|--------|
| I5 | HIGH | useErrorNavigation.ts missing | INSERT hook in structure |
| I11 | HIGH | PreviewPane.tsx mislabeled | REPLACE label to CREATE |
| I1 | MEDIUM | StatusBar structure confusing | REPLACE with correct directory structure |
| I3 | MEDIUM | commands/index.ts missing | INSERT in structure |
| I7 | MEDIUM | FR-006 titlebar guidance missing | INSERT implementation note |
| I9 | MEDIUM | T010→T009 artificial dependency | INSERT parallelization note |
| I12 | MEDIUM | checklists/ not in structure | REPLACE to add directory |

---

## Verification Checklist

After applying these edits:
- [ ] Project structure shows StatusBar as a directory (not file + directory)
- [ ] useErrorNavigation.ts listed under hooks/
- [ ] PreviewPane.tsx labeled as NEW (not existing)
- [ ] commands/index.ts listed as MODIFY
- [ ] Titlebar configuration documented in Technical Context
- [ ] Parallelization note added for T009/T010
- [ ] checklists/ directory shown in documentation structure
