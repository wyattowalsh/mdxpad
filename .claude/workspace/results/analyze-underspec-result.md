# Underspecification Analysis: Autosave & Crash Recovery (011)

**Feature**: 011-autosave-recovery
**Analyzed**: 2026-01-17
**Artifacts**: spec.md, plan.md, tasks.md

---

## Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| U1 | HIGH | spec.md:76, Edge Cases | "What happens when disk space is insufficient for autosave?" listed as edge case but no handling specified in FR requirements | Add FR-017: "System MUST detect insufficient disk space before autosave write, show warning notification, skip autosave attempt, and retry on next interval. Notification should include option to free space or disable autosave." |
| U2 | HIGH | spec.md:77, Edge Cases | "How does autosave behave when the document is read-only or locked?" listed but not addressed in any requirement | Add FR-018: "System MUST skip autosave for read-only documents (external file permissions) and locked documents (open by another process). Status indicator should show 'Autosave unavailable: [reason]' state." |
| U3 | HIGH | spec.md:80, Edge Cases | "What happens when recovery data is corrupted or incomplete?" listed but no error handling specified | Add FR-019: "System MUST validate recovery file checksum on load. Corrupted entries show error in recovery dialog with 'Discard corrupted' option. Log corruption events for debugging." |
| U4 | HIGH | spec.md:81, Edge Cases | "How does the system handle very large documents that take longer to save than the autosave interval?" - no handling specified | Add FR-020: "System MUST skip overlapping autosave if previous write still in progress. Queue at most one pending autosave. Show 'Saving...' indicator if save exceeds 2 seconds." |
| U5 | MEDIUM | spec.md:87, FR-001 | "automatically save document content" - missing definition of what constitutes "document content" (just text? frontmatter? cursor position?) | Clarify FR-001: "Document content includes full MDX text with frontmatter. Cursor position stored in manifest metadata, not recovery file content. Unsaved filename tracked separately in RecoveryManifest.originalPath." |
| U6 | MEDIUM | spec.md:102, FR-016 | "present a conflict resolution dialog with diff view" - no specification of diff view implementation (inline, side-by-side, library to use) | Add to plan.md Technical Context: specify diff library (e.g., diff-match-patch or react-diff-viewer), diff display mode (side-by-side default), and fallback behavior if diff computation fails (show both versions without highlighting). |
| U7 | MEDIUM | spec.md:108, Key Entities | AutosaveSettings mentions "retention settings" but no retention behavior specified anywhere in FR requirements | Either remove "retention settings" from AutosaveSettings entity OR add FR-021: "System MUST automatically delete recovery files older than 7 days. Maximum 50 recovery files retained (oldest deleted when exceeded). Cleanup runs on app startup." |
| U8 | MEDIUM | tasks.md:196-197, T009 | "toast after 3 failures" - no specification of toast dismissal behavior, persistence, or action buttons | Specify in acceptance criteria: "Toast auto-dismisses after 8 seconds. Includes 'Retry Now' primary action and 'Disable Autosave' secondary action. Toast persists if user hovers over it." |
| U9 | MEDIUM | spec.md:93, FR-007 | "dismissing the dialog (ESC, X, click outside)" - spec mentions clicking outside but should clarify whether dialog is modal | Clarify FR-007: "Recovery dialog is modal. Clicking outside the dialog does NOT dismiss it (prevents accidental data loss). Only ESC key and X button dismiss while preserving recovery data." |
| U10 | MEDIUM | spec.md:22, US1 Scenario 3 | "dirty state indicator reflects unsaved changes until autosave completes" - ambiguous whether autosave completion clears dirty state | Clarify: "Autosave completion does NOT clear the dirty indicator in the UI. Only manual save (Cmd+S or File > Save) clears dirty state. Recovery file existence is independent of UI dirty state." |
| U11 | LOW | spec.md:115-120, Success Criteria SC-001 | "95% of their work" - no definition of how to measure this metric quantitatively | Refine SC-001: "Recovery file contains document content captured within (autosave_interval + debounce_delay) seconds before crash. Measured by comparing recovery file timestamp to crash timestamp in E2E tests." |
| U12 | LOW | spec.md:116, SC-002 | "no visible lag or pause" - subjective measure; needs quantitative threshold | Align with plan.md: "Autosave operation MUST complete without blocking main thread for >16ms (one frame at 60fps). Measured via performance.now() in unit tests." |
| U13 | LOW | tasks.md:311, T018 | "diff view, choose recovery/disk/save-as options" - save-as option not mentioned in spec FR-016 or acceptance criteria | Either add save-as to spec FR-016 ("User may choose: keep recovery version, keep disk version, or save as new file") OR remove from task description to maintain spec-task alignment. |
| U14 | LOW | plan.md:20, Constraints | "max 50 recovery files" mentioned but no enforcement mechanism or cleanup behavior specified in tasks | Add subtask under T004 or T005: "Implement recovery file limit enforcement - delete oldest files when count exceeds 50. Log deletions for user awareness." |

---

## Summary by Severity

| Severity | Count | Impact |
|----------|-------|--------|
| HIGH | 4 | Critical edge cases listed but unspecified - implementation will guess behavior |
| MEDIUM | 6 | Feature behavior and implementation details need clarification |
| LOW | 4 | Minor metric definitions and alignment issues |
| **TOTAL** | **14** | |

---

## Priority Recommendations

### 1. Address HIGH Issues (U1-U4) Before Implementation

All four HIGH issues correspond to edge cases explicitly called out in spec.md but never resolved with functional requirements:

- **U1** (Disk space): Affects T004 (AutosaveService) - needs error handling path
- **U2** (Read-only): Affects T008 (useAutosave hook) - needs skip condition
- **U3** (Corruption): Affects T005 (RecoveryService) - needs validation logic
- **U4** (Large docs): Affects T004/T008 - needs concurrency guard

**Action**: Add FR-017 through FR-020 to spec.md before Phase 2 begins.

### 2. Clarify Conflict Resolution (U6, U13)

The diff view and conflict resolution flow needs implementation guidance:
- Which diff library to use
- UI layout (side-by-side vs inline)
- What options users have (U13 mentions save-as but spec doesn't)

**Action**: Update plan.md Technical Context with diff library selection.

### 3. Define Retention Policy (U7, U14)

Recovery file lifecycle is mentioned but has no enforcement mechanism:
- AutosaveSettings entity references "retention settings"
- plan.md mentions "max 50 recovery files"
- No FR or task implements this behavior

**Action**: Add FR-021 for retention policy OR remove retention from entity definition.

---

## Specification Completeness Assessment

| Category | Status | Confidence |
|----------|--------|------------|
| User Stories (4 US) | PASS | HIGH |
| Functional Requirements (16 FR) | PARTIAL | MEDIUM - 4 edge cases unhandled |
| Success Criteria (6 SC) | PARTIAL | MEDIUM - some subjective measures |
| Edge Cases (6 defined) | FAIL | LOW - listed but not specified |
| Key Entities (4 defined) | PARTIAL | MEDIUM - retention undefined |
| Dependencies | PASS | HIGH |
| Error Handling | FAIL | LOW - gaps in error scenarios |

---

## Artifacts Readiness

| Artifact | Status | Action Needed |
|----------|--------|---------------|
| spec.md | 75% ready | Add FR-017 through FR-021 for edge cases |
| plan.md | 90% ready | Add diff library decision to Technical Context |
| tasks.md | 85% ready | Update T004/T005/T008 acceptance for error handling |
