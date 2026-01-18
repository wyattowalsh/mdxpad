# Completion Ambiguity Analysis: Autosave & Crash Recovery (011)

**Spec File**: `/Users/ww/dev/projects/mdxpad-persist/specs/011-autosave-recovery/spec.md`
**Analysis Date**: 2026-01-17
**Focus Area**: Completion Signals (Acceptance Criteria Testability, Measurable Definition of Done)

---

## Summary

| Status | Count |
|--------|-------|
| Clear | 8 |
| Partial | 7 |
| Missing | 3 |

---

## Ambiguity Findings

### 1. SC-001: "95% of work" Metric Undefined

**Category**: Completion
**Status**: Partial
**Spec Text (Line 113)**: "Users can recover at least 95% of their work after an unexpected application exit"
**Question Candidate**: How is "95% of work" measured? Is it 95% of document content bytes, 95% of characters, 95% of time since last manual save, or 95% of editing sessions? What constitutes the measurement baseline?
**Impact Score**: 4
**Rationale**: The metric is aspirational but unmeasurable without defining the unit of "work." Test cases cannot assert 95% without knowing what is being counted and compared against what baseline.

---

### 2. SC-002: "Perceptible Interruption" Lacks Measurable Threshold

**Category**: Completion
**Status**: Partial
**Spec Text (Line 114)**: "Autosave operations complete without perceptible interruption to user typing (no visible lag or pause)"
**Question Candidate**: What is the maximum acceptable latency in milliseconds for an autosave operation to be considered "imperceptible"? (e.g., <16ms for 60fps smooth typing, <50ms for unnoticed delay, <100ms for acceptable)
**Impact Score**: 3
**Rationale**: "Perceptible" is subjective. Performance tests need a concrete threshold to assert against. Different testers may judge "perceptible" differently.

---

### 3. SC-006: "Zero Data Loss" Measurement Undefined

**Category**: Completion
**Status**: Partial
**Spec Text (Line 118)**: "Zero data loss events reported after feature deployment (excluding user-declined recovery)"
**Question Candidate**: How will data loss events be detected and reported? Is there telemetry, user feedback mechanism, or automated monitoring? Over what time period is "zero" measured to consider the criterion met?
**Impact Score**: 4
**Rationale**: This is an operational metric requiring instrumentation to detect and report. Without defining the detection mechanism, the criterion is unverifiable post-deployment.

---

### 4. US1-AS1: "Recovery Location" Unspecified

**Category**: Completion
**Status**: Partial
**Spec Text (Line 20)**: "the document content is saved to a recovery location"
**Question Candidate**: What constitutes a valid recovery location? Is there a specific directory path, naming convention, or verification method to confirm successful autosave?
**Impact Score**: 2
**Rationale**: Tests need to verify autosave actually occurred. Without knowing where to check, tests cannot assert file creation or content correctness.

---

### 5. US1-AS2: "Editing Flow" Interruption Criteria Missing

**Category**: Completion
**Status**: Partial
**Spec Text (Line 21)**: "the autosave completes without interrupting the user's editing flow"
**Question Candidate**: What specific behaviors would constitute an interruption to editing flow? (e.g., cursor freeze >X ms, input queue blocked, UI freeze, focus loss, keystroke delay)
**Impact Score**: 2
**Rationale**: Similar to SC-002 but at acceptance scenario level. "Editing flow" is subjective without measurable criteria.

---

### 6. US1-AS3: Dirty State Indicator Behavior After Autosave

**Category**: Completion
**Status**: Partial
**Spec Text (Line 22)**: "dirty state indicator reflects unsaved changes until autosave completes"
**Question Candidate**: Should the dirty indicator clear after autosave, or only after manual save? What is the expected UI state immediately after autosave completes - dirty (still needs manual save) or clean (autosave counts as saved)?
**Impact Score**: 3
**Rationale**: The acceptance criterion specifies behavior "until autosave completes" but not the state after. This affects both UI behavior and user expectation around what "saved" means.

---

### 7. Edge Cases: No Definition of Done

