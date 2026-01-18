# Inconsistency Analysis: Smart Filtering for File Tree (Spec 014)

**Analyzed Files:**
- SPEC: `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/spec.md`
- PLAN: `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/plan.md`
- TASKS: `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/tasks.md`

**Analysis Date:** 2026-01-17

---

## Summary

**7 inconsistencies detected** across the three artifacts.

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| INC-001 | **CRITICAL** | Spec FR-006 (line 120), Spec clarification (line 13), Tasks T012/T014, Tasks Notes (line 604) | **Keyboard shortcut conflict: Spec says Cmd/Ctrl+Shift+F, Tasks use Mod+P** | Update spec to reflect new shortcut OR revert tasks to spec's shortcut after validating no conflict exists. Document the rationale for whichever shortcut is chosen. |
| INC-002 | **HIGH** | Spec Key Entities (line 133), Tasks T002 (line 100) | **Entity naming gap: "File Tree Node" (spec) vs "FilterVisibility" (tasks)** | Verify data-model.md bridges these concepts. The spec's "visibility state determined by filter matches" should map clearly to the FilterVisibility type. |
| INC-003 | **MEDIUM** | Plan line 13, Tasks T001 (line 77), Tasks T003 (line 101) | **Fuzzy library ambiguity: "fzf-for-js or similar (NEEDS CLARIFICATION)" vs "fzf"** | Update plan to remove "NEEDS CLARIFICATION" since tasks resolved this to the `fzf` npm package. |
| INC-004 | **MEDIUM** | Plan lines 46-53 | **Documentation path: Plan shows `specs/014-smart-filtering/` but actual path is `.specify/specs/014-smart-filtering/`** | Update plan's Project Structure section to use correct `.specify/specs/` path prefix. |
| INC-005 | **MEDIUM** | Spec SC-002 (line 140), Spec FR-010 (line 124), Plan line 18, Tasks T007/T008 | **Performance timing relationship unclear: 50ms debounce + 100ms total response** | Add clarifying note that 100ms total latency budget includes 50ms debounce plus 50ms for filter computation. |
| INC-006 | **LOW** | Spec lines 6, 30, 114, 115; Plan line 8; Tasks throughout | **Terminology drift: "file explorer" vs "file tree" vs "file explorer sidebar"** | Standardize: "file explorer" for UI component, "file tree" for data structure. |
| INC-007 | **LOW** | Plan line 65, Tasks T019 (line 320) | **Test file extension: `.test.ts` vs potentially `.test.tsx` for React components** | Verify `.ts` is correct for component tests or update to `.test.tsx` if JSX testing is needed. |

---

## Detailed Analysis

### INC-001: Keyboard Shortcut Conflict (CRITICAL)

This is the most severe inconsistency found. The specification documents one keyboard shortcut while the tasks file implements a different one without updating the spec.

**Spec clarification session (line 13):**
> Q: What keyboard shortcut should focus the filter input? → A: Cmd/Ctrl+Shift+F ("F" for Filter)

**Spec FR-006 (line 120):**
> System MUST provide Cmd/Ctrl+Shift+F keyboard shortcut to focus the filter input from anywhere in the application

**Spec User Story 4, Acceptance Scenario 1 (line 80):**
> Given I am anywhere in the application, When I press Cmd/Ctrl+Shift+F, Then the filter input receives focus

**Tasks notes (line 604):**
> **Keyboard shortcut**: Using `Mod+P` instead of spec's `Mod+Shift+F` due to conflict with Find/Replace

**Tasks Phase 5 header (lines 218-219):**
> **Goal**: Mod+P focuses filter input from anywhere in app
> **Independent Test**: Press Mod+P anywhere → filter input receives focus

**Impact:**
- Users reading the spec will expect Cmd+Shift+F but implementation provides Cmd+P
- Acceptance test scenarios in spec reference the wrong shortcut
- SC-004 mentions "Keyboard shortcut to focus filter is discoverable" but doesn't specify which shortcut
- The conflict with Find/Replace mentioned in tasks is not documented in the spec

**Recommendation:** Either:
1. Update spec FR-006, clarification, and User Story 4 acceptance scenarios to use Mod+P, with rationale about Find/Replace conflict
2. Or validate that Cmd+Shift+F doesn't actually conflict and revert tasks to use spec's shortcut

---

### INC-002: Entity Naming Gap (HIGH)

The spec defines three key entities at lines 131-133:
- **Filter Query**: The text string entered by the user
- **Match Result**: A file or folder that matches, including match positions
- **File Tree Node**: A file or folder with visibility state determined by filter matches

Tasks T002 references creating types including:
> `FilterVisibility` (from data-model.md)

The spec's "File Tree Node" concept with "visibility state" should map to `FilterVisibility`, but this connection is implicit. Without seeing data-model.md, it's unclear if these are properly aligned or if there's a conceptual gap.

**Impact:** Developers may not understand the relationship between spec entities and implementation types.

**Recommendation:** Verify data-model.md creates explicit mapping. Consider adding a note in the spec's Key Entities section referencing the implementation type names.

---

### INC-003: Fuzzy Library Resolution (MEDIUM)

