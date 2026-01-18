# Ambiguity Analysis: Autosave & Crash Recovery

**Feature**: 011-autosave-recovery
**Analyzed Files**: spec.md, plan.md, tasks.md
**Date**: 2026-01-17

## Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| A1 | HIGH | spec.md:21 (US1-Scenario 2) | "without interrupting the user's editing flow" is subjective and unmeasurable | Define measurable criteria: e.g., "main thread blocked < 16ms" or "no visible input lag during autosave" |
| A2 | HIGH | spec.md:116 (SC-002) | "without perceptible interruption to user typing (no visible lag or pause)" lacks quantified threshold | Define specific latency threshold: e.g., "keystroke-to-display latency increase < 5ms during autosave operations" |
| A3 | MEDIUM | spec.md:76-82 (Edge Cases) | Several edge cases listed as questions without answers: disk space insufficient, read-only documents, corrupted recovery data, large documents exceeding interval | Resolve each edge case with specific behavior: error handling, fallback strategies, and user notifications |
| A4 | MEDIUM | spec.md:99 (FR-013) | "subtle status indicator" is subjective - what constitutes subtle? | Specify indicator type: e.g., "icon-only indicator (no text), muted color, max 16x16px in toolbar" |
| A5 | MEDIUM | spec.md:115 (SC-001) | "at least 95% of their work" lacks measurement method | Define how recovery percentage is measured: character count, document count, or time-weighted content |
| A6 | MEDIUM | spec.md:52 (US3-Scenario 1) | "identifying information" is vague - what fields constitute identifying info? | Specify exact fields: file path, timestamp, document title, preview snippet length, character count |
| A7 | LOW | plan.md:18 (Performance Goals) | "Autosave < 16ms main thread impact" is good but "recovery dialog < 2s" lacks specificity on what 2s measures | Clarify: time to render, time to fetch data, or total time from app launch to dialog visible? |
| A8 | LOW | plan.md:20 (Scale/Scope) | "max 50 recovery files" - is this a hard limit or soft limit? What happens at 51? | Specify behavior when limit reached: error, oldest deleted, warning shown? |
| A9 | LOW | spec.md:139 (Assumptions) | "default autosave interval of 30 seconds balances protection with performance" - no rationale for why 30s is balanced | Consider documenting the tradeoff analysis or making this configurable with user research backing |
| A10 | LOW | tasks.md:176-177 (Phase 3 Independent Test) | "wait 30s" assumes default interval but user might have configured different value | Test should use known interval or reset to default before test |

## Summary

- **CRITICAL**: 0 issues
- **HIGH**: 2 issues (A1, A2) - both relate to "perceptible/visible" lag without quantified thresholds
- **MEDIUM**: 4 issues (A3-A6) - unresolved edge cases and vague UI descriptions
- **LOW**: 4 issues (A7-A10) - minor clarifications needed

## Priority Recommendations

1. **Address A1 and A2 first**: The vague "no visible lag" criteria in both the acceptance scenario and success criteria could lead to disputes about whether the feature meets requirements. Recommend defining specific latency budgets (e.g., "< 16ms main thread block" is already in plan.md but not reflected in spec.md success criteria).

2. **Resolve edge cases (A3)**: The edge cases section lists important scenarios as questions. Before implementation, each should have a defined behavior to prevent implementation ambiguity.

3. **Quantify "identifying information" (A6)**: The recovery dialog's content should be explicitly specified to ensure consistent implementation.
