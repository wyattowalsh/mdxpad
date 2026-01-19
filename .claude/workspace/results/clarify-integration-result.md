# Integration Ambiguity Analysis: Bidirectional Preview Sync (Spec 008)

**Analyzed**: 2026-01-17
**Category Focus**: Integration & External Dependencies
**Spec File**: `/Users/ww/dev/projects/mdxpad-sync/.specify/specs/008-bidirectional-sync/spec.md`

---

## Summary

| Status | Count |
|--------|-------|
| Clear | 1 |
| Partial | 5 |
| Missing | 2 |

The Bidirectional Preview Sync specification operates entirely within the application boundary (editor <-> preview pane) with no external services. However, several internal integration points with dependent specs require clarification.

---

## 1. CodeMirror Scroll API Contract

**Category**: Integration
**Status**: Partial
**Location**: FR-010, FR-012, FR-023, Assumption #2

**What's Specified**:
- "System MUST detect scroll events in the editor" (FR-010)
- "System MUST calculate the target preview scroll position based on editor visible lines" (FR-012)
- "System MUST scroll the editor smoothly over SCROLL_ANIMATION_MS to the target line" (FR-023)
- Assumption: "The editor component exposes methods to get current scroll position and scroll to a specific line"

**What's Missing**:
- No specific CodeMirror 6 API methods identified
- No method signature for getting visible line range
- No method signature for smooth scrolling to a specific line
- CodeMirror 6 has multiple scroll APIs (`scrollTo`, `scrollIntoView`, `EditorView.scrollDOM`, `EditorView.coordsAtPos`, `EditorView.lineBlockAtHeight`) with different behaviors

**Question Candidate**: "Which specific CodeMirror 6 scroll and position APIs should be used for: (a) detecting current visible line range, (b) scrolling to a specific line with animation? Should a wrapper interface be created or are direct CM6 APIs sufficient?"

**Impact Score**: 4/5
*High: Core functionality depends on editor scroll integration. Wrong API choices may require significant rework.*

---

## 2. Preview Pane Scroll Interface

**Category**: Integration
**Status**: Partial
**Location**: FR-020, FR-022, FR-013, Assumption #3

**What's Specified**:
- "System MUST detect scroll events in the preview" (FR-020)
- "System MUST scroll the preview smoothly over SCROLL_ANIMATION_MS to the target position" (FR-013)
- Assumption: "The preview pane can receive and respond to scroll commands"
- Uncertainty noted: "an iframe or scrollable container"

**What's Missing**:
- Preview implementation type not confirmed (iframe vs. div container)
- Scroll event capture mechanism undefined (window vs. element scroll)
- Scroll command interface undefined (postMessage vs. direct DOM manipulation)
- Cross-origin considerations if iframe
- Access method for rendered DOM elements for position mapping

**Question Candidate**: "Is the preview pane implemented as an iframe or a scrollable div container? What is the API contract for (a) detecting scroll events and (b) programmatically scrolling the preview to a specific position?"

**Impact Score**: 4/5
*High: Core bidirectional sync depends on preview scroll integration. Architecture differs significantly between iframe and container implementations.*

---

## 3. AST Source Position Data Format

**Category**: Integration
**Status**: Partial
**Location**: FR-024, Position Mapping Strategy, Assumption #1

**What's Specified**:
- "System MUST use AST source position data to map preview content to source lines when available" (FR-024)
- Position Mapping Strategy: Primary method uses "AST source position data (line numbers from parsed nodes)"
- Assumption: "The preview pane's MDX compilation produces AST nodes with line/column information"

**What's Missing**:
- Expected shape of source position data from MDX AST nodes
- Which AST node types reliably provide position data (headings, paragraphs, JSX elements?)
- Interface for accessing AST metadata from rendered preview DOM
- Exposure mechanism from Spec 003's preview pane to Spec 008
- Handling for generated/synthetic nodes without source positions

**Question Candidate**: "What is the expected interface for accessing source position data from the preview pane's AST? Which MDX node types reliably provide line/column information, and how are positions exposed in the rendered DOM (data attributes, custom elements, etc.)?"

**Impact Score**: 5/5
*Critical: Position mapping accuracy is core to the feature. SC-004 requires 90%+ accuracy which depends entirely on AST position data availability.*

---

## 4. Settings Store Integration Protocol