**Plan line 13:**
> **Primary Dependencies**: React 19.x, Zustand 5.x + Immer 11.x (per Constitution Article II), fzf-for-js or similar fuzzy library (NEEDS CLARIFICATION)

**Tasks T001 (line 77):**
> Install fzf package: `npm install fzf`

**Tasks T003 (line 101):**
> Create fuzzy matcher wrapper in `src/renderer/lib/fuzzy-match/matcher.ts` using fzf library per research.md

The tasks have resolved the library choice to `fzf`, but the plan still shows uncertainty with "NEEDS CLARIFICATION".

**Impact:** Minor - developers might think the choice is still undecided.

**Recommendation:** Update plan line 13 to: `fzf 0.x (resolved per research.md)` and remove "(NEEDS CLARIFICATION)".

---

### INC-004: Documentation Path Prefix (MEDIUM)

**Plan Project Structure section (lines 46-53):**
```text
specs/014-smart-filtering/
├── plan.md              # This file
├── research.md          # Phase 0 output
...
```

**Actual repository path** (from analysis request):
```
.specify/specs/014-smart-filtering/
```

**Impact:** Developers navigating to the documented path will not find the files.

**Recommendation:** Update plan to show `.specify/specs/014-smart-filtering/` as the documentation root.

---

### INC-005: Performance Timing Clarification (MEDIUM)

Two timing values are specified:

**Spec FR-010 (line 124):**
> System MUST perform filtering with 50ms debounce (wait 50ms after last keystroke before filtering to prevent excessive recomputation)

**Spec SC-002 (line 140):**
> Filter results update within 100ms of keystroke for projects with up to 10,000 files

**Plan line 18:**
> **Performance Goals**: Filter results within 100ms for 10,000 files (SC-002), 50ms input debounce (FR-010)

The relationship is: user types → 50ms debounce delay → filtering computation → results display. For 100ms total, only 50ms remains for actual computation after the debounce.

**Impact:** Developers might misunderstand the timing budget, potentially causing performance issues.

**Recommendation:** Add clarifying note in spec or plan: "The 100ms end-to-end latency budget (SC-002) includes the 50ms debounce delay (FR-010), leaving 50ms maximum for filter computation."

---

### INC-006: Terminology Drift (LOW)

The documents use multiple terms for the same concept:

| Term | Locations |
|------|-----------|
| "file explorer sidebar" | Spec line 6, 114 |
| "file explorer" | Spec line 30, 32; Plan throughout |
| "file tree" | Spec line 115; Plan line 8; Tasks throughout |
| "directory structure" | Spec line 23 |

**Impact:** Minor cognitive load when reading across documents.

**Recommendation:** Establish convention:
- "file explorer" = the UI sidebar component
- "file tree" = the data structure representing files/folders
- Avoid "directory structure" and "file explorer sidebar" for consistency

---

### INC-007: Test File Extension (LOW)

**Plan line 65:**
> `FileTreeFilter.test.ts`

**Tasks T019 (line 320):**
> Create `src/renderer/components/file-explorer/FileTreeFilter.test.ts`

For React component tests, `.test.tsx` is typically used when JSX is needed in the test file (e.g., rendering components with React Testing Library).

**Impact:** If JSX is needed in tests, the `.ts` extension will cause TypeScript errors.

**Recommendation:** Verify testing approach. If using React Testing Library with JSX syntax, change to `.test.tsx`.

---

## Verification Checklist

The following were verified as **CONSISTENT**:

- [x] User Story numbering (US1-US5) matches across spec and tasks
- [x] Priority levels (P1, P2, P3) correctly assigned and ordered
- [x] Functional requirement IDs (FR-001 through FR-013) used correctly
- [x] Success criteria IDs (SC-001 through SC-006) aligned
- [x] Technology versions (TypeScript 5.9.x, React 19.x, Zustand 5.x, Vitest 4.x, Playwright 1.57.x, Electron 39.x)
- [x] 50ms debounce timing consistently mentioned (FR-010, tasks T007/T008)
- [x] Case-insensitive matching (FR-003a, clarification line 15)
- [x] Sequential/fzf-style fuzzy matching (FR-003, clarification line 12)
- [x] Filter persistence per project (FR-007, User Story 5, tasks Phase 6)
- [x] Empty state message requirement (FR-011, tasks T020)
- [x] Parent folder visibility (FR-004, tasks T009, T020)
- [x] Escape key behavior (spec User Story 4 scenarios, tasks T007)
- [x] Clear button requirement (FR-012, tasks T007)
- [x] File system change handling (FR-009, tasks T021)
- [x] Visual highlighting with non-color indicators (spec US3, plan Constitution check VII.2, tasks T010)

---

## Conclusion

**Result:** 7 inconsistencies detected

| Severity | Count | Action Required |
|----------|-------|-----------------|
| CRITICAL | 1 | Must fix before implementation |
| HIGH | 1 | Should fix before implementation |
| MEDIUM | 3 | Should fix, non-blocking |
| LOW | 2 | Nice to fix, cosmetic |

**Primary Blocker:** INC-001 (keyboard shortcut mismatch) must be resolved before implementation proceeds, as it affects user-facing behavior and test scenarios.

**Confidence Level:** High (spec, plan, and tasks fully analyzed)
