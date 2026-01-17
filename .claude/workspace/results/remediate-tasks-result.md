# Tasks.md Remediation Edits

**Generated**: 2026-01-10
**Target File**: `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/tasks.md`

---

## Fix G11: SC-010 Error State Recoverability Not Tested (HIGH)

**File:** tasks.md
**Location:** After line 367 (within T012 Acceptance Criteria)
**Action:** INSERT

**New text:**
```
- [ ] Test: error state recovers after fixing MDX syntax error (SC-010)
```

**Rationale:** SC-010 specifies error state recoverability - that the preview should recover when syntax errors are fixed. This is a HIGH severity gap because it's untested critical behavior. Adding to T012 integration tests ensures the error recovery path is verified.

---

## Fix G1: FR-037a Preview Timeout Has Zero Task Coverage (MEDIUM)

**File:** tasks.md
**Location:** Line 221-222 (within T006 Acceptance Criteria, before "60fps during resize operations")
**Action:** INSERT

**Current context (line 221-222):**
```
- [ ] CommandPalette overlay renders
- [ ] 60fps during resize operations
```

**New text (insert after line 221):**
```
- [ ] Preview compilation timeout enforced at 3s (FR-037a)
```

**Rationale:** FR-037a specifies a 3-second timeout for preview compilation but has zero task coverage. T006 is the Split-Pane Layout task that creates the PreviewPane wrapper, making it the appropriate location for this acceptance criterion.

---

## Fix G3: Theme/Zoom Persistence Scope Clarification (MEDIUM)

**File:** tasks.md
**Location:** After line 112 (end of T002 Acceptance Criteria, before Constitution Check)
**Action:** INSERT

**New text:**
```
- [ ] SCOPE: Theme and zoom persistence deferred to Spec 007 (out of scope)
```

**Rationale:** Theme and zoom persistence were mentioned in the spec but are not currently implemented. Adding explicit scope clarification prevents confusion about what T002 is expected to deliver vs. what is deferred.

---

## Fix G6: Preview Visibility Persistence Not Tested (MEDIUM)

**File:** tasks.md
**Location:** After line 112 (insert before the SCOPE note, within T002 Acceptance Criteria)
**Action:** INSERT

**Current context (line 112):**
```
- [ ] Unit tests cover persistence round-trip
```

**New text (insert after line 112):**
```
- [ ] previewVisible state persisted and restored on app launch
```

**Rationale:** T002 handles UI layout persistence but doesn't explicitly test preview visibility persistence. The split ratio is tested but the preview toggle state also needs persistence verification.

---

## Fix G10: All P1 Stories via Keyboard Not Comprehensively Tested (MEDIUM)

**File:** tasks.md
**Location:** Line 389 (within T013 E2E Acceptance Criteria)
**Action:** REPLACE

**Current text:**
```
- [ ] Test: All keyboard shortcuts work
```

**New text:**
```
- [ ] Test: All keyboard shortcuts work (Cmd+N, Cmd+O, Cmd+S, Cmd+Shift+S, Cmd+W)
- [ ] Test: Complete P1 user story achievable via keyboard only (US1, US2, US3)
```

**Rationale:** The original criterion is too vague. This expands it to explicitly list the required shortcuts and adds comprehensive keyboard-only workflow testing for all P1 user stories.

---

## Fix G12: Dialog Focus Management Not Tested (MEDIUM)

**File:** tasks.md
**Location:** After line 271 (within T008 Acceptance Criteria)
**Action:** INSERT

**New text:**
```
- [ ] Dialog receives keyboard focus when shown
- [ ] Focus returns to editor after dialog dismissal
```

**Rationale:** Dialog focus management is listed in the Risk Mitigation section but not explicitly tested. T008 (Dirty Check Dialog) is the appropriate task since it implements the dialog functionality.

---

## Fix G13: Orphan File Detection Not Covered (MEDIUM)

**File:** tasks.md
**Location:** After line 320 (within T010 Acceptance Criteria)
**Action:** INSERT

**New text:**
```
- [ ] If file deleted externally, show "File not found" dialog with "Close" option
```

**Rationale:** T010 handles external modification detection but doesn't cover the case where the file is deleted (orphan detection). This edge case should be handled in the same focus-based check flow.

---

## Fix C6: 80% Test Coverage Threshold Not Explicit (MEDIUM)

**File:** tasks.md
**Location:** Line 368 (within T012 Acceptance Criteria)
**Action:** REPLACE

**Current text:**
```
- [ ] All tests pass in CI
```

**New text:**
```
- [ ] All tests pass in CI
- [ ] Unit test coverage >= 80% for new code (Constitution VI.4)
```

**Rationale:** Constitution Article VI.4 mandates 80% unit test coverage but this threshold isn't explicit in T012. Adding it ensures the coverage gate is enforced during validation.

---

## Fix D6: Keyboard Shortcuts Defined in Both T003 and T011 (MEDIUM)

**File:** tasks.md
**Location:** Line 338 (within T011 Acceptance Criteria)
**Action:** REPLACE

**Current text:**
```
- [ ] Menu items have correct accelerators (Cmd+N, Cmd+O, etc.)
```

**New text:**
```
- [ ] Menu accelerators match T003 shortcut definitions (single source of truth)
```

**Rationale:** T003 line 141 already defines the canonical shortcuts (Cmd+N, Cmd+O, Cmd+S, Cmd+Shift+S, Cmd+W). T011 should reference T003 rather than duplicating the definitions to maintain a single source of truth.

---

## Summary of Changes

| Fix ID | Severity | Issue | Task Modified | Action |
|--------|----------|-------|---------------|--------|
| G11 | HIGH | SC-010 error recovery untested | T012 | INSERT |
| G1 | MEDIUM | FR-037a (3s timeout) no coverage | T006 | INSERT |
| G3 | MEDIUM | Theme/zoom scope unclear | T002 | INSERT |
| G6 | MEDIUM | Preview visibility persistence | T002 | INSERT |
| G10 | MEDIUM | P1 keyboard testing incomplete | T013 | REPLACE |
| G12 | MEDIUM | Dialog focus management untested | T008 | INSERT |
| G13 | MEDIUM | Orphan file detection missing | T010 | INSERT |
| C6 | MEDIUM | 80% coverage threshold implicit | T012 | REPLACE |
| D6 | MEDIUM | Duplicate shortcut definitions | T011 | REPLACE |

---

## Application Order

Apply fixes in the following order to maintain line number accuracy:

1. **Fix D6** (line 338) - T011 shortcut reference
2. **Fix C6** (line 368) - T012 coverage threshold
3. **Fix G10** (line 389) - T013 keyboard testing
4. **Fix G13** (after line 320) - T010 orphan detection
5. **Fix G12** (after line 271) - T008 dialog focus
6. **Fix G1** (after line 221) - T006 preview timeout
7. **Fix G6** (after line 112) - T002 preview visibility
8. **Fix G3** (after line 112) - T002 scope note
9. **Fix G11** (after line 367) - T012 error recovery

Note: Fixes G6 and G3 both insert after line 112. Apply G6 first, then G3 will insert after the new line created by G6.