**Category**: Completion
**Status**: Missing
**Spec Text (Lines 74-81)**: Six edge cases listed as questions without resolution or acceptance criteria
**Question Candidate**: Which edge cases must be handled for v1 release? What are the acceptance criteria for each prioritized edge case (disk space, read-only, mid-save crash, external modification, corrupted recovery, large documents)?
**Impact Score**: 5
**Rationale**: Edge cases are identified but completely unresolved. Implementation and testing cannot proceed without knowing expected behavior for these failure modes. This is the highest-impact gap.

---

### 8. FR-013: Graceful Failure Handling Undefined

**Category**: Completion
**Status**: Missing
**Spec Text (Line 99)**: "System MUST handle autosave failures gracefully without disrupting user workflow"
**Question Candidate**: What specific failure scenarios must be tested, and what constitutes "graceful" handling? (e.g., retry count, user notification, error logging, fallback behavior, silent fail vs alert)
**Impact Score**: 4
**Rationale**: "Gracefully" is subjective. Tests cannot verify graceful handling without knowing expected behavior: Should user see an error? How many retries? What UI feedback?

---

### 9. Recovery Data Validation Criteria Missing

**Category**: Completion
**Status**: Missing
**Spec Text (Lines 104-107)**: Key entity definitions (RecoveryFile, RecoveryManifest) without validation criteria
**Question Candidate**: What validation must pass for recovery data to be considered valid/complete? How do we test for and handle partial/corrupted recovery files? What makes a recovery file "usable" vs "unusable"?
**Impact Score**: 4
**Rationale**: The edge case "What happens when recovery data is corrupted or incomplete?" (line 80) has no answer. Tests cannot distinguish valid from invalid recovery files without criteria.

---

### 10. SC-003: "Application Start" Measurement Point Unclear

**Category**: Completion
**Status**: Partial
**Spec Text (Line 115)**: "Recovery dialog presents all recoverable documents within 2 seconds of application start"
**Question Candidate**: Is "application start" measured from process launch, Electron ready event, main window visibility, or renderer process ready state? What happens if recovery scanning exceeds 2 seconds with many files?
**Impact Score**: 2
**Rationale**: Electron apps have multiple lifecycle events. Tests need to know which event starts the 2-second clock. Also, failure behavior (timeout exceeded) is unspecified.

---

### 11. FR-009: Interval Configuration Bounds

**Category**: Completion
**Status**: Clear
**Spec Text (Line 95)**: "minimum 5 seconds, maximum 10 minutes"
**Question Candidate**: N/A
**Impact Score**: 1
**Rationale**: Specific bounds provided. Testable via UI validation and boundary value testing.

---

### 12. US2-AS2/AS3: Recovery Accept/Decline Outcomes

**Category**: Completion
**Status**: Clear
**Spec Text (Lines 37-38)**: "user accepts recovery, Then the recovered document opens" / "user declines recovery, Then the recovery data is discarded"
**Question Candidate**: N/A
**Impact Score**: 1
**Rationale**: Binary outcomes with clear assertions. Testable via UI interaction and state verification.

---

### 13. US4-AS3: Settings Persistence on Restart

**Category**: Completion
**Status**: Clear
**Spec Text (Line 70)**: "When the application restarts, Then the configured interval persists"
**Question Candidate**: N/A
**Impact Score**: 1
**Rationale**: Testable - change setting, restart app, verify setting retained.

---

### 14. US3-AS3: Selective Recovery

**Category**: Completion
**Status**: Clear
**Spec Text (Line 54)**: "When the user selects specific documents to recover, Then only the selected documents are restored"
**Question Candidate**: N/A
**Impact Score**: 1
**Rationale**: Testable - select subset, verify only those recovered, verify others discarded.

---

### 15. SC-005: Immediate Setting Effect

**Category**: Completion
**Status**: Clear
**Spec Text (Line 117)**: "Autosave setting changes take effect immediately without requiring application restart"
**Question Candidate**: N/A
**Impact Score**: 1
**Rationale**: Testable - change interval, verify next autosave uses new interval without restart.

---

### 16. US4-AS2: Disable Autosave Behavior

