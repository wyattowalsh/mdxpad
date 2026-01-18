# Underspecification Analysis: Smart Filtering for File Tree (014)

**Analysis Date**: 2026-01-17
**Artifacts Analyzed**:
- `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/spec.md`
- `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/plan.md`
- `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/tasks.md`

**Supporting Documents Also Reviewed**:
- `data-model.md`, `research.md`, `quickstart.md`, `contracts/filter-schemas.ts`, `contracts/filter-commands.ts`

---

## Summary

The Smart Filtering feature artifacts are **well-specified overall**, with thorough data models, clear acceptance criteria, and comprehensive task breakdowns. However, several underspecification issues were identified across severity levels.

---

## Underspecification Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| US-001 | **CRITICAL** | spec.md (Edge Cases), data-model.md, contracts/filter-schemas.ts | **Max filter query length inconsistency**: spec.md mentions "truncate or limit input length gracefully" but provides no max length. data-model.md defines `MAX_FILTER_QUERY_LENGTH = 100`, but contracts/filter-schemas.ts defines `FILTER_QUERY_MAX_LENGTH = 256`. Implementation cannot proceed without knowing which value to use. | Reconcile constants in spec.md and ensure single source of truth. Recommend spec.md explicitly state max length and update data-model.md constant to match contracts schema (256). |
| US-002 | **HIGH** | spec.md (FR-006, Clarifications), research.md, tasks.md (T012-T014, Phase 5 header, Notes) | **Keyboard shortcut mismatch between spec and implementation**: Spec.md FR-006 states "Cmd/Ctrl+Shift+F" but research.md discovered conflict with Find/Replace and tasks.md specifies "Mod+P" instead. No formal spec amendment. User Story 4 acceptance criteria implicitly reference the original shortcut ("press Cmd/Ctrl+Shift+F"). | Update spec.md FR-006, Clarifications section, and US4 acceptance criteria to reflect resolved shortcut (`Mod+P`). Document the conflict resolution decision formally. |
| US-003 | **HIGH** | spec.md (User Story 3), data-model.md, quickstart.md | **Folder matching and highlighting behavior underspecified**: User Story 3 AC3 says "folder name is also highlighted" but unclear if fuzzy matching applies to full path or just the visible folder name. fzf selector in quickstart.md uses `item.path` for matching, but highlighting examples only show filename rendering. When folder "MyFolder" is shown as tree node, which positions get highlighted - path match positions or name-relative positions? | Clarify whether folders match by full path or name only, and specify whether match positions are relative to path (need remapping for display) or name (simpler but less flexible). |
| US-004 | **MEDIUM** | spec.md (Edge Cases), tasks.md (T021) | **File system change behavior underspecified**: Edge case states "Filter results update automatically" when files are added/deleted/renamed (FR-009). T021 says "Subscribe to file tree changes in store" but no specification for: (a) debounce strategy for rapid FS events, (b) whether to re-run full filter or use incremental update, (c) whether user sees loading state during re-filter, (d) behavior if file currently selected in editor is deleted. | Add FR specifying FS change handling: recommend piggybacking on existing file watcher debounce (if any), use full re-filter for simplicity, no loading indicator for small projects. |
| US-005 | **MEDIUM** | spec.md (User Story 5 AC3), data-model.md | **Multi-project/workspace filter isolation underspecified**: US5 AC3 says "filter state is specific to that project" but no spec for: (a) what constitutes a "project" (directory path? workspace file? git root?), (b) behavior when opening multiple projects simultaneously (if supported), (c) cleanup policy for stale localStorage entries from projects no longer opened. | Define "project" explicitly (recommend: project root path as determined by file-system-shell spec 004). Defer multi-project and cleanup to future scope or document as intentionally deferred. |
| US-006 | **MEDIUM** | spec.md (Edge Cases, FR-004), data-model.md (FilterVisibility), tasks.md (T020) | **Ancestor-only folder visual distinction undefined**: spec.md mentions "Parent folders of matching items remain visible" (FR-004) and data-model.md defines `FilterVisibility = 'ancestor-only'` state. However, no specification for how ancestor-only folders should look different from direct matches. T020 references edge case handling but lacks visual spec. | Add visual specification: ancestor-only folders should NOT be highlighted (no match positions), only direct matches get highlighting. Optionally, ancestor-only could use dimmed/muted text style to distinguish. |
| US-007 | **MEDIUM** | spec.md (FR-011), tasks.md (T020) | **Empty state UX underspecified**: FR-011 requires "clear empty state message when no files match" and data-model.md defines `FILTER_EMPTY_STATE_MESSAGE = 'No files match your filter'`. However: (a) no spec for visual design (icon? centered text? position in tree area?), (b) no action affordance (should empty state have "Clear filter" link/button?), (c) no behavior for empty state when no files exist in project at all (vs. filter matches nothing). | Add mockup description or wireframe reference for empty state. Recommend: centered message with clear filter action button below. Distinguish "no files match filter" from "project is empty" (latter shows different message). |
| US-008 | **MEDIUM** | contracts/filter-schemas.ts, data-model.md | **PersistedFilterData schema mismatch with implementation**: filter-schemas.ts defines `PersistedFilterDataSchema` with `query` and `updatedAt` fields, but data-model.md persistence section (5.3) says "Simple string value, no JSON wrapper needed" and stores only the query string. Implementation conflict. | Reconcile persistence format. Recommend: use simple string (per data-model.md) for minimal storage overhead. Update filter-schemas.ts to remove `PersistedFilterDataSchema` or mark it as deprecated/unused. Alternatively, update data-model.md to use structured persistence with timestamp. |
| US-009 | **LOW** | spec.md (FR-003a), research.md, quickstart.md | **Case-insensitive vs smart-case clarification needed**: FR-003a specifies "case-insensitive matching" but research.md and quickstart.md configure fzf with `casing: 'smart-case'` (lowercase query = insensitive, uppercase = sensitive). These are different behaviors. | Decide and document: if true case-insensitive is required, change fzf config to `casing: 'case-insensitive'`. If smart-case is acceptable (more powerful), update FR-003a to specify "smart-case matching (case-insensitive when query is lowercase, case-sensitive when query contains uppercase)". |
| US-010 | **LOW** | spec.md (User Story 4 AC2), tasks.md (T014) | **Focus restoration after Escape undefined**: US4 AC2 says "focus returns to the previous element" when Escape is pressed after clearing filter. No implementation spec for tracking previous focus or fallback behavior. | Recommend: simplify spec to "focus returns to file tree" (deterministic fallback) rather than tracking arbitrary previous focus. Update AC2 to specify the target element. |
| US-011 | **LOW** | spec.md (User Story 2 AC3), research.md | **Match ranking criteria not explicitly specified**: US2 AC3 mentions "ranked by match quality" but no specification for what quality means or how ties are broken. research.md mentions fzf tiebreaker (shorter path wins) but this is implementation detail, not spec. | Document ranking criteria in spec.md: "Matches ranked by fzf score (position and density weighting); ties broken by shorter path length." This is informational; no implementation change needed if fzf defaults are acceptable. |

