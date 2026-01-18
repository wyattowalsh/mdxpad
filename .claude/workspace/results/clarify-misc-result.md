# Clarification Analysis: Misc / Placeholders

**Spec File**: `/Users/ww/dev/projects/mdxpad-persist/specs/011-autosave-recovery/spec.md`
**Category**: Misc / Placeholders
**Focus Areas**: TODO markers, unresolved decisions, ambiguous adjectives lacking quantification
**Analyzed**: 2026-01-17

---

## Summary

The spec has several ambiguous adjectives that lack precise quantification and contains unresolved edge case questions that function as implicit TODOs. While core requirements are reasonably specified, implementation details around error handling and edge cases need clarification.

| Status | Count |
|--------|-------|
| Clear | 2 |
| Partial | 4 |
| Missing | 1 |

---

## Findings

### 1. TODO Markers / Unresolved Decisions: Edge Case Questions

**Location**: Lines 74-82
**Status**: **Missing**
**Impact Score**: 5/5

**Text**: Six edge case questions listed without corresponding answers or requirements:
- Line 76: "What happens when disk space is insufficient for autosave?"
- Line 77: "How does autosave behave when the document is read-only or locked?"
- Line 78: "What happens if the application exits during an autosave write operation?"
- Line 79: "How are conflicts handled if the source file was modified externally between autosaves?"
- Line 80: "What happens when recovery data is corrupted or incomplete?"
- Line 81: "How does the system handle very large documents that take longer to save than the autosave interval?"

**Question Candidate**: Should all six edge cases have explicit requirements added to the spec, or should some be documented as out of scope for initial implementation? For those in scope, what are the specific behaviors?

**Rationale**: Unresolved edge cases lead to undefined behavior during implementation. These are not just hypothetical - they represent realistic failure scenarios users will encounter. Without explicit requirements, developers must make ad-hoc decisions that may conflict with intended UX.

---

### 2. Ambiguous Adjective: "gracefully" (Line 99)

**Location**: FR-013
**Text**: "System MUST handle autosave failures gracefully without disrupting user workflow"
**Status**: **Partial**
**Impact Score**: 4/5

**Question Candidate**: What specific behaviors define "graceful" handling of autosave failures? Options include:
- (a) Silent retry with exponential backoff
- (b) Show non-blocking notification to user
- (c) Log error and continue without notification
- (d) Combination with specific retry limits and escalation

**Rationale**: "Gracefully" is a subjective term. Without concrete behavior specification, implementations may vary from silently swallowing errors (potential data loss) to intrusive error dialogs (disrupts workflow). This directly impacts user experience during failure scenarios.

---

### 3. Ambiguous Phrase: "perceptible interruption" (Line 115)

**Location**: SC-002 (Success Criteria)
**Text**: "Autosave operations complete without perceptible interruption to user typing (no visible lag or pause)"
**Status**: **Partial**
**Impact Score**: 3/5

**Question Candidate**: What is the maximum acceptable latency (in milliseconds) for autosave operations to be considered "imperceptible"? Options:
- (a) <16ms (single frame at 60fps)
- (b) <50ms (typical human perception threshold)
- (c) <100ms (noticeable but acceptable)
- (d) Other specific threshold?

**Rationale**: While the parenthetical clarifies "no visible lag or pause", this remains subjective without a quantified threshold. For testing and performance validation, a specific latency budget is needed.

---

### 4. Ambiguous Adjective: "sensible defaults" (Line 62)

**Location**: User Story 4 - Why this priority
**Text**: "autosave should work well with sensible defaults"
**Status**: **Partial**
**Impact Score**: 2/5

**Question Candidate**: Are the defaults (30-second interval from Assumptions, autosave enabled by default) confirmed as the "sensible defaults", or should these be validated through user research?

**Rationale**: "Sensible" is subjective. The 30-second default in Assumptions (line 127) partially addresses this, but it's mentioned as a balancing assumption rather than a firm requirement. Low impact since reasonable guidance exists.

---

### 5. Ambiguous Phrase: "identifying information" (Line 52)

**Location**: User Story 3, Acceptance Scenario 1
**Text**: "all recoverable documents are listed with identifying information"
**Status**: **Partial**
**Impact Score**: 3/5

**Question Candidate**: What specific identifying information should be shown for each recoverable document in the recovery dialog? Options:
- (a) File name only
- (b) File name + path
- (c) File name + path + timestamp
- (d) File name + path + timestamp + file size
- (e) File name + path + timestamp + content preview snippet

**Rationale**: Without explicit UI specification, developers must guess what information is meaningful to users. This affects both UI design and the data that must be stored in the RecoveryManifest entity.

---

### 6. Quantified Default: Autosave Interval Range (Line 95)

**Location**: FR-009
**Text**: "System MUST provide settings to configure autosave interval (minimum 5 seconds, maximum 10 minutes)"
**Status**: **Clear**
**Impact Score**: 1/5

**Note**: The range is properly quantified with minimum (5 seconds) and maximum (10 minutes). No ambiguity.

---

### 7. Quantified Success Criteria (Lines 113-118)

**Location**: Success Criteria SC-001 through SC-006
**Status**: **Clear**
**Impact Score**: 1/5

**Note**: Success criteria are well-quantified:
- SC-001: "95% of their work"
- SC-003: "within 2 seconds"
- SC-004: "under 30 seconds"
- SC-005: "immediately without requiring application restart"

The only partial quantification is SC-002 ("perceptible interruption" - addressed in Finding #3).

---

## Summary Table

| # | Ambiguity | Status | Impact | Line(s) |
|---|-----------|--------|--------|---------|
| 1 | Edge case questions (implicit TODOs) | Missing | 5/5 | 74-82 |
| 2 | "gracefully" undefined | Partial | 4/5 | 99 |
| 3 | "perceptible interruption" unquantified | Partial | 3/5 | 115 |
| 4 | "sensible defaults" vague | Partial | 2/5 | 62 |
| 5 | "identifying information" undefined | Partial | 3/5 | 52 |
| 6 | Autosave interval range | Clear | 1/5 | 95 |
| 7 | Success criteria metrics | Clear | 1/5 | 113-118 |

---

## Recommended Priority for Clarification

**Critical Priority** (Impact 5):
1. **Edge case resolution** - All six edge case questions (lines 76-81) need explicit requirements or documented scope exclusion

**High Priority** (Impact 4):
2. **Graceful failure definition** - What specific behaviors constitute "graceful" handling of autosave failures?

**Medium Priority** (Impact 3):
3. **Perceptible latency threshold** - What is the maximum acceptable latency (ms) for autosave operations?
4. **Identifying information fields** - What specific metadata should appear in the recovery dialog for each document?

**Lower Priority** (Impact 1-2):
5. **Sensible defaults confirmation** - Confirm 30-second default interval and autosave-enabled default are final

---

## Recommended Clarification Questions (Sorted by Impact)

1. **[Impact 5]** Should all six edge cases (disk space, read-only documents, exit during write, external modification conflicts, corrupted recovery data, large documents) have explicit requirements added, or should some be documented as out of scope? For those in scope, what are the expected behaviors?

2. **[Impact 4]** What specific behaviors define "graceful" handling of autosave failures? Should the system: (a) retry silently with exponential backoff, (b) show a non-blocking notification after N failures, (c) log errors without user notification, or (d) some combination?

3. **[Impact 3]** What is the maximum acceptable latency (in milliseconds) for autosave operations to be considered "imperceptible" for SC-002 testing purposes?

4. **[Impact 3]** What specific identifying information should be displayed for each recoverable document in the recovery dialog (file name, path, timestamp, size, preview snippet)?