**Category**: Integration
**Status**: Partial
**Location**: FR-003, Dependencies

**What's Specified**:
- "System MUST persist sync mode preference across sessions using the existing settings store" (FR-003)
- Dependency: "Spec 006 (Application Shell): Settings persistence and layout integration"

**What's Missing**:
- Key name for storing sync mode preference
- Settings store API method signatures
- Storage level: application-wide vs. per-document
- Migration strategy if settings schema changes
- Default value handling if key doesn't exist

**Question Candidate**: "What is the settings store API contract from Spec 006? Should sync mode be stored at the application level or per-document level, and what is the key naming convention?"

**Impact Score**: 3/5
*Medium: Persistence is straightforward but incorrect assumptions about API or storage level could cause bugs.*

---

## 5. Command Palette Registration Interface

**Category**: Integration
**Status**: Partial
**Location**: FR-050, FR-051, Dependencies

**What's Specified**:
- "System MUST register a 'Toggle Preview Sync' command with the command palette" (FR-050)
- "System MUST register a keyboard shortcut for sync toggle (Cmd+Shift+Y / Ctrl+Shift+Y)" (FR-051)
- Dependency: "Spec 005 (Command Palette): Command registration for sync toggle"

**What's Missing**:
- Command registration interface from Spec 005
- Expected command object shape (id, label, handler, shortcut, category)
- Dynamic enablement/visibility support
- State indicator support (showing current sync mode)

**Question Candidate**: "What is the command registration API from Spec 005, and should the sync toggle command display the current sync state or just toggle between enabled/disabled?"

**Impact Score**: 2/5
*Low: Command palette integration is secondary. Pattern likely established in Spec 005.*

---

## 6. Notification System Integration

**Category**: Integration
**Status**: Missing
**Location**: FR-052, User Story 5 Acceptance Scenario 4

**What's Specified**:
- "System MUST show a brief notification when sync is toggled via command or shortcut" (FR-052)
- "When the action completes, Then a brief notification confirms the new state" (US5-AS4)

**What's Missing**:
- Notification system/API not defined
- Not listed in Dependencies
- Notification duration, position, style undefined
- Whether application has existing notification infrastructure unknown

**Question Candidate**: "What notification API or component should be used for sync state change announcements? Does Spec 006 (Application Shell) provide a notification system, or should a new one be implemented?"

**Impact Score**: 2/5
*Low: Notifications are UX polish. Feature can work without them initially.*

---

## 7. Screen Reader Announcement Integration

**Category**: Integration
**Status**: Missing
**Location**: Non-Functional Requirements (Accessibility)

**What's Specified**:
- "Sync state must be announced to screen readers when changed"

**What's Missing**:
- Mechanism for screen reader announcements (ARIA live regions, focus management, etc.)
- Whether application has existing accessibility infrastructure
- Expected announcement text format
- Integration with existing announcement patterns (if any)

**Question Candidate**: "What accessibility infrastructure exists for screen reader announcements? Should ARIA live regions be used, and what is the expected announcement format when sync state changes?"

**Impact Score**: 3/5
*Medium: Accessibility is a compliance requirement. Missing infrastructure would require additional implementation.*

---

## 8. Reduced Motion Preference Detection

**Category**: Integration
**Status**: Clear
**Location**: Non-Functional Requirements (Accessibility)

**What's Specified**:
- "Reduced motion preference should disable smooth scroll animation (use instant scroll)"

**Assessment**: This is a standard browser API (`prefers-reduced-motion` media query or `window.matchMedia`). No ambiguity exists. Implementation is well-documented and straightforward.

**Impact Score**: 1/5

---

## Prioritized Question Candidates

Based on impact scores, the following questions should be addressed during clarification:

1. **(Impact 5)** INT-003: What is the expected interface for accessing source position data from the preview pane's AST? Which MDX node types reliably provide line/column information, and how are positions exposed in the rendered DOM?

2. **(Impact 4)** INT-001: Which specific CodeMirror 6 scroll and position APIs should be used for detecting visible line range and scrolling to a specific line with animation?

3. **(Impact 4)** INT-002: Is the preview pane implemented as an iframe or a scrollable div container? What is the API contract for detecting scroll events and programmatically scrolling?

4. **(Impact 3)** INT-004: What is the settings store API contract from Spec 006, and should sync mode be stored at the application level or per-document level?

