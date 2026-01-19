# Ambiguity Analysis: Frontmatter Visual Editor (020-frontmatter-editor)

**Analysis Date**: 2026-01-17
**Files Analyzed**:
- `/Users/ww/dev/projects/mdxpad-front/.specify/specs/020-frontmatter-editor/spec.md`
- `/Users/ww/dev/projects/mdxpad-front/.specify/specs/020-frontmatter-editor/plan.md`
- `/Users/ww/dev/projects/mdxpad-front/.specify/specs/020-frontmatter-editor/tasks.md`

---

## Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| AMB-001 | Medium | spec.md line 149 (SC-004) | "95% of common frontmatter values" lacks definition of what constitutes "common" values | Define explicit list of common value patterns (e.g., ISO dates, numeric strings, boolean literals, arrays of primitives) or reference test fixtures with specific examples |
| AMB-002 | Low | spec.md line 103 | "most recent change wins" conflict resolution lacks timing threshold | Define debounce window (e.g., 300ms) within which edits are consolidated, and specify behavior when edits occur within vs. outside that window |
| AMB-003 | Low | spec.md line 131 (FR-016) | "preserve YAML formatting preferences when possible" - undefined success criteria for "when possible" | Define specific scenarios where preservation is guaranteed vs. best-effort (e.g., "preserve for top-level scalars; may normalize indentation for nested objects") |
| AMB-004 | Low | spec.md line 98 | "collapsible tree structure with edit capability at each level" - maximum nesting depth undefined | Specify max supported depth (e.g., 3 levels) and fallback behavior for deeper structures (raw YAML mode only) |
| AMB-005 | Low | plan.md line 119, tasks.md line 398 | "depth limit (2 levels)" mentioned in implementation but not specified in requirements | Add FR or assumption in spec.md stating nesting depth limit explicitly to align spec with planned implementation |
| AMB-006 | Low | spec.md line 168 | "advanced formats may be added later" - unclear scope and timeline | Either remove or convert to explicit non-goal: "JSON Schema only; advanced formats (YAML Schema, custom validators) are out of scope for this spec" |
| AMB-007 | Low | spec.md line 99 | "shows a warning" for unsupported YAML features - warning severity/appearance undefined | Specify warning UI (toast, inline banner, field-level icon) and whether it blocks editing or is informational only |
| AMB-008 | Info | tasks.md lines 398-399 vs spec.md line 98 | Phase 8 depth limit "2 levels" inconsistent with spec.md edge case "each level" (implies unlimited) | Reconcile: either spec allows unlimited with graceful degradation, or tasks enforce hard limit matching spec |

---

## Summary

**Total Issues Found**: 8
- **Critical**: 0
- **Medium**: 1
- **Low**: 6
- **Info**: 1

---

## Positive Observations

The specification demonstrates strong clarity in several areas:

1. **Explicit Timing Requirements**: Performance metrics are well-defined with specific thresholds:
   - 300ms sync latency (SC-003, FR-009)
   - 100ms validation feedback (SC-005)
   - 200ms panel open time (SC-006)

2. **No Unresolved Placeholders**: No TODO, TKTK, ???, or other placeholder markers found in any file.

3. **No Vague Adjectives**: Terms like "fast," "scalable," "secure," "intuitive," or "robust" are either absent or consistently defined with measurable criteria.

4. **Clear Acceptance Scenarios**: All 5 user stories have well-structured Given/When/Then acceptance criteria.

5. **Explicit Field Type Enumeration**: FR-005 clearly lists all supported field types with no ambiguity.

6. **Schema Precedence Defined**: FR-012 explicitly states the precedence order for schema detection.

---

## Recommendations Priority

### P1 (Resolve before implementation)
- **AMB-001** (SC-004): Define "common frontmatter values" with test fixtures to enable accurate success criteria validation

### P2 (Resolve before testing)
- **AMB-005**: Align spec.md with planned 2-level depth limit in implementation
- **AMB-003**: Define YAML formatting preservation boundaries

### P3 (Resolve before production)
- **AMB-002, AMB-004, AMB-006, AMB-007**: Edge case refinements that affect UX quality but not core functionality

---

## Conclusion

**Spec Quality: GOOD** - The specification is well-structured with minimal ambiguity. The primary issue (AMB-001) affects success criteria measurability but not implementation feasibility. The remaining issues are edge-case behaviors and scope boundaries that can be resolved through clarification without blocking development.

### Recommended Actions
1. Add explicit test fixtures or examples defining "common frontmatter values" for SC-004
2. Add nesting depth limit (2 levels) as FR or assumption in spec.md
3. Clarify YAML formatting preservation scope in FR-016
