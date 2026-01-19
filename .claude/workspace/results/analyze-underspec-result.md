<<<<<<< HEAD
# Underspecification Analysis: Smart Filtering for File Tree (014)
||||||| 908aacf
# Underspecification Analysis: MDX Content Outline/Navigator (007)
=======
# Underspecification Analysis: Autosave & Crash Recovery (011)
>>>>>>> 011-autosave-recovery

<<<<<<< HEAD
**Analysis Date**: 2026-01-17
**Artifacts Analyzed**:
- `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/spec.md`
- `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/plan.md`
- `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/tasks.md`

**Supporting Documents Also Reviewed**:
- `data-model.md`, `research.md`, `quickstart.md`, `contracts/filter-schemas.ts`, `contracts/filter-commands.ts`
||||||| 908aacf
**Analyzed Files:**
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/spec.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/tasks.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/plan.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/data-model.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/contracts/`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/quickstart.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/research.md`

**Analysis Date:** 2026-01-17
=======
**Feature**: 011-autosave-recovery
**Analyzed**: 2026-01-17
**Artifacts**: spec.md, plan.md, tasks.md
>>>>>>> 011-autosave-recovery

---

## Summary

The Smart Filtering feature artifacts are **well-specified overall**, with thorough data models, clear acceptance criteria, and comprehensive task breakdowns. However, several underspecification issues were identified across severity levels.

---

