# Completion Ambiguity Analysis: 006-application-shell

**Spec File**: `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/spec.md`
**Analysis Date**: 2026-01-10
**Focus Area**: Completion Signals (Acceptance Criteria Testability, Measurable Definition of Done)

---

## Summary

The spec contains 10 Success Criteria (SC-001 through SC-010) and 41 Functional Requirements (FR-001 through FR-041). While many are well-defined with measurable outcomes, several have completion ambiguities that need clarification.

---

## Ambiguity Findings

### 1. SC-001: Full Document Workflow Timing

**Category**: completion
**Status**: Partial
**Spec Text**: "Users can complete a full document workflow (create → edit → save → close) in under 5 seconds excluding typing time"
**Question Candidate**: What constitutes "standard" user interaction speed for create/open/save/close operations? How is "excluding typing time" measured in automated tests - via stopwatch exclusion, or by using predefined test content?
**Impact Score**: 3
**Rationale**: The timing metric is defined but the measurement methodology is ambiguous. Testing requires consistent definition of what actions count as "workflow steps" vs "typing".

---

### 2. SC-003: Layout Preference Restoration Timing

**Category**: completion
**Status**: Partial
**Spec Text**: "Layout preferences are restored within 100ms of app launch (no visible flash of default state)"
**Question Candidate**: How is "100ms of app launch" measured - from process start, from window creation, or from first paint? What constitutes a "visible flash" - any frame showing default state, or a threshold duration?
**Impact Score**: 4
**Rationale**: The 100ms target is specific but the measurement point is ambiguous. A flash of even 50ms might be visible but under 100ms from one reference point while over from another.

---

### 3. SC-006: Status Bar Update Timing

**Category**: completion
**Status**: Partial
**Spec Text**: "Status bar updates within 50ms of state changes (cursor movement, error changes, save state)"
**Question Candidate**: How is the 50ms latency measured in practice - from user input event, from state change in store, or from React state update? What testing infrastructure validates sub-50ms updates?
**Impact Score**: 3
**Rationale**: 50ms is a very aggressive target. Without clear measurement points, tests may pass or fail inconsistently depending on where timing starts.

---

### 4. SC-007: Keyboard-Only P1 Completion

**Category**: completion
**Status**: Partial
**Spec Text**: "All P1 user stories are completable using only keyboard shortcuts"
**Question Candidate**: Does "keyboard shortcuts" include Tab navigation and Enter to confirm dialogs, or only explicit shortcuts like Cmd+S? Must native file dialogs be navigable by keyboard (which may depend on OS)?
**Impact Score**: 3
**Rationale**: Native file dialogs (open/save) are OS-controlled and may not be fully keyboard-navigable in all scenarios. The boundary of "keyboard only" needs definition.

---

### 5. SC-008: App Launch Timing

**Category**: completion
**Status**: Partial
**Spec Text**: "App launches to usable state within 2 seconds on standard hardware"
**Question Candidate**: What constitutes "standard hardware"? What defines "usable state" - window visible, editor focused, or first keystroke accepted? Is this cold start or warm start?
**Impact Score**: 4
**Rationale**: "Standard hardware" is undefined, making CI/CD testing non-deterministic. "Usable state" could mean different things (visible vs interactive).

---

### 6. SC-009: Smooth Window Operations

**Category**: completion
**Status**: Partial
**Spec Text**: "Window operations (resize, divider drag) feel smooth with no perceptible lag (60fps target)"
**Question Candidate**: How is 60fps measured during resize - frame timing logs, performance API, or visual inspection? Is occasional frame drop acceptable, or must it be 100% of frames at 60fps?
**Impact Score**: 2
**Rationale**: "No perceptible lag" is subjective. 60fps target is measurable but tolerance (e.g., P95 vs P100) is unspecified.

---

### 7. SC-010: Error State Recoverability

**Category**: completion
**Status**: Partial
**Spec Text**: "Error states are always recoverable - no action leaves the app in an unusable state"
**Question Candidate**: What specific error states must be tested? What defines "unusable state" - crash, frozen UI, or inability to save? Is there a test matrix of error scenarios?
**Impact Score**: 5
**Rationale**: This is a critical safety requirement with no enumerated test cases. Without a defined list of error scenarios, testers cannot verify completeness.

---

### 8. FR-003: Minimum Pane Widths

**Category**: completion
**Status**: Missing
**Spec Text**: "System MUST enforce minimum widths for each pane (neither can be resized below usability threshold)"
**Question Candidate**: What are the specific minimum pixel widths for editor and preview panes? What constitutes "usability threshold"?
**Impact Score**: 4
**Rationale**: No numeric values provided. Implementers and testers have no concrete target to verify against.

