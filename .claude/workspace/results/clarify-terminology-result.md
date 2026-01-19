# Terminology & Consistency Scan Results

**Spec File**: `/Users/ww/dev/projects/mdxpad-sync/.specify/specs/008-bidirectional-sync/spec.md`
**Category**: Terminology
**Date**: 2026-01-17

---

## Executive Summary

The 008-bidirectional-sync spec has several terminology gaps when compared against the canonical sources (Constitution glossary and previous specs 002-editor-core, 003-preview-pane, 006-application-shell, 007-mdx-content-outline). Key issues include undefined terms critical to the Scroll Lock Algorithm, inconsistent "panel" vs "pane" usage, and missing glossary entries for position mapping concepts.

---

## Findings

### 1. "Sync Source" / "Sync Target" Undefined

- **Category**: Terminology
- **Status**: Missing
- **Location**: Scroll Lock Algorithm (lines 134-141), FR-030-032 (lines 179-182)
- **Issue**: The spec uses "lockSource" (line 137) and "sync target pane" (line 181) without defining these terms. The Glossary defines "Sync Mode", "Scroll Lock", "Position Mapping", and "Debounce" but does not define "sync source" or "sync target" which are critical for understanding the feedback loop prevention mechanism.
- **Question Candidate**: Should the Glossary include definitions for "Sync Source" (the pane that initiated a scroll event) and "Sync Target" (the pane that receives synchronized scroll)?
- **Impact Score**: 3
- **Recommendation**: Add glossary entries: "**Sync Source**: The pane (editor or preview) where a user-initiated scroll event originated. **Sync Target**: The pane that receives a synchronized scroll command in response to a sync source event."

---

### 2. "Preview Panel" vs "Preview Pane" Inconsistency

- **Category**: Terminology
- **Status**: Partial
- **Location**: Line 16 ("preview panel"), elsewhere uses "preview pane"
- **Issue**: Line 16 uses "preview panel" while the rest of the spec and other specs (003, 006) consistently use "preview pane". The Constitution and spec 003 (Preview Pane) establish "pane" as the canonical term for main content areas.
- **Question Candidate**: N/A - clear correction needed
- **Impact Score**: 2
- **Recommendation**: Replace "preview panel" with "preview pane" on line 16 to align with established terminology.

---

### 3. "Visible Lines" vs "Visible Content" Undefined

- **Category**: Terminology
- **Status**: Missing
- **Location**: Lines 50, 162 ("visible lines" for editor), lines 67, 172 ("visible preview content")
- **Issue**: The spec uses "visible lines" for the editor context and "visible content" for the preview context without formally defining these terms. These are distinct concepts - the editor has source lines while the preview has rendered content blocks. Understanding this distinction is critical for implementing FR-012 and FR-022.
- **Question Candidate**: Should the Glossary define "Visible Lines" (editor context: source line numbers currently in viewport) and "Visible Content" (preview context: rendered elements currently in viewport)?
- **Impact Score**: 3
- **Recommendation**: Add glossary entries for both terms to clarify the position calculation requirements.

---

### 4. "Confidence" Level Criteria Undefined

- **Category**: Terminology
- **Status**: Missing
- **Location**: Key Entities - PositionMapping (line 203): "confidence ('high' | 'medium' | 'low')"
- **Issue**: The Key Entities section defines "PositionMapping" with a "confidence" field but the Glossary does not define what these confidence levels mean or when each applies. The Position Mapping Strategy (lines 144-146) describes three approaches (AST, DOM, proportional) but doesn't map them to confidence levels.
- **Question Candidate**: What criteria determine position mapping confidence levels? Should "high" = exact AST match, "medium" = DOM element mapping, "low" = proportional ratio fallback?
- **Impact Score**: 3
- **Recommendation**: Add to glossary: "**Confidence Level**: Quality rating for a position mapping - 'high' (exact AST source position match), 'medium' (DOM element inference), 'low' (proportional ratio estimate)."

