# Ambiguity Analysis: Application Shell (006)

**Analyzed Files**:
- `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/spec.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/plan.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/tasks.md`

**Date**: 2026-01-10

---

## Summary

The Application Shell specification is well-written overall with explicit measurable criteria for most requirements. The clarifications section resolves several potential ambiguities upfront. However, a few areas remain vague or lack testable success criteria.

**Findings by Severity**:
- HIGH: 2
- MEDIUM: 5
- LOW: 4

---

## Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| B1 | HIGH | spec.md:274 (SC-009) | "feel smooth" and "no perceptible lag" are subjective measures for window operations | Replace with measurable criteria: "resize operations must maintain >= 60fps as measured by frame timing; individual frame duration must not exceed 20ms" |
| B2 | HIGH | spec.md:275 (SC-010) | "Error states are always recoverable" lacks definition of what constitutes recovery | Define specific recovery scenarios: e.g., "after any error dialog, user can continue editing, save to alternate location, or close without data loss" |
| B3 | MEDIUM | spec.md:283 | "must not cause visible jank" - "visible" is subjective | Quantify: "Layout resize operations must maintain >= 60fps; no frame drops exceeding 16ms during drag operations" |
| B4 | MEDIUM | spec.md:285 | "excessive disk writes" - no threshold defined for what counts as excessive | Specify threshold: e.g., "settings persistence must not write more than once per 500ms" (note: plan.md mentions 500ms debounce but spec does not) |
| B5 | MEDIUM | spec.md:294 | "Focus management must be logical during dialog flows" - "logical" is ambiguous | Define expected focus sequence: e.g., "focus returns to editor after dialog dismissal; Tab key cycles through dialog buttons; Escape dismisses without action" |
| B6 | MEDIUM | spec.md:168 | "Enforce minimum window size, gracefully collapse panels" - no specific dimensions | Add specific dimensions: e.g., "minimum window size 600x400px; panels collapse to icon when below 100px" |
| B7 | MEDIUM | spec.md:169 | "Queue operations, show last opened file, maintain data integrity" for rapid file opens - no definition of queue behavior | Define queue semantics: e.g., "subsequent open requests cancel pending opens; only final file loads; no partial states visible" |
| B8 | LOW | spec.md:118 | "a dirty indicator (dot or asterisk)" - allows two different visual representations | Standardize on one indicator for consistency. Recommend dot to match typical macOS conventions |
| B9 | LOW | spec.md:256 | "zoomLevel (50-200)" without specifying units or meaning | Clarify: "zoomLevel represents font size percentage where 100 = default 14px base font" |
| B10 | LOW | tasks.md:340 | "Menu items enable/disable based on state (future)" - ambiguous about current scope | Clarify if this is in-scope deferred work or out-of-scope for this spec. If out-of-scope, remove from acceptance criteria |
| B11 | LOW | plan.md:26 | "standard hardware" for performance target (< 2s cold start) is undefined | Define reference hardware: e.g., "M1 MacBook with 8GB RAM" or defer to benchmark methodology document |

---

## Notes

**Well-Defined Areas** (not flagged):
- Preview update timing (500ms with 3s timeout) - specific and measurable
- Minimum pane width (100px) - explicitly clarified
- Status bar update timing (< 50ms) - measurable
- Dirty check behavior - thoroughly specified with dialog options
- External modification detection - explicitly scoped to focus-based only
- Split ratio range (0-1 for storage, 0.1-0.9 for clamping in tasks.md)

**Resolved Clarifications** (spec.md lines 26-32):
The spec includes a Clarifications section that proactively resolves several potential ambiguities about external modification detection, minimum pane width, error click behavior, compilation timeout, and document size limits. This is excellent practice.