---

### 9. FR-037: Preview Compilation Trigger

**Category**: completion
**Status**: Partial
**Spec Text**: "System MUST wire editor content changes to trigger preview compilation"
**Question Candidate**: What is the debounce/throttle timing for compilation triggers? Is compilation triggered on every keystroke, on pause, or on explicit action?
**Impact Score**: 3
**Rationale**: SC-002 mentions "500ms of typing pause" but FR-037 doesn't cross-reference this. The completion criteria for this requirement needs explicit debounce specification.

---

### 10. User Story 1 - Scenario 2: Preview Update Timing

**Category**: completion
**Status**: Clear
**Spec Text**: "the preview updates to reflect the changes within 500ms of typing pause"
**Question Candidate**: N/A - This is well-specified.
**Impact Score**: 1
**Rationale**: Good example of measurable acceptance criterion. No ambiguity.

---

### 11. User Story 5 - Scenario 5: Error Click Behavior

**Category**: completion
**Status**: Partial
**Spec Text**: "the error details are shown (or focus moves to first error in preview)"
**Question Candidate**: Should clicking the error count show a popup/panel, navigate to the error in preview, or jump to the error line in the editor? The "or" suggests multiple valid implementations - which is the acceptance target?
**Impact Score**: 3
**Rationale**: The word "or" introduces ambiguity. Testers don't know which behavior to verify.

---

### 12. Edge Case: External File Deletion

**Category**: completion
**Status**: Missing
**Spec Text**: "Show a warning and mark document as 'orphaned' with option to save elsewhere"
**Question Candidate**: Is external file deletion detection in scope for this spec? What triggers the check - a timer, focus event, or save attempt? What does "orphaned" state look like in UI?
**Impact Score**: 3
**Rationale**: Edge case is described but no acceptance scenario or FR covers it. Unclear if it's in scope or just documented for future reference.

---

### 13. Edge Case: External File Modification

**Category**: completion
**Status**: Missing
**Spec Text**: "Detect change and prompt user to reload or keep current version"
**Question Candidate**: Is external modification detection in scope? The Out of Scope section lists "File watching for external changes (separate spec)" - this contradicts the edge case description.
**Impact Score**: 4
**Rationale**: Direct contradiction between Edge Cases and Out of Scope sections. Needs clarification on what's actually deliverable.

---

### 14. Edge Case: Preview Compilation Timeout

**Category**: completion
**Status**: Missing
**Spec Text**: "timeout after reasonable period"
**Question Candidate**: What is the "reasonable period" timeout value in milliseconds? What UI is shown when timeout occurs?
**Impact Score**: 3
**Rationale**: No specific timeout value provided, making testing impossible without arbitrary choice by implementer.

---

### 15. NFR: Settings Persistence Debounce

**Category**: completion
**Status**: Missing
**Spec Text**: "Settings persistence must be debounced to avoid excessive disk writes"
**Question Candidate**: What is the debounce duration? What constitutes "excessive" disk writes?
**Impact Score**: 2
**Rationale**: Implementation detail but affects testability. Cannot verify "not excessive" without threshold.

---

## Severity Summary

| Impact Score | Count |
|--------------|-------|
| 5 (Critical) | 1     |
| 4 (High)     | 4     |
| 3 (Medium)   | 7     |
| 2 (Low)      | 2     |
| 1 (Clear)    | 1     |

---

## Recommended Clarification Questions (Priority Order)

1. **[Impact 5]** What is the exhaustive list of error states that must be tested for SC-010 recoverability? Can you provide a test matrix?

2. **[Impact 4]** What are the specific minimum pixel widths for editor (FR-003) and preview panes?

3. **[Impact 4]** What measurement reference point defines "100ms of app launch" for SC-003 - process start, window creation, or first paint?

4. **[Impact 4]** What hardware specs define "standard hardware" for the 2-second launch requirement (SC-008)?

5. **[Impact 4]** Is external file modification detection in scope? Edge cases mention it but Out of Scope explicitly excludes "File watching for external changes."

---

## Overall Assessment

The spec has **strong measurable outcomes** in the Success Criteria section with specific timing targets (500ms, 100ms, 50ms, 2s). However, there are gaps in:

1. **Measurement methodology** - When do timers start/stop?
2. **Concrete thresholds** - Some requirements use subjective terms like "usability threshold" or "reasonable period"
3. **Test case enumeration** - Critical safety requirements (SC-010) lack specific test scenarios
4. **Scope boundary** - Contradiction between edge cases and out-of-scope sections

The spec is approximately **75% complete** from a testability standpoint. Addressing the high-impact clarifications above would bring it to production-ready Definition of Done quality.