## Underspecification Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
<<<<<<< HEAD
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
||||||| 908aacf
| U1 | HIGH | spec.md (FR-031, Edge Cases: "syntax errors") | AST parsing failure handling is vague. Edge case states "Show the last valid outline with a warning indicator, or show 'Unable to parse document' if no valid outline exists" but FR-031 says "MUST handle AST parsing failures gracefully" without defining operationally what happens. Missing: (1) timeout duration if AST extraction hangs, (2) exact warning indicator (icon + tooltip text), (3) retry mechanism, (4) behavior when recovery fails. | Define error state specification: (1) AST extraction timeout: 5 seconds per spec context (FR-030 mentions 50ms overhead, timeout should be much larger), (2) warning indicator: red badge with icon + tooltip "Outline parse failed: [error message]", (3) fallback to last-valid triggers only if parse exception occurs (null result is valid), (4) no automatic retry; user manually saves to trigger re-parse. Document in spec section titled "Error Handling & Recovery". |
| U2 | HIGH | spec.md (SC-002, SC-004) + tasks.md (T004, T010, T020) | Performance acceptance criteria stated but underlying assumptions undefined. SC-002 requires "outline updates reflect document changes within 500ms of typing pause" and SC-004 "less than 50ms overhead to existing preview compilation cycle" but specification lacks: (1) debounce duration definition (what is "pause"? 250ms? 500ms?), (2) whether 50ms is measured in isolation or inclusive of preview compilation, (3) large document strategy (does 500-line document meet same latency as 50-line?), (4) "overhead" measurement methodology (profiling tool? threshold test?). | Add Performance Specification section to spec.md: (1) Debounce duration: 250ms after keystroke (matches CodeMirror convention), (2) 50ms overhead = time added to preview store update → UI re-render cycle (measured separately from preview compilation time), (3) Large documents: outline extraction should complete in <250ms for typical 500-line document (baseline expectation, not hard requirement), (4) Measurement: use React.Profiler + console.time in development. Reference plan.md §"Success Metrics" for measurement details. Add to tasks.md: acceptance criteria for T010/T020 should include performance validation test (e.g., "navigateToItem completes in <100ms measured via console.time"). |
| U3 | MEDIUM | spec.md (FR-009, Edge Cases: "very long heading") | Heading label truncation behavior incomplete. FR-009 specifies "truncate with ellipsis after ~40 characters, show full text on hover" but does NOT specify: (1) character counting method (Unicode graphemes? bytes?), (2) truncation algorithm (exact 40th char or word boundary?), (3) tooltip content and display delay/duration, (4) handling of special cases: HTML entities in MDX, angle brackets from JSX in headings, or RTL text. | Define truncation specification section in data-model.md: (1) Count UTF-16 characters (JavaScript .length convention), (2) Algorithm: truncate at 40 characters, append "…" (NO word boundary adjustment), (3) Tooltip: native <title> attribute, show immediately on hover, remove on mouse leave, (4) Special chars: render as-is (escaped by React), don't expand entity references, (5) RTL: out-of-scope for 007 (document in Out of Scope), defer to future. Add test case to T005/T011: "Heading with 50+ characters truncates to 40 + ellipsis; hover shows full text." |
| U4 | MEDIUM | spec.md (US3, FR-014) + tasks.md (T024) | "Built-in component" recognition criteria underspecified. Clarification Q3 lists 10 built-in components but does NOT specify: (1) detection edge case: how to handle aliased imports (`import { Callout as Alert }` - is this built-in or custom?), (2) namespace components (`<ui.Card>` - skip or treat as custom?), (3) JSX within JSX (nested components inside other components), (4) scope: only direct JSX elements or also inside expressions/conditionals?, (5) extensibility: how to add user-defined built-in list in future?. | Update research.md §"R4: Component Recognition" with detection contract: (1) Recognize simple identifiers only: `<Callout>`, `<Note>` → built-in iff name in BUILTIN_COMPONENTS set, (2) Reject aliased imports: `<Alert>` where Alert = Callout import → treat as custom (AST shows "Alert", not "Callout"), (3) Reject namespaced: `<ui.Card>` → skip entirely (not recognized), (4) AST scope: unist-util-visit captures all mdxJsxFlowElement nodes (direct JSX), exclude inline/conditional (mdxJsxTextElement), (5) Future extensibility: design accepts BUILTIN_COMPONENTS as configurable Set; document in quickstart.md. Add to T024 acceptance criteria: "Components with aliased imports display as custom; namespace components skipped from outline." |
| U5 | MEDIUM | spec.md (FR-016, FR-017) + data-model.md | Frontmatter field parsing and display logic underspecified. FR-016/FR-017 define default display fields (title, date, author, tags) and "Show all" expansion but do NOT specify: (1) handling of missing/null YAML values (show empty row "—" or omit field entirely?), (2) value truncation/formatting (how long can value be? "John Doe" vs. "tags: [a, b, c, d, ...]"), (3) "Show all" expansion scope (reveal all YAML keys or only non-default keys?), (4) field ordering in expansion (alphabetical? document order?), (5) YAML parsing errors (malformed frontmatter - fallback to display raw YAML?). | Add Frontmatter Rendering section to data-model.md: (1) Null/undefined fields: omit from display (don't show empty rows), (2) Value truncation: if value > 50 chars, truncate and show "..." (e.g., "tags: [item1, item2,...""), (3) "Show all": reveal all non-default YAML keys (if document has `{title, date, author, tags, custom_field}`, "Show all" adds `custom_field`), (4) Field order in expansion: document order (same as YAML), (5) YAML parse error: show error message "Frontmatter parse failed: [error]" instead of section. Update T027 acceptance criteria: "Null fields omitted; value display truncates > 50 chars; Show all expands to all fields; parse errors shown gracefully." |
| U6 | MEDIUM | spec.md (SC-008, US2, FR-003) + tasks.md (T009, T021) | Outline visibility persistence interaction with app state unclear. SC-008 requires "visibility persists across 100% of app restarts" and FR-003 specifies "persist across sessions" but does NOT clarify: (1) scope: global preference OR per-document preference?, (2) interaction with auto-hide threshold (does user preference override auto-hide? or auto-hide takes precedence?), (3) behavior on document change (does visibility preference transfer to next document?), (4) reset scenarios (does outline reset to visible on app update, new file, or error recovery?). | Add Persistence Model section to spec.md: (1) **Global preference**: outline visibility is app-wide setting; same preference applies to all documents in session, (2) **Auto-hide precedence**: window width < threshold HIDES outline regardless of user preference; when window widens again, preference is auto-restored (per clarification Q5), (3) **Document change**: visibility preference persists across file opens (if user hid outline for File A, opening File B shows outline hidden), (4) **Reset scenarios**: on app first launch, outline visible (default); no reset on app update or error recovery; new document respects current preference. Refactor T009 acceptance: "outlineVisible persisted to localStorage; toggleOutline action flips global preference; auto-hide restores preference on window resize." |
| U7 | MEDIUM | spec.md (FR-027, FR-028, US5) + tasks.md (T029, T030) | Nested heading collapse behavior incomplete. FR-027 states "allow nested heading levels to be collapsed (e.g., collapse all h3+ under an h2)" and FR-028 says "start with all sections expanded" but does NOT define: (1) collapse toggle semantics (does clicking collapse arrow hide only children, or recursively collapse all descendants?), (2) visibility of parent when children collapsed (is h2 visible while h3 children hidden?), (3) collapse state persistence across document edits (if h2→h3→h4 nesting changes, preserve collapsed state?), (4) interaction with section collapse (if Headings section collapsed, are item collapse states preserved or lost?), (5) keyboard shortcut to toggle collapse (FR-027 implies capability but not how to invoke). | Update spec.md acceptance criteria for FR-027: (1) Collapse toggle hides children only; parent remains visible and clickable, (2) Collapse state preserved during session (per FR-026), reset to all-expanded on app restart (per FR-028), (3) On document edit (headings added/removed), preserve collapse state for matching heading IDs; collapsed items that no longer exist are forgotten, (4) Section collapse (Headings section hidden) does NOT affect stored item collapse state; when section re-opened, item collapse state restored, (5) **No keyboard shortcut in scope** (added to Out of Scope); only mouse click toggles collapse. Update T029/T030: "Collapse state stored by heading ID; EditingSession ← preserve state during doc parse; item collapse independent of section collapse." Add test: "Heading h1→h2→h3 structure; collapse h2; add h2b; h2 still collapsed; h2b starts expanded." |
| U8 | LOW | spec.md (User Stories US1-US5) + tasks.md | Multiple acceptance scenarios mention outline behavior but some lack measurable verification. Example: US3 acceptance scenario 4 ("When the user adds or removes components, the outline updates") does NOT specify: (1) expected update latency (should match SC-002 500ms?), (2) visual indication that outline updated (highlight? animation?), (3) what counts as "component added" (JSX element? component call? both?). | Tighten acceptance scenarios: Add latency requirement ("within 500ms" per SC-002) and confirmation method (e.g., "outline re-renders with new component listed"). Align all acceptance scenarios with measurable success criteria. Document in spec.md update to each user story. Priority: LOW (implementation can proceed with reasonable assumptions). |
| U9 | LOW | spec.md (Non-Functional Requirements) + tasks.md | Accessibility requirements stated ("Outline tree navigable via keyboard, ARIA roles, screen readers") but no task implements keyboard navigation testing. T031-T033 add ARIA roles and keyboard handling but acceptance criteria don't specify navigation keys (arrow key directions, Enter behavior, Escape behavior). | Add Keyboard Navigation specification to spec.md or new Accessibility section: (1) **Up/Down arrows**: move focus to previous/next treeitem (wrap around?), (2) **Left/Right arrows**: Left = collapse (if expanded), Right = expand (if collapsed) or move to first child, (3) **Enter**: navigate editor to treeitem's line (same as mouse click), (4) **Escape**: clear focus or unfold parent (TBD), (5) **Home/End**: move to first/last treeitem in section. Update T032 acceptance: "Arrow key navigation tested; Enter triggers navigate; Escape exits focus mode." Reference WAI-ARIA tree pattern (https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) for details. |
| U10 | LOW | tasks.md (T001-T003, type definitions) | Tasks reference shared types in `src/shared/types/outline.ts` but this file is not currently in codebase (gitStatus shows `src/shared/types/document.ts` created but outline.ts not listed). Unclear if outline.ts is a NEW file or should extend existing types file. | Clarify in tasks.md T001 description: "Create NEW file `src/shared/types/outline.ts` exporting all outline types from contracts/. This is separate from document.ts (which handles file I/O) and preview.ts (which handles compilation)." Add explicit instruction: "Do not add outline types to existing types files; create dedicated outline.ts for modularity." |
=======
| U1 | HIGH | spec.md:76, Edge Cases | "What happens when disk space is insufficient for autosave?" listed as edge case but no handling specified in FR requirements | Add FR-017: "System MUST detect insufficient disk space before autosave write, show warning notification, skip autosave attempt, and retry on next interval. Notification should include option to free space or disable autosave." |
| U2 | HIGH | spec.md:77, Edge Cases | "How does autosave behave when the document is read-only or locked?" listed but not addressed in any requirement | Add FR-018: "System MUST skip autosave for read-only documents (external file permissions) and locked documents (open by another process). Status indicator should show 'Autosave unavailable: [reason]' state." |
| U3 | HIGH | spec.md:80, Edge Cases | "What happens when recovery data is corrupted or incomplete?" listed but no error handling specified | Add FR-019: "System MUST validate recovery file checksum on load. Corrupted entries show error in recovery dialog with 'Discard corrupted' option. Log corruption events for debugging." |
| U4 | HIGH | spec.md:81, Edge Cases | "How does the system handle very large documents that take longer to save than the autosave interval?" - no handling specified | Add FR-020: "System MUST skip overlapping autosave if previous write still in progress. Queue at most one pending autosave. Show 'Saving...' indicator if save exceeds 2 seconds." |
| U5 | MEDIUM | spec.md:87, FR-001 | "automatically save document content" - missing definition of what constitutes "document content" (just text? frontmatter? cursor position?) | Clarify FR-001: "Document content includes full MDX text with frontmatter. Cursor position stored in manifest metadata, not recovery file content. Unsaved filename tracked separately in RecoveryManifest.originalPath." |
| U6 | MEDIUM | spec.md:102, FR-016 | "present a conflict resolution dialog with diff view" - no specification of diff view implementation (inline, side-by-side, library to use) | Add to plan.md Technical Context: specify diff library (e.g., diff-match-patch or react-diff-viewer), diff display mode (side-by-side default), and fallback behavior if diff computation fails (show both versions without highlighting). |
| U7 | MEDIUM | spec.md:108, Key Entities | AutosaveSettings mentions "retention settings" but no retention behavior specified anywhere in FR requirements | Either remove "retention settings" from AutosaveSettings entity OR add FR-021: "System MUST automatically delete recovery files older than 7 days. Maximum 50 recovery files retained (oldest deleted when exceeded). Cleanup runs on app startup." |
| U8 | MEDIUM | tasks.md:196-197, T009 | "toast after 3 failures" - no specification of toast dismissal behavior, persistence, or action buttons | Specify in acceptance criteria: "Toast auto-dismisses after 8 seconds. Includes 'Retry Now' primary action and 'Disable Autosave' secondary action. Toast persists if user hovers over it." |
| U9 | MEDIUM | spec.md:93, FR-007 | "dismissing the dialog (ESC, X, click outside)" - spec mentions clicking outside but should clarify whether dialog is modal | Clarify FR-007: "Recovery dialog is modal. Clicking outside the dialog does NOT dismiss it (prevents accidental data loss). Only ESC key and X button dismiss while preserving recovery data." |
| U10 | MEDIUM | spec.md:22, US1 Scenario 3 | "dirty state indicator reflects unsaved changes until autosave completes" - ambiguous whether autosave completion clears dirty state | Clarify: "Autosave completion does NOT clear the dirty indicator in the UI. Only manual save (Cmd+S or File > Save) clears dirty state. Recovery file existence is independent of UI dirty state." |
| U11 | LOW | spec.md:115-120, Success Criteria SC-001 | "95% of their work" - no definition of how to measure this metric quantitatively | Refine SC-001: "Recovery file contains document content captured within (autosave_interval + debounce_delay) seconds before crash. Measured by comparing recovery file timestamp to crash timestamp in E2E tests." |
| U12 | LOW | spec.md:116, SC-002 | "no visible lag or pause" - subjective measure; needs quantitative threshold | Align with plan.md: "Autosave operation MUST complete without blocking main thread for >16ms (one frame at 60fps). Measured via performance.now() in unit tests." |
| U13 | LOW | tasks.md:311, T018 | "diff view, choose recovery/disk/save-as options" - save-as option not mentioned in spec FR-016 or acceptance criteria | Either add save-as to spec FR-016 ("User may choose: keep recovery version, keep disk version, or save as new file") OR remove from task description to maintain spec-task alignment. |
| U14 | LOW | plan.md:20, Constraints | "max 50 recovery files" mentioned but no enforcement mechanism or cleanup behavior specified in tasks | Add subtask under T004 or T005: "Implement recovery file limit enforcement - delete oldest files when count exceeds 50. Log deletions for user awareness." |
>>>>>>> 011-autosave-recovery

---

## Cross-Reference Issues

<<<<<<< HEAD
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
||||||| 908aacf
| Severity | Count | Impact |
|----------|-------|--------|
| HIGH | 2 | Critical specification gaps affecting implementation confidence and performance validation |
| MEDIUM | 5 | Feature-specific edge cases and behavioral clarifications needed |
| LOW | 3 | Minor enhancements and testing specifications |
| **TOTAL** | **10** | 70% well-specified, 30% needs clarification |
=======
| Severity | Count | Impact |
|----------|-------|--------|
| HIGH | 4 | Critical edge cases listed but unspecified - implementation will guess behavior |
| MEDIUM | 6 | Feature behavior and implementation details need clarification |
| LOW | 4 | Minor metric definitions and alignment issues |
| **TOTAL** | **14** | |

---

## Priority Recommendations

### 1. Address HIGH Issues (U1-U4) Before Implementation

All four HIGH issues correspond to edge cases explicitly called out in spec.md but never resolved with functional requirements:

- **U1** (Disk space): Affects T004 (AutosaveService) - needs error handling path
- **U2** (Read-only): Affects T008 (useAutosave hook) - needs skip condition
- **U3** (Corruption): Affects T005 (RecoveryService) - needs validation logic
- **U4** (Large docs): Affects T004/T008 - needs concurrency guard

**Action**: Add FR-017 through FR-020 to spec.md before Phase 2 begins.

### 2. Clarify Conflict Resolution (U6, U13)

The diff view and conflict resolution flow needs implementation guidance:
- Which diff library to use
- UI layout (side-by-side vs inline)
- What options users have (U13 mentions save-as but spec doesn't)

**Action**: Update plan.md Technical Context with diff library selection.

### 3. Define Retention Policy (U7, U14)

Recovery file lifecycle is mentioned but has no enforcement mechanism:
- AutosaveSettings entity references "retention settings"
- plan.md mentions "max 50 recovery files"
- No FR or task implements this behavior

**Action**: Add FR-021 for retention policy OR remove retention from entity definition.
>>>>>>> 011-autosave-recovery

---

## Specification Completeness Assessment

| Category | Status | Confidence |
|----------|--------|------------|
<<<<<<< HEAD
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
||||||| 908aacf
| User Stories (5 US) | ✅ Well-defined | HIGH |
| Functional Requirements (32 FR) | ✅ Clear | HIGH |
| Success Criteria (8 SC) | ⚠️ Measurable but context-dependent | MEDIUM |
| Edge Cases (6 defined) | ⚠️ Described but underspecified | MEDIUM |
| Data Model | ✅ Complete type definitions | HIGH |
| Architecture/Dependencies | ✅ Clear integration points | HIGH |
| Error Handling | ❌ Vague terminology | LOW |
| Performance Baselines | ⚠️ Numbers stated but assumptions unclear | MEDIUM |
| Testing/Validation | ⚠️ Gates defined, acceptance unclear | MEDIUM |

## Critical Path Impact

**HIGH severity issues (U1, U2) must be resolved before Phase 2 implementation begins:**

- **U1** (Parse error handling): Affects error state UI in OutlinePanel component and error recovery flow. Without clarity, T013-T016 (component creation) will need rework.
- **U2** (Performance assumptions): Affects T010 (navigation hook) and T020 (AST integration). Unclear debounce duration and overhead measurement could lead to performance regressions.

**Recommended remediation timeline:**
1. **Before Phase 1 (Setup)**: Clarify U1 and U2 via spec update or clarification document
2. **Before Phase 2 (Foundation)**: Resolve U3-U7 to provide complete implementation guidance for T004-T012
3. **Before Phase 3+ (UI)**: U8-U10 can be resolved during component implementation if needed
=======
| User Stories (4 US) | PASS | HIGH |
| Functional Requirements (16 FR) | PARTIAL | MEDIUM - 4 edge cases unhandled |
| Success Criteria (6 SC) | PARTIAL | MEDIUM - some subjective measures |
| Edge Cases (6 defined) | FAIL | LOW - listed but not specified |
| Key Entities (4 defined) | PARTIAL | MEDIUM - retention undefined |
| Dependencies | PASS | HIGH |
| Error Handling | FAIL | LOW - gaps in error scenarios |
>>>>>>> 011-autosave-recovery

---

<<<<<<< HEAD
*Analysis completed: 2026-01-17*
||||||| 908aacf
## Artifacts Ready vs. Needs Revision

| Artifact | Status | Action |
|----------|--------|--------|
| spec.md | 70% ready | Add Error Handling, Performance, Persistence sections |
| tasks.md | 90% ready | Update acceptance criteria with performance/error specs |
| plan.md | 95% ready | No changes needed (references all required artifacts) |
| data-model.md | 90% ready | Add Truncation, Component Recognition, Frontmatter sections |
| contracts/ | 100% ready | Complete; ready for implementation |
| quickstart.md | 95% ready | Add keyboard nav and component detection examples |
| research.md | 85% ready | Expand R4 with component recognition edge cases |
=======
## Artifacts Readiness

| Artifact | Status | Action Needed |
|----------|--------|---------------|
| spec.md | 75% ready | Add FR-017 through FR-021 for edge cases |
| plan.md | 90% ready | Add diff library decision to Technical Context |
| tasks.md | 85% ready | Update T004/T005/T008 acceptance for error handling |
>>>>>>> 011-autosave-recovery
