# Terminology Analysis: 014-smart-filtering

**Spec**: `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/spec.md`
**Analysis Date**: 2026-01-17
**Category**: Terminology & Consistency

---

## Summary

Analyzed the Smart Filtering specification for terminology consistency against:
- Project Constitution glossary
- Established terms from specs 004 (File System Shell) and 006 (Application Shell)
- Internal consistency within the spec

---

## Findings

### 1. "File Tree" vs "File Explorer"

| Field | Value |
|-------|-------|
| **Category** | terminology |
| **Status** | Partial |
| **Terms Used** | "file tree" (9 occurrences), "file explorer" (5 occurrences), "file explorer sidebar" (3 occurrences) |
| **Issue** | The spec uses both "file tree" and "file explorer" interchangeably. Line 10: "file tree", Line 12: "file explorer sidebar", Line 20: "file explorer" |
| **Question Candidate** | Should "file tree" and "file explorer" be distinguished (tree = data structure, explorer = UI component), or should one canonical term be chosen? If so, which term should be canonical: "file tree", "file explorer", or "file explorer sidebar"? |
| **Impact Score** | 3 |
| **Rationale** | Medium impact - could cause confusion during implementation about whether requirements refer to the data model or the UI component. Spec 006 does not define these terms in its glossary. |

---

### 2. "Filter Query" vs "Query" vs "Filter Input" vs "Search Query"

| Field | Value |
|-------|-------|
| **Category** | terminology |
| **Status** | Partial |
| **Terms Used** | "filter query" (Key Entity + 8 occurrences), "query" (standalone, 12 occurrences), "filter input" (7 occurrences), "search query" (line 12) |
| **Issue** | Multiple related terms used: "filter query" (the string), "query" (shorthand), "filter input" (UI element), "search query" (line 12). Key Entities defines "Filter Query" but "search query" appears in User Story 1. |
| **Question Candidate** | N/A - Recommend adding to glossary: "Filter Query" = the text string, "Filter Input" = the UI text field component. Avoid "search query" synonym. |
| **Impact Score** | 2 |
| **Rationale** | Low-medium impact. The context usually clarifies meaning, but formal glossary would improve precision. Key Entities partially addresses this but doesn't distinguish "filter input" (UI) from "filter query" (value). |

---

### 3. "Match" vs "Match Result" vs "Matching"

| Field | Value |
|-------|-------|
| **Category** | terminology |
| **Status** | Clear |
| **Terms Used** | "Match Result" (Key Entity), "match" (verb), "matching" (adjective/gerund) |
| **Issue** | None - well defined |
| **Question Candidate** | N/A |
| **Impact Score** | 1 |
| **Rationale** | Key Entities defines "Match Result" clearly. Other uses are grammatical variations. No ambiguity. |

---

### 4. "File Tree Node" - Missing Definition Detail

| Field | Value |
|-------|-------|
| **Category** | terminology |
| **Status** | Partial |
| **Terms Used** | "File Tree Node" (Key Entity) |
| **Issue** | Key Entity "File Tree Node" is defined but doesn't reference spec 004's "FileHandle" or other established types. Is a File Tree Node the same as a FileHandle, or a different abstraction? |
| **Question Candidate** | Should "File Tree Node" align with or extend the existing `FileHandle` type from spec 004, or is it a distinct concept specific to the tree UI component? |
| **Impact Score** | 3 |
| **Rationale** | Medium impact - implementation needs to know whether to reuse existing file types or create new ones for the tree visualization. |

---

### 5. "Fuzzy Matching" Algorithm Reference

| Field | Value |
|-------|-------|
| **Category** | terminology |
| **Status** | Partial |
| **Terms Used** | "fuzzy matching" (8 occurrences), "fzf-style matching" (line 138) |
| **Issue** | Line 138 mentions "fzf-style matching" as an assumption, but no formal definition exists. SC-006 specifies "80% of query characters present in any order" which may not match fzf algorithm behavior. |
| **Question Candidate** | Should "fuzzy matching" be precisely defined in the glossary with specific algorithm characteristics, or should implementation be left to use standard fzf-like scoring (which prioritizes consecutive matches, not just presence)? |
| **Impact Score** | 3 |
| **Rationale** | Medium impact - different fuzzy matching algorithms produce different results. fzf prioritizes consecutive character sequences and path components, which differs from "characters present in any order" described in SC-006. |

---

### 6. "Project" vs "Workspace"

| Field | Value |
|-------|-------|
| **Category** | terminology |
| **Status** | Partial |
| **Terms Used** | "project" (5 occurrences), "workspace" (4 occurrences), "project/workspace" (1 occurrence at line 108) |
| **Issue** | Line 86: "different project/workspace", Line 108: "per project/workspace", Line 117: "persisted per project". Are these synonyms or distinct concepts? Constitution uses "Workspace" in Section 4.2 (plugin paths). |
| **Question Candidate** | Should "project" and "workspace" be consolidated to one canonical term? The Constitution uses "Workspace root" (Section 4.2). Recommend standardizing on "workspace" for consistency. |
| **Impact Score** | 2 |
| **Rationale** | Low-medium impact. The meaning is clear in context, but formal distinction or consolidation would improve consistency with Constitution terminology. |

---

### 7. "Session" - Ambiguous Scope

| Field | Value |
|-------|-------|
| **Category** | terminology |
| **Status** | Partial |
| **Terms Used** | "session" (2 occurrences), "sessions" (2 occurrences) |
| **Issue** | User Story 5 title: "Filter Persistence" with text "persist across sessions". What defines a session boundary? App restart? Window close? Tab close (future)? |
| **Question Candidate** | What constitutes a "session" for filter persistence purposes? Is it bounded by app restart, window close, or something else? |
| **Impact Score** | 2 |
| **Rationale** | Low-medium impact. Context implies app restart, but explicit definition would clarify implementation scope. Spec 006 uses "app launch" terminology which is clearer. |

