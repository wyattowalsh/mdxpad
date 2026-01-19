# Specification Analysis Report: Autosave & Crash Recovery

**Feature**: 011-autosave-recovery
**Analysis Date**: 2026-01-17
**Artifacts Analyzed**: spec.md, plan.md, tasks.md, data-model.md, contracts/

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Issues Found | 45 |
| CRITICAL | 3 |
| HIGH | 13 |
| MEDIUM | 15 |
| LOW | 14 |
| Overall Coverage | 72% |
| Specification Readiness | 75% |

**Verdict**: ⚠️ **BLOCKED** - 3 CRITICAL constitution violations must be resolved before implementation can proceed.

---

## Critical Findings (Must Fix Before Implementation)

| ID | Category | Location | Summary | Resolution |
|----|----------|----------|---------|------------|
| C1 | Constitution | spec.md FR-009 | **Maximum autosave interval (10 min) violates Article VII.3** - Constitution mandates "minimum every 30 seconds if dirty". 10-minute max allows constitutional violation. | Change FR-009 max from 10 minutes to 30 seconds |
| C2 | Constitution | spec.md Assumptions | **Default interval assumption contradicts FR-009 range** - Assumptions states 30s default is correct, but FR-009 allows 10-min max. Inconsistent treatment of constitutional requirement. | Align FR-009 with constitutional mandate |
| C3 | Constitution | plan.md, tasks.md | **Article VI.4 IPC integration test verification incomplete** - Constitution requires "Integration tests REQUIRED for all IPC channels". No explicit enumeration of which 10 channels require tests. | Add explicit IPC channel list to T024 acceptance criteria |

---

## All Findings by Severity

### CRITICAL (3)

| ID | Category | Location | Summary |
|----|----------|----------|---------|
| C1 | Constitution | spec.md FR-009 | Maximum autosave interval (10 min) violates Article VII.3 mandate |
| C2 | Constitution | spec.md Assumptions | Default interval assumption contradicts FR-009 range |
| C3 | Constitution | plan.md, tasks.md | Article VI.4 integration test verification incomplete |

### HIGH (13)

| ID | Category | Location | Summary |
|----|----------|----------|---------|
| G1 | Coverage | spec.md Edge Cases | Disk space handling missing - no task for EC-1 |
| G2 | Coverage | spec.md Edge Cases | Read-only/locked document handling missing - no task for EC-2 |
| G3 | Coverage | spec.md Edge Cases | Corrupted recovery data handling missing - no task for EC-5 |
| G4 | Coverage | spec.md Edge Cases | Large document handling missing - no task for EC-6 |
| G5 | Coverage | spec.md SC-002 | Performance validation missing (<16ms main thread) |
| G6 | Coverage | spec.md SC-003 | Performance validation missing (<2s recovery dialog) |
| U1 | Underspec | spec.md:76 | "Disk space insufficient" edge case listed but no FR defines handling |
| U2 | Underspec | spec.md:77 | "Read-only/locked document" edge case listed but no FR defines handling |
| U3 | Underspec | spec.md:80 | "Corrupted recovery data" edge case listed but no FR defines handling |
| U4 | Underspec | spec.md:81 | "Very large documents" edge case listed but no FR defines handling |
| A1 | Ambiguity | spec.md:21 (US1-S2) | "without interrupting the user's editing flow" is subjective |
| A2 | Ambiguity | spec.md:116 (SC-002) | "without perceptible interruption" lacks quantified threshold |
| D1 | Duplication | spec.md FR-015 | Atomic write pattern described 3 times with varying detail |

### MEDIUM (15)

