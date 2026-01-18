# Integration Ambiguity Analysis: Smart Filtering for File Tree (Spec 014)

**Analyzed**: 2026-01-17
**Category Focus**: Integration & External Dependencies
**Spec File**: `/Users/ww/dev/projects/mdxpad-filter/.specify/specs/014-smart-filtering/spec.md`

---

## Summary

| Status | Count |
|--------|-------|
| Clear | 2 |
| Partial | 3 |
| Missing | 4 |

---

## 1. Fuzzy Matching Algorithm/Library Selection

**Category**: Integration
**Status**: Partial
**Location**: Assumptions, User Story 2, FR-003

**What's Specified**:
- "Fuzzy matching uses a standard algorithm like fzf-style matching for consistency with developer expectations"
- FR-003: "System MUST support fuzzy matching where non-contiguous character sequences can match file/folder names"
- User Story 2 mentions ranking by "match quality"

**What's Missing**:
- No specific library identified (fuse.js, flexsearch, fzf-for-js, uFuzzy, custom implementation?)
- No scoring/ranking algorithm specified for determining match quality
- No threshold for what constitutes a valid match (minimum score?)
- No specification of case sensitivity behavior (FR-003 is silent on this)

**Question Candidate**: "Which fuzzy matching library should be used (e.g., fuse.js, flexsearch, fzf-for-js), or should a custom implementation be created? What scoring threshold determines a valid match, and should matching be case-insensitive by default?"

**Impact Score**: 4/5
*High: Library choice affects bundle size, performance, match quality, and user expectations. Different libraries produce different results for the same query.*

---

## 2. File Tree Data Structure Interface

**Category**: Integration
**Status**: Partial
**Location**: Assumptions, FR-004, FR-009

**What's Specified**:
- "File tree data structure is available from the file system shell (from spec 004)"
- FR-004: "System MUST display parent folders of matching items to maintain tree structure context"
- FR-009: "System MUST update filter results automatically when files are added, removed, or renamed"

**What's Missing**:
- No defined interface/contract for accessing file tree data from spec 004
- No specification of the data structure format (nested tree, flat list with paths, observable?)
- No protocol for subscribing to file system change events
- No handling for race conditions during rapid file changes

**Question Candidate**: "What is the interface contract for accessing file tree data from spec 004? Is it exposed via Zustand store, IPC channel, or direct import? How should the filter component subscribe to file change events from the chokidar-based watcher?"

**Impact Score**: 4/5
*High: This is the primary data source. Without a clear interface, implementation may create tight coupling or incompatible integration points.*

---

## 3. File System Event Subscription Protocol

**Category**: Integration
**Status**: Missing
**Location**: FR-009, implicit dependency on spec 004

**What's Specified**:
- FR-009: "System MUST update filter results automatically when files are added, removed, or renamed"
- Spec 004 uses chokidar 5.0.0 for file watching (per CLAUDE.md)

**What's Missing**:
- No mechanism specified for receiving file system events
- No event format/payload defined
- No debouncing/throttling strategy for rapid file changes
- No handling for batch operations (e.g., git checkout changing many files)
- No specification of whether events are per-file or batched

**Question Candidate**: "How should the filter component subscribe to file system events from spec 004's chokidar-based watcher? What is the event payload format? Should debouncing be applied to handle rapid file changes (e.g., 100ms window)?"

**Impact Score**: 4/5
*High: Real-time updates are explicitly required. Without clear event protocol, filter results could become stale or cause performance issues.*

---

## 4. Filter State Persistence Format

**Category**: Integration
**Status**: Missing
**Location**: FR-007, User Story 5, Assumptions

**What's Specified**:
- FR-007: "System MUST persist the filter query across application sessions per project/workspace"
- User Story 5 Scenario 3: "filter state is specific to that project"
- Assumptions: "The application uses localStorage or similar mechanism for session persistence"

**What's Missing**:
- No schema/format for persisted filter state
- No key naming convention for per-project storage
- No versioning strategy if schema changes
- No migration path for existing sessions
- No handling for localStorage quota exceeded
- No specification of what "project/workspace" identifier to use as key

**Question Candidate**: "What is the persistence schema for filter state? How should the localStorage key be structured for per-project scoping (e.g., `mdxpad:filter:${projectPath}`)? What versioning/migration strategy should handle schema changes?"

**Impact Score**: 3/5
*Medium: Affects long-term maintainability and user experience across updates. Core functionality works without persistence.*

---

## 5. Keyboard Shortcut Registration

**Category**: Integration
**Status**: Missing
**Location**: FR-006, User Story 4, Assumptions

**What's Specified**:
- FR-006: "System MUST provide a keyboard shortcut to focus the filter input from anywhere in the application"
- Assumptions: "Standard keyboard shortcut conventions apply (e.g., Cmd/Ctrl+Shift+E or similar unassigned shortcut)"
- SC-004: "Keyboard shortcut to focus filter is discoverable (documented in UI or command palette)"

**What's Missing**:
- No integration with command palette (spec 005) specified
- No conflict detection mechanism with existing shortcuts
- No specification of exact shortcut key combination
- No indication if shortcut should be user-configurable
- No handling for when filter sidebar is hidden

**Question Candidate**: "Should the keyboard shortcut be registered via the command palette system from spec 005? What is the exact key combination, and how should conflicts with existing shortcuts be detected and resolved?"

**Impact Score**: 3/5
*Medium: Affects discoverability and power-user workflow. Core filtering works without keyboard shortcut.*

---

## 6. File Explorer Sidebar Integration Point

**Category**: Integration
**Status**: Partial
**Location**: FR-001, Assumptions

