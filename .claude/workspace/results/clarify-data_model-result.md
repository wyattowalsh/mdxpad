# Data Model Ambiguity Analysis

**Spec**: 014-smart-filtering (Smart Filtering for File Tree)
**Category**: Data Model
**Analysis Date**: 2026-01-17

---

## Summary

The spec defines three key entities (Filter Query, Match Result, File Tree Node) but lacks sufficient detail on their attributes, relationships, lifecycle, and scale assumptions. Several critical data model questions remain unanswered.

---

## Ambiguity Findings

### 1. Filter Query Entity - Attribute Definition

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | Filter Query attributes |
| **Question Candidate** | What attributes comprise a Filter Query entity? (e.g., query string, timestamp, workspace ID, case-sensitivity flag, max length, created/modified dates) |
| **Impact Score** | 4 |
| **Rationale** | Without clear attributes, persistence implementation will vary and edge cases (max length, special characters) cannot be properly validated |

---

### 2. Match Result Entity - Structure Definition

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | Match Result structure |
| **Question Candidate** | What is the exact data structure for Match Result? Should it include: file path, match score, array of character indices, match type (exact/fuzzy), parent chain, display name? |
| **Impact Score** | 5 |
| **Rationale** | Match Result is central to both filtering logic and UI rendering; undefined structure blocks implementation of fuzzy matching algorithm and highlighting |

---

### 3. File Tree Node - Visibility State Model

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | File Tree Node visibility states |
| **Question Candidate** | What visibility states can a File Tree Node have? (e.g., visible-matched, visible-ancestor, visible-descendant, hidden) Should collapsed/expanded state be preserved during filtering? |
| **Impact Score** | 4 |
| **Rationale** | FR-004 requires "parent folders of matching items to remain visible" implying multiple visibility reasons; state model needed for correct tree rendering |

---

### 4. Identity & Uniqueness - Filter Query per Project

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | Project/workspace identity |
| **Question Candidate** | How is a project/workspace uniquely identified for filter persistence? By root folder path, workspace config file, or another mechanism? What happens if the same folder is opened from different paths (symlinks)? |
| **Impact Score** | 4 |
| **Rationale** | User Story 5 Acceptance Scenario 3 states "filter state is specific to that project" - requires clear project identity definition |

---

### 5. Relationship - Match Result to File Tree Node

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Missing |
| **Element** | Entity relationships |
| **Question Candidate** | What is the cardinality between Match Result and File Tree Node? Is there always 1:1 mapping, or can a single node have multiple match results (e.g., matching both name and path)? How is the relationship keyed? |
| **Impact Score** | 3 |
| **Rationale** | Affects how match highlighting data flows to tree rendering components |

---

### 6. Lifecycle - Filter Query State Transitions

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Missing |
| **Element** | Filter Query lifecycle |
| **Question Candidate** | What are the valid state transitions for a Filter Query? (e.g., empty -> active -> persisted -> restored) When exactly is persistence triggered - on every keystroke, on debounce, on blur, on application close? |
| **Impact Score** | 3 |
| **Rationale** | Affects persistence strategy and performance; edge case in User Story 5 depends on this |

---

### 7. Lifecycle - Match Result Computation & Caching

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Missing |
| **Element** | Match Result caching strategy |
| **Question Candidate** | Are Match Results computed on-demand or cached? How are they invalidated when files change (per FR-009)? Should there be a TTL or is invalidation event-driven? |
| **Impact Score** | 4 |
| **Rationale** | SC-002 requires 100ms response for 10k files; caching strategy directly impacts performance feasibility |

---

### 8. Data Volume - File Tree Scale Assumptions

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | Scale bounds |
| **Question Candidate** | What is the maximum supported file count? What is the expected maximum tree depth? What is the maximum file name length? Are there assumptions about average files per folder? |
| **Impact Score** | 3 |
| **Rationale** | Algorithm selection (e.g., trie vs linear search) depends on scale; memory budget for Match Result cache needs bounds |

---

### 9. Data Volume - Filter Query Length

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | Query length limits |
| **Question Candidate** | What is the maximum allowed filter query length? Should truncation be silent or show a warning? What is the recommended/typical query length for performance optimization? |
| **Impact Score** | 2 |
| **Rationale** | Edge case explicitly calls this out; fuzzy matching algorithm performance may degrade with very long queries |

---

### 10. Data Volume - Persistence Storage Size

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Missing |
| **Element** | Storage limits |
| **Question Candidate** | Is there a limit on how many project filter queries are persisted? Should old entries be evicted (LRU)? What is the expected storage footprint per project? |
| **Impact Score** | 2 |
| **Rationale** | localStorage has 5-10MB limits; long-term use across many projects could hit storage constraints |

---

### 11. Match Scoring & Ranking Model

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | Match scoring algorithm |
| **Question Candidate** | What scoring algorithm determines match quality? What factors affect rank (contiguity, position, case match, path depth)? What is the minimum score threshold for a match to be included? |
| **Impact Score** | 4 |
| **Rationale** | Ranking directly affects user experience per SC-003 (95% find target on first attempt); needs clear algorithm or reference (e.g., fzf scoring) |

---

## Summary Statistics

| Status | Count |
|--------|-------|
| Clear | 0 |
| Partial | 6 |
| Missing | 5 |
| **Total Ambiguities** | **11** |

| Impact Score | Count |
|--------------|-------|
| 5 (Critical) | 1 |
| 4 (High) | 5 |
| 3 (Medium) | 3 |
| 2 (Low) | 2 |

---

## Recommended Clarification Priority

1. **Match Result Entity - Structure Definition** (Impact: 5) - Central to both filtering and UI rendering
2. **Filter Query Entity - Attribute Definition** (Impact: 4) - Blocks persistence implementation
3. **File Tree Node - Visibility State Model** (Impact: 4) - Required for tree rendering logic
4. **Identity & Uniqueness - Filter Query per Project** (Impact: 4) - Required for persistence keying
5. **Match Result Computation & Caching** (Impact: 4) - Performance-critical decision
6. **Match Scoring & Ranking Model** (Impact: 4) - User experience quality
7. **Match Result to File Tree Node Relationship** (Impact: 3) - Data flow architecture
8. **Filter Query State Transitions** (Impact: 3) - Persistence timing
9. **File Tree Scale Assumptions** (Impact: 3) - Algorithm selection
10. **Filter Query Length** (Impact: 2) - Edge case handling
11. **Persistence Storage Size** (Impact: 2) - Long-term storage management
