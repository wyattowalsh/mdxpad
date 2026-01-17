# Underspecification Analysis: MDX Content Outline/Navigator (007)

**Analyzed Files:**
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/spec.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/tasks.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/plan.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/data-model.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/contracts/`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/quickstart.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/research.md`

**Analysis Date:** 2026-01-17

---

## Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
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

---

## Summary by Severity

| Severity | Count | Impact |
|----------|-------|--------|
| HIGH | 2 | Critical specification gaps affecting implementation confidence and performance validation |
| MEDIUM | 5 | Feature-specific edge cases and behavioral clarifications needed |
| LOW | 3 | Minor enhancements and testing specifications |
| **TOTAL** | **10** | 70% well-specified, 30% needs clarification |

## Specification Completeness Assessment

| Category | Status | Confidence |
|----------|--------|------------|
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

---

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