**Category**: Completion
**Status**: Clear
**Spec Text (Line 69)**: "When the user disables autosave, Then no automatic saves occur until re-enabled"
**Question Candidate**: N/A
**Impact Score**: 1
**Rationale**: Testable - disable, wait past interval, verify no recovery file created.

---

### 17. FR-008: Recovery Data Cleanup

**Category**: Completion
**Status**: Clear
**Spec Text (Line 94)**: "System MUST clear recovery data after a document is successfully manually saved"
**Question Candidate**: N/A
**Impact Score**: 1
**Rationale**: Testable - autosave occurs, manual save, verify recovery file deleted.

---

### 18. Default Autosave Interval

**Category**: Completion
**Status**: Clear
**Spec Text (Line 127)**: "Default autosave interval of 30 seconds"
**Question Candidate**: N/A
**Impact Score**: 1
**Rationale**: Explicit default provided. Testable via fresh install verification.

---

## Severity Summary

| Impact Score | Count |
|--------------|-------|
| 5 (Critical) | 1 |
| 4 (High) | 4 |
| 3 (Medium) | 2 |
| 2 (Low) | 3 |
| 1 (Clear) | 8 |

---

## High-Impact Questions (Impact >= 4)

1. **[Impact 5] Edge Case Resolution**: Which of the six listed edge cases (disk space, read-only, mid-save crash, external modification, corrupted recovery, large documents) must have defined handling behavior for v1 release? What are the acceptance criteria for each?

2. **[Impact 4] 95% Work Recovery Metric**: How is "95% of work" measured - what unit (bytes, characters, time-based), what baseline, and how is this validated in testing?

3. **[Impact 4] Graceful Failure Definition**: What specific behaviors constitute "graceful" failure handling for autosave failures? Retry policy, user notification, logging, fallback?

4. **[Impact 4] Recovery Data Validation**: What criteria determine whether recovery data is valid/complete vs corrupted/unusable? How should corrupted files be handled?

5. **[Impact 4] Zero Data Loss Detection**: How will data loss events be detected, reported, and measured post-deployment to validate SC-006?

---

## Recommended Clarification Questions (Priority Order)

1. **[Impact 5]** Please define the expected behavior for each of the six edge cases listed. Which must be handled for v1, and what are the acceptance criteria?

2. **[Impact 4]** How is "95% of work recovered" (SC-001) measured? What is the unit of measurement and baseline for comparison?

3. **[Impact 4]** What constitutes "graceful" failure handling (FR-013)? Please specify retry count, user notification behavior, and logging requirements.

4. **[Impact 4]** What validation determines whether recovery data is usable? How should corrupted/partial recovery files be handled?

5. **[Impact 4]** What instrumentation or mechanism will detect and report data loss events for SC-006 validation?

6. **[Impact 3]** Should the dirty state indicator clear after autosave completes, or only after manual save?

7. **[Impact 3]** What is the maximum acceptable autosave latency in milliseconds to meet the "no perceptible interruption" criterion?

---

## Overall Assessment

The spec has **good structural coverage** with clear functional requirements and basic acceptance scenarios following Given/When/Then format. The success criteria include measurable timing targets (2 seconds for dialog, 30 seconds default interval).

**Strengths:**
- Clear binary outcomes for accept/decline recovery flows
- Specific configuration bounds (5s-10min interval range)
- Explicit cleanup behavior after manual save
- Default values documented
- Dependencies clearly identified

**Critical Gaps:**
1. **Edge cases unresolved** - Six failure modes identified but no behavior defined
2. **Metrics unmeasurable** - "95% of work" and "zero data loss" lack measurement methodology
3. **Graceful handling undefined** - Key non-functional requirement without specification
4. **Recovery validation missing** - No criteria for valid vs corrupted recovery data

The spec is approximately **65% complete** from a testability standpoint. The edge cases section is particularly concerning as it acknowledges known unknowns without resolving them. Addressing the 5 high-impact clarifications above is essential before implementation can proceed safely.

**Recommended Action**: Prioritize edge case resolution (Finding 7) as it blocks multiple test scenarios and represents the highest risk to user data integrity.
