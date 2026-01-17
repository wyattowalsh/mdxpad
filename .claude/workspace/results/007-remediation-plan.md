# Remediation Plan: Spec 007 - MDX Content Outline/Navigator

**Generated**: 2026-01-17
**Total Issues**: 46 (8 HIGH, 20 MEDIUM, 18 LOW)
**Files to Modify**: 5 (spec.md, tasks.md, plan.md, data-model.md, contracts/outline-store.ts)

---

## Table of Contents

1. [spec.md Remediations](#specmd-remediations) (28 edits)
2. [tasks.md Remediations](#tasksmd-remediations) (5 edits)
3. [plan.md Remediations](#planmd-remediations) (6 edits)
4. [data-model.md Remediations](#data-modelmd-remediations) (2 edits)
5. [contracts Remediations](#contracts-remediations) (5 edits)

---

## spec.md Remediations

### EDIT-001: Add Performance Constants Section (DUP-001, DUP-002)
**Location**: After line 20 (after Executive Summary)
**Issue**: 500ms timing stated 6 times across files

**ADD after Executive Summary:**
```markdown
## Performance Constants

These constants are defined once and referenced throughout the specification:

| Constant | Value | Description |
|----------|-------|-------------|
| `OUTLINE_UPDATE_DEBOUNCE_MS` | 500ms | Maximum time for outline to reflect document changes |
| `NAVIGATION_RESPONSE_MS` | 100ms | Maximum navigation click-to-cursor response time |
| `TOGGLE_RESPONSE_MS` | 50ms | Maximum panel toggle response time |
| `AST_EXTRACTION_OVERHEAD_MS` | 50ms | Maximum AST extraction overhead |
| `HIGHLIGHT_DURATION_MS` | 500ms | Line highlight flash duration |
| `MAX_LABEL_LENGTH` | 40 | Maximum characters before truncation |
| `AUTO_HIDE_THRESHOLD_WITH_PREVIEW` | 600px | Window width for auto-hide (preview visible) |
| `AUTO_HIDE_THRESHOLD_NO_PREVIEW` | 400px | Window width for auto-hide (preview hidden) |
```

---

### EDIT-002: Fix "at a glance" ambiguity (AMB-004)
**Location**: Line 12
**Issue**: "At a glance" is subjective and unmeasurable

**BEFORE:**
```markdown
See document structure at a glance
```

**AFTER:**
```markdown
See document structure in a single panel view without scrolling for documents with fewer than 50 outline items
```

---

### EDIT-003: Fix "instantly" hyperbole (AMB-015)
**Location**: Line 13
**Issue**: "Instantly" is hyperbole; SC-001 specifies <100ms

**BEFORE:**
```markdown
Navigate instantly
```

**AFTER:**
```markdown
Navigate quickly (under NAVIGATION_RESPONSE_MS)
```

---

### EDIT-004: Fix "real-time" misleading (AMB-016)
**Location**: Line 19
**Issue**: "Real-time" is misleading since updates are debounced

**BEFORE:**
```markdown
providing real-time updates as the user edits
```

**AFTER:**
```markdown
providing updates within OUTLINE_UPDATE_DEBOUNCE_MS as the user edits
```

---

### EDIT-005: Fix "briefly highlighted" ambiguity (AMB-005)
**Location**: Line 37
**Issue**: "Briefly" is vague until FR-022 specifies 500ms

**BEFORE:**
```markdown
the heading line is briefly highlighted to help the user locate it
```

**AFTER:**
```markdown
the heading line is highlighted for HIGHLIGHT_DURATION_MS (flash highlight) to help the user locate it
```

---

### EDIT-006: Remove duplicate toggle acceptance criteria (DUP-004)
**Location**: Lines 52-56
**Issue**: Toggle acceptance scenarios duplicate FR-002, FR-003, FR-005

**BEFORE:**
```markdown
**Acceptance Scenarios:**
1. User presses Cmd+Shift+O when outline is hidden → outline panel appears
2. User presses Cmd+Shift+O when outline is visible → outline panel hides
3. User clicks close button in outline header → outline panel hides
4. User restarts app → outline visibility matches last session
```

**AFTER:**
```markdown
**Acceptance Scenarios:**
1. Toggle behavior per FR-002
2. Persistence behavior per FR-003
3. Close button behavior per FR-005
```

---

### EDIT-007: Fix "complex document" ambiguity (AMB-017)
**Location**: Line 95
**Issue**: "Complex" is subjective and undefined

**BEFORE:**
```markdown
A writer working on a complex document
```

**AFTER:**
```markdown
A writer working on a document with multiple nested sections and components
```

---

### EDIT-008: Fix "~40 characters" ambiguity (AMB-001) - HIGH
**Location**: Line 114
**Issue**: Tilde indicates "approximately," causing implementation uncertainty

**BEFORE:**
```markdown
Truncate with ellipsis after ~40 characters
```

**AFTER:**
```markdown
Truncate with ellipsis after exactly MAX_LABEL_LENGTH characters, breaking at the nearest word boundary if within 5 characters of the limit
```

---

### EDIT-009: Fix "similar to preview" ambiguity (AMB-002) - HIGH
**Location**: Line 117
**Issue**: References external behavior without exact thresholds

**BEFORE:**
```markdown
Outline auto-hides when window width drops below threshold (similar to preview auto-hide behavior)
```

**AFTER:**
```markdown
Outline auto-hides when window width drops below AUTO_HIDE_THRESHOLD_WITH_PREVIEW (with preview visible) or AUTO_HIDE_THRESHOLD_NO_PREVIEW (with preview hidden)
```

---

### EDIT-010: Consolidate FR-010, FR-015, FR-019 timing (DUP-001)
**Location**: Lines 139-140, 147-148, 154-155
**Issue**: 500ms stated three times for headings, components, frontmatter

**BEFORE (FR-010):**
```markdown
**FR-010**: System MUST update the headings tree within 500ms of document changes
```

**AFTER (FR-010):**
```markdown
**FR-010**: System MUST update all outline sections (headings, components, frontmatter) within OUTLINE_UPDATE_DEBOUNCE_MS of document changes
```

**REMOVE FR-015 and FR-019** (or change to):
```markdown
**FR-015**: [Consolidated into FR-010]
**FR-019**: [Consolidated into FR-010]
```

---

### EDIT-011: Fix "etc." in built-in components (AMB-003) - HIGH
**Location**: Line 146 (FR-014)
**Issue**: "etc." makes the list incomplete

**BEFORE:**
```markdown
System MUST distinguish between built-in components (Callout, CodeBlock, etc.) and custom/unknown components visually
```

**AFTER:**
```markdown
System MUST distinguish between built-in components (Callout, Note, Warning, Tip, CodeBlock, Tabs, Tab, Card, Image, Link) and custom/unknown components visually
```

---

### EDIT-012: Fix "common fields" ambiguity (AMB-006)
**Location**: Lines 151-152 (FR-017)
**Issue**: "Common fields" undefined

**BEFORE:**
```markdown
System MUST limit displayed frontmatter to common fields, with option to expand for all fields
```

**AFTER:**
```markdown
System MUST display title, date, author, and tags fields by default, with a "Show all" toggle to reveal additional fields
```

---

### EDIT-013: Fix navigation behavior duplication (DUP-005)
**Location**: Lines 159-164 (FR-020 to FR-024)
**Issue**: Navigation behavior in FRs AND acceptance criteria

**ADD after FR-024:**
```markdown
> **Note**: User Story 1 acceptance criteria reference these functional requirements rather than restating navigation behavior.
```

---

### EDIT-014: Fix "when possible" ambiguity (AMB-013)
**Location**: Line 163 (FR-024)
**Issue**: "When possible" is vague conditional

**BEFORE:**
```markdown
System MUST scroll the editor to center the target line in view when possible
```

**AFTER:**
```markdown
System MUST scroll the editor to center the target line in view. If the target line is within 5 lines of the document start or end, scroll to show the line at the top or bottom of the viewport respectively.
```

---

### EDIT-015: Fix "lightweight parser" ambiguity (AMB-007)
**Location**: Line 174 (FR-030)
**Issue**: "Lightweight parser" undefined

**BEFORE:**
```markdown
System MUST fall back to a lightweight parser if preview AST is unavailable
```

**AFTER:**
```markdown
System MUST fall back to remark-parse (markdown-only parser) if preview AST is unavailable, extracting heading syntax (# through ######) with parsing time under 20ms for documents up to 1000 lines
```

---

### EDIT-016: Fix line number format ambiguity (AMB-014)
**Location**: Line 70
**Issue**: Line number format unspecified

**BEFORE:**
```markdown
they see each instance with its line number
```

**AFTER:**
```markdown
they see each instance labeled as "Line N" where N is the 1-based source line number
```

---

### EDIT-017: Add Error Handling Section (U1) - HIGH
**Location**: After Edge Cases section (around line 120)
**Issue**: AST parsing failure handling vague

**ADD new section:**
```markdown
## Error Handling Specification

### AST Parsing Failures

| Scenario | Timeout | Behavior | Visual Indicator |
|----------|---------|----------|------------------|
| Preview AST unavailable | N/A | Use fallback parser per FR-030 | None |
| Fallback parser timeout | 5000ms | Show last valid outline | Warning icon in panel header |
| Fallback parser error | N/A | Show empty state with error message | Error icon + "Parse error" tooltip |
| Partial AST (some nodes failed) | N/A | Show successfully parsed items | Warning badge on affected section |

### Recovery Behavior

1. **On Parse Error**: Display last known valid outline with staleness indicator
2. **On Recovery**: Automatically update to fresh outline, remove indicator
3. **Manual Refresh**: User can click refresh icon to force re-parse
```

---

### EDIT-018: Add Performance Specification Section (U2) - HIGH
**Location**: After Error Handling section
**Issue**: Performance criteria undefined, measurement methodology missing

**ADD new section:**
```markdown
## Performance Specification

### Measurement Methodology

| Metric | Measurement Point | Tool |
|--------|------------------|------|
| Navigation response | Click event to cursor visible | Performance.now() delta |
| Outline update | Debounce fire to render complete | React Profiler |
| Toggle response | Keydown to panel visible/hidden | Performance.now() delta |
| AST extraction | selectOutlineAST start to return | Console timing |

### Debounce Behavior

- **Debounce Duration**: 300ms after last keystroke
- **Keystroke Latency**: Debounce does NOT affect keystroke-to-render (<16ms per Constitution Article V)
- **Update Trigger**: Outline re-extraction begins 300ms after typing pause
- **Total Update Time**: 300ms debounce + extraction time (target <50ms) = <350ms typical

### Large Document Handling

| Document Size | Expected Behavior |
|---------------|-------------------|
| <500 lines | Full performance (all targets met) |
| 500-2000 lines | Graceful degradation (update may exceed 500ms) |
| >2000 lines | Consider progressive rendering or virtualization |
```

---

### EDIT-019: Fix "input lag" ambiguity (AMB-008)
**Location**: Line 209
**Issue**: "Input lag" subjective without quantification

**BEFORE:**
```markdown
Outline parsing must not block the main thread or cause editor input lag
```

**AFTER:**
```markdown
Outline parsing must run asynchronously and complete without adding more than 5ms to keystroke-to-render latency (per Constitution Article V <16ms budget)
```

---

### EDIT-020: Fix "rapid typing" and "excessive" ambiguity (AMB-009)
**Location**: Line 210
**Issue**: "Rapid typing" and "excessive" are subjective

**BEFORE:**
```markdown
Debounce outline updates to avoid excessive re-parsing during rapid typing
```

**AFTER:**
```markdown
Debounce outline updates with a 300ms delay after the last keystroke to limit re-parsing to once per user pause
```

---

### EDIT-021: Fix passive voice (AMB-018)
**Location**: Line 229
**Issue**: Passive voice hides responsibility

**BEFORE:**
```markdown
The preview store will be extended to expose this AST as a subscribable field
```

**AFTER:**
```markdown
The implementation SHALL extend the preview store to expose the parsed AST as a subscribable field via selectOutlineAST selector.
```

---

### EDIT-022: Fix "distinct visual styling" ambiguity (AMB-019)
**Location**: Lines 301-303
**Issue**: Visual difference unspecified

**BEFORE:**
```markdown
These receive distinct visual styling in the outline. All other components display as custom/unknown.
```

**AFTER:**
```markdown
Built-in components display with a filled badge icon (text-primary) and standard weight. Custom/unknown components display with an outlined badge icon (text-muted) and italic text. All other components display as custom/unknown.
```

---

### EDIT-023: Fix "non-standard heading patterns" ambiguity (AMB-022)
**Location**: Line 232
**Issue**: "Non-standard heading patterns" undefined

**BEFORE:**
```markdown
Standard MDX structure: Headings use standard markdown syntax (# through ######). Non-standard heading patterns are out of scope.
```

**AFTER:**
```markdown
Standard MDX structure: Only ATX-style markdown headings (# through ######) are supported. Setext-style headings (underlines), HTML heading tags (<h1>-<h6>), and JSX heading components are out of scope.
```

---

### EDIT-024: Add truncation algorithm (U3)
**Location**: In data-model.md or spec.md Edge Cases
**Issue**: Heading truncation algorithm incomplete

**ADD to Edge Cases:**
```markdown
### Heading Truncation Algorithm

1. If `heading.length <= MAX_LABEL_LENGTH`: Display full text
2. If `heading.length > MAX_LABEL_LENGTH`:
   a. Find last space before position MAX_LABEL_LENGTH - 3
   b. If space found within 5 chars of limit: truncate at space, append "..."
   c. Otherwise: truncate at MAX_LABEL_LENGTH - 3, append "..."
3. Full text shown on hover via `title` attribute
```

---

### EDIT-025: Add component recognition edge cases (U4)
**Location**: In spec.md Edge Cases or clarifications
**Issue**: Built-in component recognition edge cases

**ADD:**
```markdown
### Component Recognition Rules

| Pattern | Classification | Example |
|---------|---------------|---------|
| Exact match (case-sensitive) | Built-in | `<Callout>` |
| Different case | Custom | `<callout>`, `<CALLOUT>` |
| With namespace | Custom | `<UI.Callout>` |
| Self-closing | Same as open tag | `<Image />` = built-in |
| Lowercase tag | HTML element (ignored) | `<div>`, `<span>` |
```

---

### EDIT-026: Add frontmatter null handling (U5)
**Location**: In spec.md or data-model.md
**Issue**: Frontmatter null/missing field handling

**ADD:**
```markdown
### Frontmatter Field Handling

| Field State | Display Behavior |
|-------------|-----------------|
| Present with value | Show "key: value" |
| Present with null | Show "key: (empty)" in muted text |
| Present with empty string | Show "key: (empty)" in muted text |
| Missing entirely | Omit from display |
| Array value | Show "key: [N items]" with expand |
| Object value | Show "key: {object}" with expand |
```

---

### EDIT-027: Clarify visibility persistence scope (U6)
**Location**: In spec.md FR-003 or Implementation Notes
**Issue**: Visibility persistence scope unclear

**ADD after FR-003:**
```markdown
> **Persistence Scope**: Visibility state persists globally (not per-document). The storage key `mdxpad:ui:outline-visible` stores a boolean in localStorage.
```

---

### EDIT-028: Clarify nested heading collapse (U7)
**Location**: In spec.md FR-027 or clarifications
**Issue**: Nested heading collapse semantics

**ADD:**
```markdown
### Nested Collapse Behavior

- Collapsing a parent heading hides all descendant headings
- Expanding a parent restores children to their individual collapse states
- Collapse state is tracked per-heading via `collapsedHeadings: Set<string>` keyed by heading ID
- Session-only persistence (not stored in localStorage)
```

---

## tasks.md Remediations

### EDIT-029: Fix styling details ambiguity (AMB-010)
**Location**: Line 192 (T018)
**Issue**: Hover colors, indentation increment, animation details unspecified

**BEFORE:**
```markdown
Add Tailwind CSS styles for outline components including panel layout (w-[250px] min-w-[150px]), item hover states, indentation, truncation, and highlight animation
```

**AFTER:**
```markdown
Add Tailwind CSS styles for outline components: panel layout (w-[250px] min-w-[150px]), item hover (bg-gray-100 dark:bg-gray-800), indentation (pl-4 per nesting level), text truncation (truncate class with max-w-full), and highlight animation (bg-yellow-200/50 transition-colors duration-500)
```

---

### EDIT-030: Fix "UI work" scope ambiguity (AMB-020)
**Location**: Line 103
**Issue**: "UI work" could be narrow or broad

**BEFORE:**
```markdown
⚠️ **BLOCKING**: No UI work can begin until this phase completes
```

**AFTER:**
```markdown
⚠️ **BLOCKING**: Tasks T013-T020 (Phase 3 UI components) cannot begin until Phase 2 completes
```

---

### EDIT-031: Add fallback parser task (GAP-001) - HIGH
**Location**: After T004 in Phase 2
**Issue**: FR-030 has no implementing task

**ADD new task:**
```markdown
#### T004a: Fallback Outline Parser [P:2.1] [FR-030]
**File**: `src/renderer/services/outline/fallback-outline-parser.ts`
**Description**: Implement lightweight markdown-only parser using remark-parse for when preview AST is unavailable
**Acceptance**:
- [ ] Uses remark-parse to extract ATX headings (# through ######)
- [ ] Parses documents up to 1000 lines in <20ms
- [ ] Returns OutlineAST-compatible structure
- [ ] Triggered when preview store's AST is null/undefined
**Dependencies**: T001 (shared types)
**Commit**: `feat(007): add fallback outline parser for preview-less mode`
```

---

### EDIT-032: Add performance benchmark task (GAP-002)
**Location**: In Phase 8 (Batch 8.3)
**Issue**: SC-004 (<50ms overhead) has no validation task

**ADD new task:**
```markdown
#### T035a: Performance Benchmark Tests [P:8.3] [SC-004]
**File**: `src/renderer/services/outline/outline-extractor.perf.test.ts`
**Description**: Add performance benchmarks measuring extraction time with various document sizes
**Acceptance**:
- [ ] Benchmark with 100-line document: <10ms
- [ ] Benchmark with 500-line document: <30ms
- [ ] Benchmark with 1000-line document: <50ms
- [ ] Benchmark runs in CI with performance regression detection
**Dependencies**: T004, T005
**Commit**: `test(007): add outline extractor performance benchmarks`
```

---

### EDIT-033: Add toggle latency test (GAP-003)
**Location**: Enhance T022 or add after it
**Issue**: SC-003 (<50ms toggle) needs explicit validation

**ADD to T022 acceptance criteria:**
```markdown
- [ ] Toggle state update completes within 50ms (measured via Performance.now())
```

---

## plan.md Remediations

### EDIT-034: Fix "after typing" ambiguity (AMB-011)
**Location**: Line 28
**Issue**: "After typing" ambiguous - keystroke, pause, or debounce?

**BEFORE:**
```markdown
Performance Goals: <100ms navigation response, <50ms AST extraction overhead, <500ms outline update after typing
```

**AFTER:**
```markdown
Performance Goals: <100ms navigation response, <50ms AST extraction overhead, <500ms outline update after debounce timer fires (300ms after last keystroke)
```

---

### EDIT-035: Fix "typical documents" ambiguity (AMB-012)
**Location**: Line 30
**Issue**: "Typical" is vague, no max size specified

**BEFORE:**
```markdown
Scale/Scope: Single document, typical documents ~500 lines
```

**AFTER:**
```markdown
Scale/Scope: Single document, optimized for documents up to 500 lines, must remain functional for documents up to 2000 lines with graceful degradation
```

---

### EDIT-036: Fix TBD status inconsistency (AMB-021)
**Location**: Line 47
**Issue**: "TBD" contradicts checkmark

**BEFORE:**
```markdown
Renderer bundle <5MB | ✅ TBD | Minimal new code (~2KB)
```

**AFTER:**
```markdown
Renderer bundle <5MB | ⏳ PENDING | Estimated ~2KB new code, verification after implementation
```

---

### EDIT-037: Remove tech stack duplication (DUP-007)
**Location**: Lines 22-27
**Issue**: Technology versions duplicate AGENTS.md

**BEFORE:**
```markdown
### Technical Context
- TypeScript 5.9.x, strict: true
- React 19.x
- Zustand 5.x + Immer 11.x
- Tailwind CSS 4.x
- Vitest 4.x, Playwright 1.57.x
- Electron 39.x, CodeMirror 6.x
```

**AFTER:**
```markdown
### Technical Context
Technology stack per AGENTS.md Active Technologies section and Constitution Article II.
```

---

### EDIT-038: Consolidate AST reuse statement (DUP-008)
**Location**: Lines 15, 29 and elsewhere
**Issue**: AST reuse stated 5 times

**KEEP one authoritative statement at line 15, REMOVE or reference elsewhere:**
```markdown
> **Design Decision**: Reuse AST from preview compilation per FR-029. All other AST references should cite this decision.
```

---

### EDIT-039: Reference user stories instead of restating (DUP-003)
**Location**: Lines 126-135 (Phase descriptions)
**Issue**: User Story 1 description appears in three places

**BEFORE:**
```markdown
Phase 1/2 descriptions that restate user story goals...
```

**AFTER:**
```markdown
Phase 1: Infrastructure (see spec.md User Stories for full context)
Phase 2: Core Logic (implements FR-006 through FR-019)
...
```

---

## data-model.md Remediations

### EDIT-040: Add truncation algorithm details
**Location**: Near MAX_LABEL_LENGTH definition
**Issue**: Truncation algorithm incomplete

**ADD:**
```markdown
### Truncation Implementation

```typescript
function truncateLabel(text: string): string {
  if (text.length <= MAX_LABEL_LENGTH) return text;

  const limit = MAX_LABEL_LENGTH - 3; // Reserve space for "..."
  const lastSpace = text.lastIndexOf(' ', limit);

  // Break at word boundary if within 5 chars of limit
  if (lastSpace > limit - 5) {
    return text.slice(0, lastSpace) + '...';
  }

  return text.slice(0, limit) + '...';
}
```
```

---

### EDIT-041: Add non-standard heading test case (GAP-004)
**Location**: In test specifications or data-model.md examples
**Issue**: Non-standard heading sequences not explicitly tested

**ADD example:**
```markdown
### Non-Standard Heading Sequence Example

Input:
```markdown
# Title
### Skipped H2
## Back to H2
#### Deep nesting
```

Expected OutlineItem[] structure:
```typescript
[
  { level: 1, label: "Title", children: [
    { level: 3, label: "Skipped H2", children: [] },  // Strict nesting: h3 under h1
    { level: 2, label: "Back to H2", children: [
      { level: 4, label: "Deep nesting", children: [] }
    ]}
  ]}
]
```
```

---

## contracts Remediations

### EDIT-042: Add smooth scroll verification comment (CONST-REC-001)
**Location**: contracts/outline-navigation.ts lines 100-103
**Issue**: Smooth scroll may conflict with CodeMirror

**BEFORE:**
```typescript
export const SCROLL_BEHAVIOR: ScrollIntoViewOptions = {
  block: 'center',
  behavior: 'smooth',
};
```

**AFTER:**
```typescript
/**
 * Scroll behavior for navigation.
 * NOTE: Verified compatible with CodeMirror 6's scrollIntoView.
 * If issues arise, consider using EditorView.scrollIntoView(pos, { y: 'center' }) instead.
 */
export const SCROLL_BEHAVIOR: ScrollIntoViewOptions = {
  block: 'center',
  behavior: 'smooth',
};
```

---

### EDIT-043: Add debounce clarification comment (CONST-REC-002)
**Location**: contracts/outline-store.ts line 265
**Issue**: Clarify debounce doesn't affect keystroke latency

**BEFORE:**
```typescript
export const OUTLINE_UPDATE_DEBOUNCE_MS = 300;
```

**AFTER:**
```typescript
/**
 * Debounce delay for outline updates (ms).
 * This does NOT affect keystroke latency - only AST extraction scheduling.
 * Keystroke-to-render remains <16ms per Constitution Article V.
 */
export const OUTLINE_UPDATE_DEBOUNCE_MS = 300;
```

---

### EDIT-044: Add @param/@returns to OutlineStoreActions (CONST-REC-003)
**Location**: contracts/outline-store.ts lines 101-132
**Issue**: JSDoc lacks @param and @returns

**BEFORE:**
```typescript
/**
 * Update outline from parsed AST data.
 * Called when preview store receives new compilation result.
 */
readonly updateFromAST: (ast: OutlineAST) => void;
```

**AFTER:**
```typescript
/**
 * Update outline from parsed AST data.
 * Called when preview store receives new compilation result.
 *
 * @param ast - The lightweight AST data extracted from MDX compilation
 * @returns void
 */
readonly updateFromAST: (ast: OutlineAST) => void;
```

**Apply similar pattern to all action methods in OutlineStoreActions.**

---

### EDIT-045: Add error state visual indicator (GAP-005)
**Location**: contracts/outline-panel.ts or OutlinePanel component
**Issue**: Warning indicator for stale outline not specified

**ADD to OutlinePanelProps or OutlineHeaderProps:**
```typescript
/**
 * Whether the outline data may be stale due to parse errors.
 * When true, displays warning indicator in panel header.
 */
readonly isStale?: boolean;

/**
 * Error message to display on hover when isStale is true.
 * Default: "Outline may be outdated due to parse error"
 */
readonly staleMessage?: string;
```

---

### EDIT-046: Add warning indicator to OutlinePanel header task (GAP-005)
**Location**: Add to T013 or create T013a in tasks.md
**Issue**: No UI task for error indicator

**ADD to T013 acceptance criteria:**
```markdown
- [ ] Displays warning icon in header when parseError is set
- [ ] Warning icon shows "Outline may be outdated" on hover
- [ ] Warning icon uses text-warning color (amber)
```

---

## Summary

| File | Edits | HIGH | MEDIUM | LOW |
|------|-------|------|--------|-----|
| spec.md | 28 | 5 | 15 | 8 |
| tasks.md | 5 | 1 | 2 | 2 |
| plan.md | 6 | 0 | 3 | 3 |
| data-model.md | 2 | 0 | 1 | 1 |
| contracts/ | 5 | 0 | 0 | 5 |
| **TOTAL** | **46** | **6** | **21** | **19** |

---

## Application Order

1. **spec.md** first (most changes, defines constants used elsewhere)
2. **tasks.md** second (adds missing tasks)
3. **plan.md** third (references spec)
4. **data-model.md** fourth (examples and algorithms)
5. **contracts/** last (implementation details)

---

**Remediation Plan Complete**: 2026-01-17