| ID | Category | Location | Summary |
|----|----------|----------|---------|
| G7 | Coverage | spec.md SC-001 | Recovery completeness validation missing (95% criterion) |
| G8 | Coverage | spec.md SC-004 | UX timing validation missing (<30s workflow) |
| G9 | Coverage | spec.md SC-006 | Data loss scenario testing missing |
| U5 | Underspec | spec.md:87 FR-001 | "document content" undefined (text? frontmatter? cursor?) |
| U6 | Underspec | spec.md:102 FR-016 | Diff view implementation unspecified (library, mode, fallback) |
| U7 | Underspec | spec.md:108 | "retention settings" mentioned but no FR defines behavior |
| U8 | Underspec | tasks.md:196 T009 | Toast dismissal behavior unspecified |
| U9 | Underspec | spec.md:93 FR-007 | Modal vs non-modal dialog behavior unclear |
| U10 | Underspec | spec.md:22 US1-S3 | Dirty state clearing after autosave ambiguous |
| A3 | Ambiguity | spec.md:76-82 | Edge cases listed as questions without answers |
| A4 | Ambiguity | spec.md:99 FR-013 | "subtle status indicator" is subjective |
| A5 | Ambiguity | spec.md:115 SC-001 | "95% of their work" lacks measurement method |
| A6 | Ambiguity | spec.md:52 US3-S1 | "identifying information" is vague |
| D2 | Duplication | spec.md FR-016 | External conflict handling described 3 times |
| D3 | Duplication | spec.md FR-007 | Dismiss vs decline behavior stated twice |

### LOW (14)

| ID | Category | Location | Summary |
|----|----------|----------|---------|
| G10 | Coverage | tasks.md T027 | Task lacks requirement traceability |
| U11 | Underspec | spec.md:115 SC-001 | "95% of their work" quantitative definition missing |
| U12 | Underspec | spec.md:116 SC-002 | "no visible lag" needs quantitative threshold |
| U13 | Underspec | tasks.md:311 T018 | save-as option not in spec FR-016 |
| U14 | Underspec | plan.md:20 | "max 50 recovery files" enforcement unspecified |
| A7 | Ambiguity | plan.md:18 | "recovery dialog < 2s" lacks specificity |
| A8 | Ambiguity | plan.md:20 | "max 50 recovery files" - hard or soft limit? |
| A9 | Ambiguity | spec.md:139 | 30s default interval lacks rationale |
| A10 | Ambiguity | tasks.md:176-177 | Test assumes default interval |
| D4 | Duplication | plan.md, spec.md | Recovery storage location mentioned twice |
| D5 | Duplication | tasks.md Phase 3 | Phase goal restates T008 description |
| I1 | Inconsistency | spec.md | FR-009 range (5s-10min) vs constitution (max 30s) |
| I2 | Inconsistency | tasks.md T018 | save-as option mentioned but not in spec |
| I3 | Inconsistency | plan.md | "max 50 files" not enforced in any task |

---

## Coverage Analysis

| Category | Total | Covered | Gaps | Coverage % |
|----------|-------|---------|------|------------|
| Functional Requirements (FR) | 16 | 16 | 0 | 100% |
| Success Criteria (SC) | 6 | 1 | 5 | 17% |
| User Stories | 4 | 4 | 0 | 100% |
| Edge Cases | 6 | 2 | 4 | 33% |
| **Overall** | **32** | **23** | **9** | **72%** |

### Edge Case Coverage Detail

| Edge Case | Description | Status |
|-----------|-------------|--------|
| EC-1 | Disk space insufficient | ❌ MISSING |
| EC-2 | Document read-only/locked | ❌ MISSING |
| EC-3 | App exits during autosave | ✅ Covered (atomic writes) |
| EC-4 | External file modification | ✅ Covered (FR-016, T017-T018) |
| EC-5 | Recovery data corrupted | ❌ MISSING |
| EC-6 | Large documents exceed interval | ❌ MISSING |

---

## Constitution Compliance

