# Ambiguity Analysis: AI Provider Abstraction Layer

**Feature Branch**: `028-ai-provider-abstraction`
**Analysis Date**: 2026-01-17
**Artifacts Analyzed**: spec.md, plan.md, tasks.md

---

## Summary

| Metric | Value |
|--------|-------|
| Total Issues Found | 8 |
| Critical (blocks implementation) | 1 |
| High (may cause inconsistencies) | 3 |
| Medium (clarification recommended) | 4 |
| Vague Adjectives | 3 |
| Unresolved Placeholders | 0 |
| Unclear Scope | 3 |
| Untestable Criteria | 2 |

---

## Ambiguity Issues

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| AMB-001 | High | spec.md:104-108 (Edge Cases) | Three edge cases are phrased as open questions without resolution: "How does the system handle network connectivity loss during provider validation?", "What happens when a provider API changes or deprecates endpoints?", "What happens when usage tracking storage exceeds reasonable limits?" | Convert each question to a definitive FR or clarification answer. Define specific behaviors, error messages, and fallback strategies. |
| AMB-002 | Medium | spec.md:107 | "reasonable limits" is vague - no measurable threshold defined for usage tracking storage limits | Define explicit limits (e.g., "100,000 records" or "50MB") and specify behavior when exceeded (e.g., FIFO pruning, warning threshold at 80%). Note: tasks.md:439 does specify "90-day retention, max 100K records" but this should be in spec.md as a formal requirement. |
| AMB-003 | Critical | spec.md:148 (SC-006) | "95% of users can successfully configure their first provider without documentation" - measurement methodology is unclear. "Automated onboarding analytics tracking completion rate" doesn't specify what constitutes "without documentation" or how to distinguish users who consulted docs vs. those who didn't. | Define precisely: (1) what triggers a measurement attempt, (2) what constitutes success vs. failure, (3) how documentation access is tracked or excluded. Consider rephrasing to measurable metric like "95% first-attempt success rate" with clear start/end conditions. |
| AMB-004 | Medium | spec.md:155 | "reasonably stable APIs" is subjective. No criteria for what constitutes acceptable API stability or how to handle instability. | Either remove this assumption or define fallback behavior when APIs are unstable (versioned SDK pinning, deprecation warning system, etc.). |
| AMB-005 | High | spec.md:127 (FR-015) | "estimated wait time" lacks specification of how to determine this when providers return inconsistent or no retry-after headers. | Specify fallback estimation logic (e.g., exponential backoff starting at 60s, or provider-specific defaults). Define format for displaying time to user. |
| AMB-006 | Medium | tasks.md:439 (P:3.6) | "90-day retention" and "max 100K records" are implementation details in tasks.md but not captured as formal requirements in spec.md. This creates ambiguity about whether these are firm requirements or implementation suggestions. | Elevate these to FR in spec.md to ensure they're treated as requirements, not arbitrary implementation choices. |
| AMB-007 | High | spec.md:143 (SC-001) | "within 2 minutes" is testable but lacks definition of start/end points. Does timer start when user opens settings or when they decide to add a provider? Does it end at "Connected" status or first successful AI request? | Define precise measurement points: e.g., "From clicking 'Add Provider' to seeing 'Connected' status indicator." |
| AMB-008 | Medium | plan.md:18 | "<16ms keystroke latency (unaffected)" is labeled as a performance goal but marked as "unaffected" without explanation. Unclear if this is a constraint to preserve or explicitly out of scope for this feature. | Clarify whether this is: (a) inherited from other specs to maintain, (b) explicitly not impacted by this feature, or (c) should be removed from this plan as irrelevant. |

---

## Vague Adjectives Detected

| Term | Location | Context | Issue |
|------|----------|---------|-------|
| "reasonably stable" | spec.md:155 | "AI providers maintain reasonably stable APIs" | No criteria for what constitutes "reasonably stable" |
| "reasonable limits" | spec.md:107 | "usage tracking storage exceeds reasonable limits" | No numeric threshold defined |
| "clear" | spec.md:32, 124 | "clear validation error", "clear error messages" | While commonly understood, could benefit from examples or format specification for consistency |

---

## Unresolved Placeholders

**None detected.** All TODO, TKTK, ???, and placeholder patterns were searched and none were found.

---

## Requirements with Unclear Scope

1. **FR-014** (spec.md:126): Lists capability types (text generation, embeddings, image generation, agents, multiagent systems, deep agents) but "agents", "multiagent systems", and "deep agents" are not defined elsewhere in the spec. These terms need definitions or references to where they're specified.

2. **FR-016** (spec.md:128): "detect and expose provider capability matrix" - the term "matrix" implies a specific data structure but the format is not defined. tasks.md defines this as arrays but the spec doesn't commit to a format.

3. **Local model support scope** (spec.md:69-82, 155): Mentions Ollama and LM Studio specifically, then assumes "OpenAI-compatible endpoints" as a common standard. The scope of "local model providers" is implicitly limited to OpenAI-compatible ones, but this isn't explicitly stated as a requirement or constraint.

---

## Acceptance Criteria Testability Issues

1. **spec.md:148 (SC-006)**: "95% of users can successfully configure their first provider without documentation" - Cannot be objectively tested because "without documentation" cannot be measured in the system. The clarification mentions "automated onboarding analytics" but doesn't specify how documentation access would be tracked.

2. **spec.md:146 (SC-004)**: "accurate within 1% of actual provider-reported usage" - Requires provider-reported usage as ground truth, but not all providers expose detailed usage APIs. Testing methodology for providers without usage APIs is undefined.

---

## Recommendations Priority

1. **Immediate (Critical)**: Resolve AMB-003 (SC-006 measurement methodology)
2. **Before Implementation**: Resolve AMB-001 (unanswered edge cases), AMB-005 (rate limit wait time), AMB-007 (SC-001 timing boundaries)
3. **During Implementation**: Address AMB-002, AMB-004, AMB-006, AMB-008 as they arise

---

## Files Analyzed

- `/Users/ww/dev/projects/mdxpad-ai/.specify/specs/028-ai-provider-abstraction/spec.md` (165 lines)
- `/Users/ww/dev/projects/mdxpad-ai/.specify/specs/028-ai-provider-abstraction/plan.md` (158 lines)
- `/Users/ww/dev/projects/mdxpad-ai/.specify/specs/028-ai-provider-abstraction/tasks.md` (977 lines)