---

### 5. "AST Source Position" vs "Source Position Data"

- **Category**: Terminology
- **Status**: Partial
- **Location**: Lines 129, 145, 175 reference "AST source position data" and "source position data from AST"
- **Issue**: Spec 007 (MDX Content Outline) defines "Source Position" in its Glossary: "The line and column number in the source document where an element appears". However, Spec 008 does not include this in its Glossary despite heavy reliance on this concept for the Position Mapping Strategy.
- **Question Candidate**: Should the Glossary import the "Source Position" definition from Spec 007 to maintain consistency across specs?
- **Impact Score**: 2
- **Recommendation**: Either add "Source Position" to this spec's glossary or reference Spec 007's definition explicitly.

---

### 6. "Editor" vs "Editor Pane" Distinction

- **Category**: Terminology
- **Status**: Partial
- **Location**: Throughout the spec (~30 occurrences of "editor")
- **Issue**: The spec uses "editor" throughout (lines 16, 42, 50, 59, etc.) but Spec 006 (Application Shell) consistently refers to the layout container as "editor on the left" and distinguishes it from the CodeMirror component. The spec sometimes refers to scroll behavior of "the editor" which could mean the CodeMirror instance or the containing pane.
- **Question Candidate**: Should "editor" refer to the CodeMirror component while "editor pane" refers to the layout container, consistent with Spec 006's "split-pane layout" terminology?
- **Impact Score**: 2
- **Recommendation**: Consider distinguishing "editor" (the CodeMirror component) from "editor pane" (the layout container) where the distinction matters, particularly in scroll-related requirements.

---

### 7. "ScrollPosition" vs "Position Mapping" Relationship

- **Category**: Terminology
- **Status**: Partial
- **Location**: Key Entities (lines 201, 203)
- **Issue**: Key Entities defines both "ScrollPosition" (representing a scroll state with pane, line, scrollTop, timestamp) and "PositionMapping" (mapping editor lines to preview positions). The relationship between these entities is not explicit - ScrollPosition captures state while PositionMapping captures the translation between contexts.
- **Question Candidate**: Should the Glossary clarify that "ScrollPosition" represents a point-in-time scroll state while "Position Mapping" represents the translation relationship between editor lines and preview scroll positions?
- **Impact Score**: 2
- **Recommendation**: Add clarifying note in glossary or Key Entities section explaining the distinct purposes of these entities.

---

### 8. "Pane" Terminology Consistency

- **Category**: Terminology
- **Status**: Clear
- **Location**: Lines 137, 139 ("pane" in Scroll Lock Algorithm), Key Entities (line 201)
- **Issue**: The spec correctly uses "pane" (not "panel") in technical contexts after the title inconsistency. This aligns with the established convention from specs 003 and 006.
- **Question Candidate**: N/A
- **Impact Score**: 1
- **Recommendation**: No action needed except for the "preview panel" fix noted in Finding #2.

---

### 9. "Smooth Scroll" vs "Scroll Animation" Terminology

- **Category**: Terminology
- **Status**: Clear
- **Location**: Lines 19, 52-53, 69, Performance Constants (SCROLL_ANIMATION_MS)
- **Issue**: The spec consistently uses "smooth scroll" for the user-facing description and "scroll animation" (SCROLL_ANIMATION_MS) for the implementation constant. This is appropriate distinction.
- **Question Candidate**: N/A
- **Impact Score**: 1
- **Recommendation**: No action needed. Terminology is clear and consistent.

---

### 10. "Debounce" Already Defined

- **Category**: Terminology
- **Status**: Clear
- **Location**: Glossary (line 280)
- **Issue**: "Debounce" is properly defined in the glossary: "Delaying action until a pause in rapid events (e.g., scroll events during continuous scrolling)."
- **Question Candidate**: N/A
- **Impact Score**: 1
- **Recommendation**: No action needed. Good glossary entry.