| Article | Requirement | Status | Issue |
|---------|-------------|--------|-------|
| II | TypeScript 5.9.x strict | ✅ PASS | - |
| III.1 | Main process file I/O | ✅ PASS | - |
| III.2 | contextIsolation: true | ✅ PASS | - |
| III.3 | IPC invoke/handle + zod | ✅ PASS | - |
| V | Keystroke < 16ms | ✅ PASS | - |
| VI.1 | JSDoc documentation | ✅ PASS | - |
| VI.2 | Functions max 50 lines | ✅ PASS | - |
| VI.4 | Integration tests for IPC | ⚠️ PARTIAL | No channel enumeration |
| VII.3 | Auto-save every 30s if dirty | ❌ **FAIL** | FR-009 allows 10-min max |

---

## Artifact Readiness

| Artifact | Status | Readiness | Action Needed |
|----------|--------|-----------|---------------|
| spec.md | Issues found | 75% | Add FR-017 to FR-021 for edge cases; fix FR-009 max interval |
| plan.md | Minor issues | 90% | Add diff library decision; add IPC channel list |
| tasks.md | Gaps found | 85% | Add T028-T034 for edge cases and performance tests |
| data-model.md | Clean | 100% | None |
| contracts/ | Clean | 100% | None |

---

## Recommended New Tasks

Based on gap analysis, the following tasks should be added:

| Task ID | Phase | Description | Addresses |
|---------|-------|-------------|-----------|
| T028 | 2.2 | Implement disk space check before autosave write | G1, U1 |
| T029 | 3.1 | Handle read-only/locked documents in useAutosave | G2, U2 |
| T030 | 4.1 | Implement recovery file validation with checksum | G3, U3 |
| T031 | 3.1 | Implement autosave queue with in-progress guard | G4, U4 |
| T032 | 7.1 | Add performance benchmark tests (<16ms autosave) | G5 |
| T033 | 7.3 | Add E2E performance test (<2s recovery dialog) | G6 |
| T034 | 7.3 | Add chaos/adversarial E2E tests for data loss | G9 |

---

## Next Actions

### 🚨 BLOCKING (Must complete before implementation)

1. **Fix FR-009 Maximum Interval**
   - Current: "maximum 10 minutes"
   - Required: "maximum 30 seconds" (per Constitution Article VII.3)
   - Location: `specs/011-autosave-recovery/spec.md` line ~99

2. **Add Missing Edge Case FRs**
   - Add FR-017: Disk space handling
   - Add FR-018: Read-only document handling
   - Add FR-019: Corrupted recovery file handling
   - Add FR-020: Large document handling
   - Location: `specs/011-autosave-recovery/spec.md`

3. **Add IPC Channel Enumeration**
   - List all 10 channels explicitly in T024 acceptance criteria
   - Reference: `contracts/autosave-ipc.ts`
   - Location: `specs/011-autosave-recovery/tasks.md`

### ⚠️ HIGH PRIORITY (Should complete before implementation)

4. **Add Performance Validation Tasks**
   - Add T032 for <16ms autosave benchmark
   - Add T033 for <2s recovery dialog test
   - Location: `specs/011-autosave-recovery/tasks.md`

5. **Resolve Duplication D1**
   - Consolidate atomic write pattern into FR-015 only
   - Remove redundant descriptions from Clarifications and Edge Cases
   - Location: `specs/011-autosave-recovery/spec.md`

### 📝 RECOMMENDED (Can complete during implementation)

6. **Quantify Ambiguous Criteria**
   - Define "without interrupting" as "<16ms main thread block"
   - Define "identifying information" field list
   - Specify diff library and UI mode

7. **Add Missing Tasks T028-T034**
   - Cover edge cases and performance validation
   - Update tasks.execution.yaml with new tasks

---

## Summary

The Autosave & Crash Recovery specification has **strong functional coverage** (100% of FRs) but **critical constitution violations** that must be addressed. The primary issue is FR-009 allowing a 10-minute maximum autosave interval when the constitution mandates a maximum of 30 seconds.

**Before implementation can proceed:**
1. Fix the constitution violation (FR-009 max interval)
2. Add missing edge case handling (4 unspecified scenarios)
3. Enumerate IPC channels for integration test verification

Once these blocking issues are resolved, the specification will be implementation-ready.
