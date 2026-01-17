# Integration Ambiguity Analysis: MDX Content Outline/Navigator (Spec 007)

**Analyzed**: 2026-01-17
**Category Focus**: Integration & External Dependencies
**Spec File**: `/Users/ww/dev/projects/mdxpad/specs/007-mdx-content-outline/spec.md`

---

## Summary

| Status | Count |
|--------|-------|
| Clear | 2 |
| Partial | 4 |
| Missing | 3 |

---

## 1. AST Data Sharing with Preview Pane

**Category**: Integration
**Status**: Partial
**Location**: FR-029, FR-030, Assumptions #1

**What's Specified**:
- "System MUST reuse AST data from the preview pane's MDX compilation when available"
- "System MUST fall back to a lightweight parser if preview AST is unavailable"
- Assumption: "The preview pane already compiles MDX and produces an AST"

**What's Missing**:
- No defined interface/contract for accessing the preview AST
- No specification of which AST format is expected (mdast, hast, esast, unified processor result?)
- No protocol for AST availability notification (pub/sub, polling, reactive subscription?)
- No versioning consideration if MDX compiler changes AST structure

**Question Candidate**: "What is the contract for accessing the preview pane's AST? Should the outline subscribe to AST updates via a Zustand store slice, event emitter, or other mechanism? What specific AST node types (mdast.Heading, mdxJsxFlowElement, etc.) should the outline expect?"

**Impact Score**: 5/5
*Critical: This is the core integration point. Ambiguity here blocks implementation of real-time outline updates.*

---

## 2. Lightweight Parser Fallback

**Category**: Integration
**Status**: Missing
**Location**: FR-030

**What's Specified**:
- "System MUST fall back to a lightweight parser if preview AST is unavailable"

**What's Missing**:
- No specification of what "lightweight parser" means
- No library/approach identified (regex-based? remark-only? mdx-js subset?)
- No clarity on when preview AST is "unavailable" (preview hidden? preview crashed? initial load?)
- No feature parity requirements between full AST and lightweight parser

**Question Candidate**: "What triggers the fallback to a lightweight parser, and what parser should be used? Should the lightweight parser provide identical outline structure, or is degraded functionality acceptable (e.g., headings only, no components)?"

**Impact Score**: 4/5
*High: Without clarity, the fallback path may produce inconsistent outlines or fail silently.*

---

## 3. useErrorNavigation Hook Integration

**Category**: Integration
**Status**: Partial
**Location**: FR-023, Assumptions #4

**What's Specified**:
- "System MUST use the existing useErrorNavigation hook pattern for cursor positioning"
- Assumption: "The useErrorNavigation hook from spec 006 provides a proven pattern"

**What's Missing**:
- No API signature of useErrorNavigation provided
- No confirmation the hook supports arbitrary line/column navigation (vs. error-specific navigation)
- No indication if the hook needs extension or can be used as-is
- Dependency on Spec 006 but no version/interface contract

**Question Candidate**: "Does the useErrorNavigation hook from Spec 006 support general-purpose navigation to any line/column, or is it specific to error locations? If extension is needed, what should the API look like?"

**Impact Score**: 3/5
*Medium: May require refactoring existing code if assumptions are wrong.*

---

## 4. Settings Store Integration

**Category**: Integration
**Status**: Clear
**Location**: FR-003

**What's Specified**:
- "System MUST persist outline panel visibility preference across sessions using the existing settings store"
- References existing Zustand store pattern in Dependencies (Spec 006)

**Assessment**: Adequate for implementation. Settings persistence follows established patterns.

**Impact Score**: 1/5

---

## 5. Command Palette Registration

**Category**: Integration
**Status**: Clear
**Location**: Dependencies

**What's Specified**:
- Dependency on "Spec 005 (Command Palette): Command registration for outline toggle"

**Assessment**: Clear dependency stated. Command registration pattern established in Spec 005.

**Impact Score**: 1/5

---

## 6. AST Parsing Failure Handling

**Category**: Integration
**Status**: Partial
**Location**: FR-031, Edge Cases

**What's Specified**:
- "System MUST handle AST parsing failures gracefully"
- Edge case: "Show the last valid outline with a warning indicator, or show 'Unable to parse document' if no valid outline exists"

**What's Missing**:
- No specification of how parsing errors are communicated from preview to outline
- No error type classification (syntax error vs. runtime error vs. timeout)
- No recovery strategy when parsing eventually succeeds after failure
- No indication if outline should retry parsing or wait for preview

**Question Candidate**: "How should parsing errors propagate from the MDX compiler to the outline? Should the outline component subscribe to an error state, or catch errors during AST traversal?"

**Impact Score**: 3/5
*Medium: Error handling is a secondary path but affects user experience significantly.*

---

## 7. Source Position Information from AST