---

## Cross-Reference Issues

| ID | Type | Source | Target | Issue |
|----|------|--------|--------|-------|
| CR-001 | Missing Reference | tasks.md T006 | `src/renderer/stores/file-explorer-store.ts` | Task references extending "existing" store but no spec verifies store exists or defines expected current shape. Dependency on spec 004/006 is implicit. |
| CR-002 | Missing Reference | tasks.md T009 | `src/renderer/components/file-explorer/FileExplorer.tsx` | Task references "existing" component for integration but no spec defines integration points or required component API. |
| CR-003 | Missing Reference | tasks.md T012 | `command-registry-store.ts` | Task references existing command registry for shortcut registration but registration API contract not included in this feature's contracts folder. |
| CR-004 | Type Inconsistency | data-model.md (FilterQuery) | contracts/filter-schemas.ts (FilterQuery) | data-model.md defines `FilterQuery` as an interface with `value` and `isActive` fields. contracts/filter-schemas.ts defines `FilterQuery` as a simple string type (`z.infer<typeof FilterQuerySchema>`). Same name, different structures. |

---

## Recommendations Summary

### Must Fix Before Implementation

1. **CRITICAL (US-001)**: Resolve `MAX_FILTER_QUERY_LENGTH` constant discrepancy (100 vs 256). Single source of truth needed.
2. **HIGH (US-002)**: Formally amend spec.md to reflect `Mod+P` keyboard shortcut decision and update all references.
3. **HIGH (US-003)**: Clarify folder path vs name matching semantics and highlight position mapping.

### Should Fix Before Phase 3+

4. **MEDIUM (US-004)**: Specify FS change handling (debounce, re-filter strategy).
5. **MEDIUM (US-005)**: Define "project" for persistence isolation.
6. **MEDIUM (US-006)**: Specify visual distinction for ancestor-only folders.
7. **MEDIUM (US-007)**: Document empty state visual design.
8. **MEDIUM (US-008)**: Reconcile persistence format between contracts and data-model.

### Nice to Have

9. **LOW (US-009-011)**: Clarify case sensitivity, focus restoration, and ranking documentation.

---

## What Was Checked

The analysis examined:
- All 13 functional requirements (FR-001 through FR-013) for verb-object-outcome completeness
- All 5 user stories and their acceptance criteria for testability and specificity
- All 5 edge cases for behavioral specification completeness
- 24 tasks for references to undefined files/components
- Cross-artifact consistency (spec vs research vs contracts vs tasks vs data-model)
- Error handling specifications (localStorage failures, parse errors)
- External system/API integration details (fzf library, command registry)
- Data model type definitions for consistency
- Performance criteria for measurability

---

## Specification Completeness Assessment

| Category | Status | Confidence |
|----------|--------|------------|
| User Stories (5 US) | Well-defined | HIGH |
| Functional Requirements (13 FR) | Clear but one shortcut conflict | HIGH |
| Success Criteria (6 SC) | Measurable | HIGH |
| Edge Cases (5 defined) | Described but some underspecified | MEDIUM |
| Data Model | Complete with minor inconsistencies | HIGH |
| Architecture/Dependencies | Clear integration points | HIGH |
| Error Handling | Adequate (silent fail pattern) | MEDIUM |
| Performance Baselines | Clear (100ms, 50ms debounce) | HIGH |
| Testing/Validation | Gates defined | HIGH |

**Overall Readiness**: 85% - Implementation can proceed for Phases 1-2 after resolving CRITICAL/HIGH issues. Medium issues can be resolved during implementation with reasonable assumptions.

---

*Analysis completed: 2026-01-17*