**What's Specified**:
- FR-001: "System MUST provide a text input field in the file explorer sidebar for entering filter queries"
- Assumptions: "The file explorer sidebar already exists as part of the application shell (from spec 006)"

**What's Missing**:
- No specification of where in the sidebar the filter input should be placed (top, above tree, sticky header?)
- No integration with existing sidebar component hierarchy
- No handling for sidebar collapsed/expanded states
- No specification of filter input dimensions or styling constraints

**Question Candidate**: "Where exactly should the filter input be mounted within the file explorer sidebar from spec 006? Should it be a sticky header above the tree, and how should it behave when the sidebar is collapsed?"

**Impact Score**: 2/5
*Low-Medium: Layout decisions are usually resolved during implementation, but clear placement avoids rework.*

---

## 7. Match Result Data Structure

**Category**: Integration
**Status**: Missing
**Location**: Key Entities section

**What's Specified**:
- "Match Result: A file or folder that matches the filter query, including match positions for highlighting"
- FR-005: "System MUST visually highlight the matched portions of file/folder names"
- User Story 3: "each matched character is individually highlighted even if non-contiguous"

**What's Missing**:
- No data structure format for match positions (character indices, ranges, byte offsets?)
- No specification of how non-contiguous fuzzy matches are represented
- No interface between fuzzy matcher and highlighting component
- No handling for Unicode/multi-byte characters in positions

**Question Candidate**: "What data structure should represent match positions for highlighting? Should it be an array of character indices `[0, 3, 7]`, ranges `[{start: 0, end: 3}]`, or another format? How should Unicode characters be indexed?"

**Impact Score**: 3/5
*Medium: Highlighting is P2 but directly impacts usability. Wrong format could cause incorrect highlighting.*

---

## 8. Performance Threshold Requirements

**Category**: Integration
**Status**: Clear
**Location**: SC-002

**What's Specified**:
- "Filter results update within 100ms of keystroke for projects with up to 10,000 files"

**Assessment**: Clear, measurable performance requirement. Implementation can be tested against this threshold. No integration ambiguity.

**Impact Score**: N/A

---

## 9. localStorage API Usage

**Category**: Integration
**Status**: Clear
**Location**: Assumptions

**What's Specified**:
- "The application uses localStorage or similar mechanism for session persistence (established pattern)"

**Assessment**: Consistent with established patterns from specs 005 and 006 (per CLAUDE.md). No new integration concerns.

**Impact Score**: N/A

---

## Priority Questions for Clarification

Based on impact scores, these questions should be addressed before implementation:

| Priority | Impact | Question |
|----------|--------|----------|
| 1 | 4/5 | Which fuzzy matching library should be used, and what scoring/ranking algorithm determines match quality? |
| 2 | 4/5 | What is the interface contract for accessing file tree data from spec 004 (Zustand store, IPC, direct import)? |
| 3 | 4/5 | How should the filter subscribe to file system events from spec 004's chokidar watcher, and what debouncing strategy should be applied? |
| 4 | 3/5 | What is the persistence schema and per-project key naming convention for filter state? |
| 5 | 3/5 | Should keyboard shortcuts integrate with command palette (spec 005), and what is the exact key combination? |
| 6 | 3/5 | What data structure represents fuzzy match positions for highlighting (especially non-contiguous matches)? |

---

## Integration Dependency Map

```
+--------------------------------------------------------------+
|                 Smart Filtering (Spec 014)                    |
+--------------------------------------------------------------+
|                                                               |
|  +------------------+    +------------------+                 |
|  |  Filter Input    |--->| File Explorer    | [PARTIAL]       |
|  |   Component      |    | Sidebar (006)    | Mount point TBD |
|  +------------------+    +------------------+                 |
|                                                               |
|  +------------------+    +------------------+                 |
|  |  File Tree       |<---| File System      | [PARTIAL]       |
|  |   Data Access    |    | Shell (004)      | Interface TBD   |
|  +------------------+    +------------------+                 |
|                                                               |
|  +------------------+    +------------------+                 |
|  |  File Change     |<---| chokidar         | [MISSING]       |
|  |   Subscription   |    | (via 004)        | Protocol TBD    |
|  +------------------+    +------------------+                 |
|                                                               |
|  +------------------+    +------------------+                 |
|  |  Keyboard        |--->| Command Palette  | [MISSING]       |
|  |   Shortcut       |    |   (005)          | Integration TBD |
|  +------------------+    +------------------+                 |
|                                                               |
|  +------------------+    +------------------+                 |
|  |  Filter State    |--->| localStorage     | [CLEAR]         |
|  |   Persistence    |    |                  | Schema TBD      |
|  +------------------+    +------------------+                 |
|                                                               |
|  +------------------+                                         |
|  |  Fuzzy Matcher   |    [PARTIAL]                            |
|  |  (library TBD)   |    Library selection TBD                |
|  +------------------+                                         |
|                                                               |
+--------------------------------------------------------------+
```

---

## Conclusion

The spec has **9 integration touchpoints** analyzed:
- **2 Clear**: Performance thresholds (SC-002) and localStorage usage are well-defined
- **3 Partial**: Fuzzy matching library, file tree data interface, and sidebar mount point have gaps
- **4 Missing**: File system event subscription, persistence schema, keyboard shortcut registration, and match position data structure need clarification

The most critical gaps are:
1. **File tree data interface** with spec 004 - core data source
2. **File system event subscription** - required for FR-009 (real-time updates)
3. **Fuzzy matching library selection** - affects performance, bundle size, and match quality

**Recommended Action**: Clarify the file tree data interface and event subscription protocol from spec 004 before implementation begins, as these are blocking dependencies.