**Category**: Integration
**Status**: Partial
**Location**: FR-032

**What's Specified**:
- "System MUST extract source position information (line, column) from AST nodes for navigation"

**What's Missing**:
- No guarantee that MDX AST preserves source positions for all node types
- No specification of position format (0-indexed vs 1-indexed, point vs range)
- No handling for cases where source positions are missing (e.g., generated nodes)
- No protocol versioning if MDX compiler changes position format

**Question Candidate**: "Does the MDX/remark/rehype pipeline guarantee source position data for heading, JSX, and YAML nodes? What format are positions in (unist Position type?), and how should missing positions be handled?"

**Impact Score**: 4/5
*High: Navigation accuracy depends entirely on source position availability and correctness.*

---

## 8. Preview Pane Lifecycle Coupling

**Category**: Integration
**Status**: Missing
**Location**: Implicit in FR-029

**What's Specified**:
- Assumes preview AST is available for reuse

**What's Missing**:
- No specification of behavior when preview is hidden (does AST still compile?)
- No specification of behavior when preview compilation is disabled by user
- No handling for preview panel initialization race condition
- No explicit dependency lifecycle management

**Question Candidate**: "If the user hides the preview panel, does MDX compilation still occur for the outline's benefit? What happens during app startup if the outline panel loads before the preview compiler is ready?"

**Impact Score**: 4/5
*High: Core feature may break silently if preview lifecycle assumptions are incorrect.*

---

## 9. Data Export/Import Formats

**Category**: Integration
**Status**: Missing
**Location**: Out of Scope section

**What's Specified**:
- "Outline export or printing" explicitly marked out of scope

**Assessment**: Intentionally excluded. No integration needed. However, the internal data format for OutlineItem/OutlineSection/OutlineState entities is specified clearly.

**Impact Score**: 1/5
*Intentionally scoped out.*

---

## Recommended Clarification Questions (Prioritized)

1. **(Impact 5)** What is the contract for accessing the preview pane's AST? Should the outline subscribe to AST updates via a Zustand store slice, event emitter, or other mechanism? What specific AST node types should the outline expect?

2. **(Impact 4)** Does the MDX/remark/rehype pipeline guarantee source position data for heading, JSX, and YAML nodes? What format are positions in, and how should missing positions be handled?

3. **(Impact 4)** If the user hides the preview panel, does MDX compilation still occur for the outline's benefit? What happens during app startup if the outline panel loads before the preview compiler is ready?

4. **(Impact 4)** What triggers the fallback to a lightweight parser, and what parser should be used? Should the lightweight parser provide identical outline structure, or is degraded functionality acceptable?

5. **(Impact 3)** Does the useErrorNavigation hook from Spec 006 support general-purpose navigation to any line/column, or does it need extension?

---

## Integration Dependency Map

```
+--------------------------------------------------------------+
|                    MDX Content Outline                        |
|                       (Spec 007)                              |
+--------------------------------------------------------------+
|                                                               |
|  +------------------+    +------------------+                 |
|  |  AST Consumer    |<---|  Preview Pane    | [PARTIAL]       |
|  |                  |    |   (Spec 003)     | Interface TBD   |
|  +---------+--------+    +------------------+                 |
|            |                                                  |
|            v                                                  |
|  +------------------+    +------------------+                 |
|  |   Navigation     |--->| useErrorNav      | [PARTIAL]       |
|  |    Handler       |    |   (Spec 006)     | API TBD         |
|  +------------------+    +------------------+                 |
|                                                               |
|  +------------------+    +------------------+                 |
|  | Toggle Command   |--->| Command Palette  | [CLEAR]         |
|  |                  |    |   (Spec 005)     |                 |
|  +------------------+    +------------------+                 |
|                                                               |
|  +------------------+    +------------------+                 |
|  |  Visibility      |--->| Settings Store   | [CLEAR]         |
|  |  Persistence     |    |   (Spec 006)     |                 |
|  +------------------+    +------------------+                 |
|                                                               |
|  +------------------+                                         |
|  | Fallback Parser  |    [MISSING] No spec                    |
|  |                  |                                         |
|  +------------------+                                         |
|                                                               |
+--------------------------------------------------------------+
```

---

## Conclusion

The spec has **9 integration touchpoints** analyzed:
- **2 Clear**: Settings store persistence and command palette registration are well-defined
- **4 Partial**: AST sharing, useErrorNavigation hook, AST parsing failures, and source positions have gaps
- **3 Missing**: Lightweight parser fallback, preview lifecycle coupling, and export formats (intentionally scoped out)

The most critical gap is the **AST data sharing interface** with the preview pane (Impact 5/5). Without a defined contract for how the outline accesses and subscribes to AST updates, implementation will require assumptions that may need significant rework.

**Recommended Action**: Prioritize clarifying the AST integration contract before implementation begins.
