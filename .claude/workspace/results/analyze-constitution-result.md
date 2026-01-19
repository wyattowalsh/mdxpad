# Constitution Alignment Analysis: Template Library (016)

**Analysis Date**: 2026-01-17
**Artifacts Analyzed**:
- `/Users/ww/dev/projects/mdxpad-template/.specify/memory/constitution.md` (v1.1.0)
- `/Users/ww/dev/projects/mdxpad-template/.specify/specs/016-template-library/spec.md`
- `/Users/ww/dev/projects/mdxpad-template/.specify/specs/016-template-library/plan.md`
- `/Users/ww/dev/projects/mdxpad-template/.specify/specs/016-template-library/tasks.md`

---

## Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|-----------|-----------|---------| --------------|
| ALN-001 | **CRITICAL** | plan.md line 13; tasks.md T006 | **Article II Violation**: Plan specifies use of `gray-matter` library for template parsing, which is NOT in the pinned technology stack (Article II). New dependencies require constitution amendment. | Add `gray-matter` (or specify version) to Article II Technology Stack table, OR choose an alternative parsing approach using only approved technologies (e.g., manual YAML/frontmatter parsing with `zod` validation). Escalate to user for decision. |
| ALN-002 | **CRITICAL** | plan.md lines 22-41 (Constitution Check section) | **Article IX.1 Violation**: Constitution Compliance table mixes MUST/SHOULD/conditional ("WILL COMPLY", "TBD") without distinguishing mandatory gates from optional considerations. Per Article IX.1, status MUST clearly mark PASS/FAIL for MUST requirements. | Revise Constitution Check table to explicitly separate MUST requirements (must show PASS/FAIL with no TBD) from SHOULD requirements (may show conditional status). Mark any TBD MUST items as blockers requiring resolution before Phase 0 completion. |
| ALN-003 | **CRITICAL** | spec.md FR-015; plan.md line 34; tasks.md T008, T019 | **Article V Violation**: FR-015 requires "System MUST validate template MDX syntax before saving custom templates." This validation (compilation) is not explicitly budgeted in Article V performance budgets. If validation triggers MDX compile, it must meet Article V's 500ms budget OR have separate documented budget. | Add explicit performance budget for template validation/MDX compilation in plan.md. Test and verify validation completes within Article V's 500ms MDX compile budget. If exceeding, document rationale and escalate for architecture review per Article V escalation clause. |
| ALN-004 | **CRITICAL** | plan.md line 35 (Gate 3.2: Service Validation); tasks.md T008 | **Article III.3 Violation**: Plan lists IPC handlers but does not explicitly document that all template IPC payloads MUST be validated with zod on both ends (Article III.3 requirement: "All payloads MUST be validated with zod on both ends"). | Explicitly confirm in plan.md that all template IPC channels will use zod schema validation. Add to contracts/template-schemas.ts validation assertions. Include zod validation examples in T008 implementation. |
| ALN-005 | HIGH | spec.md edge cases; plan.md line 39 | **Article VII.3 Partial Alignment**: Edge cases state "display error indicator for affected items" but don't specify error message format. Article VII.3 requires "User-facing errors MUST be actionable and clear (no stack traces, no jargon)." | Define specific, actionable error messages for each edge case (corrupted template, invalid MDX, missing components). Add to spec's edge cases section or data-model.md with examples. Validate against Article VII.3 accessibility and clarity requirements. |
| ALN-006 | HIGH | spec.md SC-005; plan.md line 18 | **Article V Cross-Check**: SC-005 specifies "Custom template save operation completes within 2 seconds including validation." This is user-facing performance but not in Article V's hard budget table. Article V lists only MDX compile budget (500ms); template save with validation may exceed this if MDX validation required. | Clarify in plan.md: Does "save including validation" trigger MDX compilation? If yes, ensure total operation <= 500ms per Article V or document separate budget. If no, SC-005's 2s is acceptable (user-facing, not listed in Article V). Validate empirically during implementation. |
| ALN-007 | HIGH | tasks.md lines 361-367 (Batch 7.2: Tests) | **Article VI.4 Partial Clarity**: Tests are planned (T031-T033) but unit test file doesn't show target coverage >= 80% requirement per Article VI.4. Gate only checks TypeScript compilation, not coverage. | Add coverage target assertion to Gate 7.2 validation: `npx vitest run --coverage --reporter=v8`. Set minimum threshold to 80% for `src/renderer/lib/` per Article VI.4. Make gate fail if coverage below threshold. Document in plan.md. |
| ALN-008 | MEDIUM | plan.md line 102; spec.md lines 141-144 | **Article X Deferred Feature Risk**: Spec defines template import/export (FR-021, FR-022) and dynamic variables (FR-024) as core features, but these are not mentioned in Article X Deferred Decisions. However, Article X defers "Plugin system" and "Cloud sync" which could relate to template distribution. Clarify scope boundaries. | Confirm that FR-021 (import/export) and FR-024 (dynamic variables) are local-only features for v1.0 (not cloud/plugin sync). Update plan.md "Technical Context" section to explicitly state these are client-side only and do not attempt deferred plugin/cloud features. |

---

## Summary

**Total Issues**: 8
**Critical**: 4 (ALN-001, ALN-002, ALN-003, ALN-004)
**High**: 2 (ALN-005, ALN-006, ALN-007)
**Medium**: 1 (ALN-008)

### Critical Path Blockers

1. **ALN-001 (gray-matter dependency)**: Must resolve before T006 implementation. Requires constitution amendment OR technology substitution.
2. **ALN-002 (Constitution Check clarity)**: Must resolve before Phase 0 gate. Revise compliance table to distinguish MUST from SHOULD.
3. **ALN-003 (Performance budget missing)**: Must resolve before Phase 2 gate. Add explicit validation performance budget or confirm within Article V limits.
4. **ALN-004 (zod validation)**: Must resolve before T008 implementation. Ensure all IPC payloads have explicit zod validation per Article III.3.

### Recommended Actions

1. **Immediate** (before Phase 1 starts):
   - Resolve ALN-001: Approve gray-matter OR remove from plan
   - Resolve ALN-002: Revise Constitution Check table
   - Resolve ALN-003: Document template validation performance budget

2. **Before Phase 2 complete**:
   - Resolve ALN-004: Verify zod validation on all IPC channels
   - Resolve ALN-005: Finalize error message specifications

3. **Before Phase 7 (Testing)**:
   - Resolve ALN-007: Add coverage threshold to Gate 7.2

---

## Constitution Articles Referenced

- **Article II**: Technology Stack (pinned versions, no unlisted dependencies)
- **Article III.3**: IPC Contract Pattern (zod validation required)
- **Article V**: Performance Budgets (hard limits, >10% regression blocks merge)
- **Article VI.4**: Testing Requirements (>80% coverage for business logic)
- **Article VII.3**: Error Handling (actionable, clear, no jargon)
- **Article IX.1**: Plan Verification (Constitution Compliance section structure)
- **Article IX.3**: Conflict Resolution (halt if constitution violated)
- **Article X**: Deferred Decisions (clarify scope boundaries)