---

### 8. "Items" - Generic Term

| Field | Value |
|-------|-------|
| **Category** | terminology |
| **Status** | Clear |
| **Terms Used** | "items" (5 occurrences, always as "files and folders" or "matching items") |
| **Issue** | None - always clarified in context |
| **Question Candidate** | N/A |
| **Impact Score** | 1 |
| **Rationale** | "Items" is always qualified (e.g., "matching items", "files and folders"). No standalone ambiguous use. |

---

### 9. "Visual Highlighting" vs "Match Highlighting"

| Field | Value |
|-------|-------|
| **Category** | terminology |
| **Status** | Clear |
| **Terms Used** | "visual highlighting" (1), "visually highlighted" (2), "match highlighting" (0), "highlight" (verb, 3) |
| **Issue** | None - consistent use of "visual highlighting" for the feature |
| **Question Candidate** | N/A |
| **Impact Score** | 1 |
| **Rationale** | FR-005 uses "visually highlight" consistently. No conflicting terms. |

---

### 10. Missing Glossary Section

| Field | Value |
|-------|-------|
| **Category** | terminology |
| **Status** | Missing |
| **Terms Used** | N/A |
| **Issue** | Spec 006 (Application Shell) has a dedicated "Glossary" section defining key terms (Dirty, File Handle, Split Ratio, Untitled). Spec 014 lacks a glossary section despite introducing new domain terms. |
| **Question Candidate** | Should spec 014 include a Glossary section defining: Filter Query, Filter Input, Match Result, File Tree Node, Fuzzy Matching, and potentially consolidating file tree/file explorer terminology? |
| **Impact Score** | 4 |
| **Rationale** | Higher impact - a glossary would resolve multiple partial findings above and establish canonical terminology for implementation. |

---

## Summary Table

| # | Term/Issue | Status | Impact | Action Required |
|---|------------|--------|--------|-----------------|
| 1 | File Tree vs File Explorer | Partial | 3 | Distinguish or consolidate |
| 2 | Filter Query vs Query vs Search Query | Partial | 2 | Add glossary entries |
| 3 | Match vs Match Result | Clear | 1 | No action |
| 4 | File Tree Node relationship to FileHandle | Partial | 3 | Clarify type relationship |
| 5 | Fuzzy Matching algorithm undefined | Partial | 3 | Define algorithm or reference |
| 6 | Project vs Workspace | Partial | 2 | Consolidate to "workspace" |
| 7 | Session boundary undefined | Partial | 2 | Define session scope |
| 8 | Items (generic term) | Clear | 1 | No action |
| 9 | Visual Highlighting | Clear | 1 | No action |
| 10 | Missing Glossary section | Missing | 4 | Add glossary to spec |

---

## Recommendations

1. **Add Glossary Section** (Impact: 4) - Define canonical terms for this feature domain
2. **Standardize "File Tree" vs "File Explorer"** (Impact: 3) - Choose one or distinguish clearly
3. **Clarify "File Tree Node" Relationship to FileHandle** (Impact: 3) - Connect to existing types
4. **Define "Fuzzy Matching" Algorithm** (Impact: 3) - Reconcile SC-006 with fzf-style assumption
5. **Consolidate "Project/Workspace"** (Impact: 2) - Align with Constitution's "Workspace" term
6. **Define "Session" Boundary** (Impact: 2) - Clarify persistence scope

---

## Proposed Glossary Additions

If a glossary is added, recommend these definitions:

| Term | Proposed Definition |
|------|---------------------|
| **File Explorer** | The UI sidebar component that displays the file tree and filter input |
| **File Tree** | The hierarchical data structure representing files and folders in the workspace |
| **Filter Query** | The text string entered by the user to filter the file tree |
| **Filter Input** | The text field UI component where users enter the filter query |
| **Match Result** | A file or folder node that matches the filter query, including match positions for highlighting |
| **File Tree Node** | A node in the file tree representing a file or folder, with visibility state determined by filter matches |
| **Fuzzy Matching** | An algorithm that matches filter queries against file names by finding query characters in order but not necessarily contiguous, scoring based on consecutive character matches and match positions |

---

## Cross-Reference: Constitution Glossary Terms

The Constitution glossary (Section #glossary) defines:
- Tier 1/2/3 Plugin
- contextIsolation
- IPC
- MDX

None of these directly apply to spec 014, but the spec should maintain consistency with the Constitution's language conventions (MUST/SHALL/SHOULD/MAY per Section #language-conventions), which it does correctly in the Requirements section.

---

## Recommended Clarification Questions (Priority Order)

1. **(Impact 4)** Should spec 014 include a Glossary section defining: Filter Query, Filter Input, Match Result, File Tree Node, Fuzzy Matching, and resolving file tree/file explorer terminology?

2. **(Impact 3)** Should "file tree" (data structure) and "file explorer" (UI component) be formally distinguished, or should one canonical term be chosen for both?

3. **(Impact 3)** Should "File Tree Node" align with or extend the existing `FileHandle` type from spec 004, or is it a distinct concept specific to the tree visualization?

4. **(Impact 3)** Should "fuzzy matching" be precisely defined with specific algorithm characteristics (e.g., consecutive match scoring), or is "fzf-style" sufficient as a reference?

5. **(Impact 2)** Should "project" and "workspace" be consolidated to the Constitution's canonical term "workspace"?