5. **(Impact 3)** INT-007: What accessibility infrastructure exists for screen reader announcements, and what is the expected announcement format?

6. **(Impact 2)** INT-006: What notification API or component should be used for sync state change announcements?

7. **(Impact 2)** INT-005: What is the command registration API from Spec 005?

---

## Integration Dependency Map

```
+--------------------------------------------------------------+
|               Bidirectional Preview Sync                      |
|                       (Spec 008)                              |
+--------------------------------------------------------------+
|                                                               |
|  +------------------+    +------------------+                 |
|  |  Editor Scroll   |<-->|  Editor Core     | [PARTIAL]       |
|  |  Integration     |    |   (Spec 002)     | CM6 API TBD     |
|  +------------------+    +------------------+                 |
|                                                               |
|  +------------------+    +------------------+                 |
|  |  Preview Scroll  |<-->|  Preview Pane    | [PARTIAL]       |
|  |  Integration     |    |   (Spec 003)     | Interface TBD   |
|  +------------------+    +------------------+                 |
|                                                               |
|  +------------------+    +------------------+                 |
|  | Position Mapper  |<---|  Preview AST     | [PARTIAL]       |
|  | (AST-based)      |    |   (Spec 003)     | Data format TBD |
|  +------------------+    +------------------+                 |
|                                                               |
|  +------------------+    +------------------+                 |
|  | Sync Toggle Cmd  |--->| Command Palette  | [PARTIAL]       |
|  |                  |    |   (Spec 005)     | API assumed     |
|  +------------------+    +------------------+                 |
|                                                               |
|  +------------------+    +------------------+                 |
|  | Mode Persistence |--->| Settings Store   | [PARTIAL]       |
|  |                  |    |   (Spec 006)     | API assumed     |
|  +------------------+    +------------------+                 |
|                                                               |
|  +------------------+                                         |
|  | Notifications    |    [MISSING] No infrastructure defined  |
|  +------------------+                                         |
|                                                               |
|  +------------------+                                         |
|  | SR Announcements |    [MISSING] No infrastructure defined  |
|  +------------------+                                         |
|                                                               |
|  +------------------+                                         |
|  | Reduced Motion   |    [CLEAR] Standard browser API         |
|  +------------------+                                         |
|                                                               |
+--------------------------------------------------------------+
```

---

## External Services/APIs Analysis

**Finding**: No external services or third-party APIs are involved in this specification.

All integration points are internal to the application:
- Editor (Spec 002) - CodeMirror 6
- Preview Pane (Spec 003) - MDX compilation and rendering
- Command Palette (Spec 005) - Command registration
- Application Shell (Spec 006) - Settings and layout

**Failure Modes**: All failure modes are internal (e.g., AST unavailable, scroll API errors) rather than external service failures.

---

## Data Import/Export Formats Analysis

**Finding**: No data import/export formats are applicable to this feature.

The sync feature:
- Does not persist position mappings to external storage
- Does not export scroll positions
- Does not import sync configuration from external sources
- Uses only in-memory position cache with TTL

---

## Protocol/Versioning Assumptions Analysis

**Finding**: Implicit versioning dependencies exist but are not documented.

| Dependency | Version Assumption | Risk |
|------------|-------------------|------|
| CodeMirror 6 | Stable scroll API | Low - CM6 API is mature |
| MDX AST | unist position format | Medium - MDX compiler updates could change |
| Zustand | Existing store patterns | Low - internal convention |
| Electron | IPC for settings | Low - standard Electron patterns |

**Question Candidate**: "Should the position mapping implementation include validation for expected AST node position format to gracefully handle MDX compiler version changes?"

---

## Conclusion

The spec has **8 integration touchpoints** analyzed:
- **1 Clear**: Reduced motion detection uses standard browser API
- **5 Partial**: Editor scroll, preview scroll, AST positions, settings store, command palette have gaps
- **2 Missing**: Notification system and screen reader announcements have no defined infrastructure

The most critical gap is the **AST source position data interface** (Impact 5/5). The 90%+ position mapping accuracy requirement (SC-004) cannot be validated without understanding which AST nodes provide positions and how they're exposed.

**Recommended Action**: Prioritize clarifying the AST position data interface and the preview pane scroll contract before implementation begins. These two items block the core sync functionality.