---

### 11. Alignment with Spec 003 "Scroll Synchronization" Section

- **Category**: Terminology
- **Status**: Clear
- **Location**: Spec 003 User Story 5 (lines 85-97 in 003)
- **Issue**: Spec 003 includes a basic "Scroll Synchronization" user story using "proportional scroll ratio". Spec 008 extends this with the full bidirectional sync system. The terminology is compatible.
- **Question Candidate**: N/A
- **Impact Score**: 1
- **Recommendation**: Consider referencing Spec 003's scroll sync story in Spec 008's Dependencies section to show the evolutionary relationship.

---

## Summary Table

| # | Term/Issue | Status | Impact | Action Required |
|---|------------|--------|--------|-----------------|
| 1 | Sync Source / Sync Target | Missing | 3 | Add glossary entries |
| 2 | Preview Panel vs Pane | Partial | 2 | Replace "panel" with "pane" on line 16 |
| 3 | Visible Lines / Visible Content | Missing | 3 | Add glossary entries |
| 4 | Confidence Level criteria | Missing | 3 | Define criteria in glossary |
| 5 | AST Source Position | Partial | 2 | Import from Spec 007 or add definition |
| 6 | Editor vs Editor Pane | Partial | 2 | Consider distinguishing in scroll contexts |
| 7 | ScrollPosition vs PositionMapping | Partial | 2 | Clarify relationship |
| 8 | Pane terminology | Clear | 1 | No action |
| 9 | Smooth scroll / animation | Clear | 1 | No action |
| 10 | Debounce | Clear | 1 | No action |
| 11 | Spec 003 alignment | Clear | 1 | Optional dependency reference |

---

## Proposed Glossary Additions

```markdown
## Glossary (Additions)

- **Sync Source**: The pane (editor or preview) where a user-initiated scroll event originated
- **Sync Target**: The pane that receives a synchronized scroll command in response to a sync source event
- **Visible Lines**: The range of source line numbers currently displayed in the editor viewport
- **Visible Content**: The rendered elements (headings, paragraphs, components) currently displayed in the preview viewport
- **Source Position**: The line and column number in the source document where an element appears (aligned with Spec 007)
- **Confidence Level**: Quality rating for a position mapping - "high" (exact AST source position match), "medium" (DOM element inference), "low" (proportional ratio estimate)
```

---

## Recommended Clarification Questions (Priority Order)

1. **(Impact 3)** Should the Glossary define "Sync Source" and "Sync Target" given their central role in the Scroll Lock Algorithm and FR-030-032?

2. **(Impact 3)** Should the Glossary define "Visible Lines" (editor) and "Visible Content" (preview) to clarify the position calculation requirements in FR-012 and FR-022?

3. **(Impact 3)** What criteria determine the "confidence" levels for PositionMapping? Should the glossary explicitly map 'high' = AST match, 'medium' = DOM inference, 'low' = proportional ratio?

4. **(Impact 2)** Should "Source Position" be added to the glossary (importing from Spec 007) for consistency across specs?

5. **(Impact 2)** Should the spec distinguish "editor" (CodeMirror component) from "editor pane" (layout container) in scroll-related requirements?

---

## Cross-Reference Check

| Term Used in Spec | Constitution Glossary | Other Specs | Status |
|-------------------|----------------------|-------------|--------|
| Sync Mode | - | - | Defined in spec |
| Scroll Lock | - | - | Defined in spec |
| Position Mapping | - | - | Defined in spec |
| Debounce | - | - | Defined in spec |
| Preview Pane | - | 003, 006 | Consistent (except line 16) |
| Editor | - | 002, 006, 007 | Consistent |
| AST | - | 003, 007 | Used but not defined (defined in 007) |
| Source Position | - | 007 | Used but not defined (defined in 007) |
| IPC | Constitution | - | Not used (correct - this is renderer-only) |
| MDX | Constitution | 002, 003 | Implicit reference only |
