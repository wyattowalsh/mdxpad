# UX Flow Ambiguity Analysis

**Spec**: `specs/007-mdx-content-outline/spec.md`
**Category**: UX Flow
**Analysis Date**: 2026-01-17

---

## Summary

| Status | Count |
|--------|-------|
| Clear | 4 |
| Partial | 7 |
| Missing | 5 |

---

## Findings

### 1. Loading State During Initial AST Parsing

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: What should the outline panel display while the AST is being parsed for the first time when a document is opened? Should there be a loading spinner, skeleton UI, or is it expected to be fast enough to not need one?
- **Impact Score**: 3

**Analysis**: The spec mentions the outline updates within 500ms of document changes (FR-010, FR-015, FR-019), but there's no mention of what users see during the initial load when a document is first opened. The success criteria (SC-004) mentions parsing adds less than 50ms overhead, but initial document opening may take longer.

---

### 2. Loading State During Document Switching

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: When the user switches from one document to another, what is the transition state for the outline panel? Does it show the old outline until the new one is ready, clear immediately and show loading, or flash briefly?
- **Impact Score**: 3

**Analysis**: The spec assumes single-document model (Assumption 2) but doesn't describe the UX flow when switching between documents in the same session. Users may have multiple files open in sequence.

---

### 3. Error State Visual Design and Recovery Flow

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: When AST parsing fails, what specific visual treatment indicates the "warning indicator" mentioned in edge cases? Is there a retry mechanism, and if the user fixes the syntax error, does the outline auto-recover?
- **Impact Score**: 4

**Analysis**: Edge case mentions "Show the last valid outline with a warning indicator" but doesn't specify what the warning looks like (icon, banner, color change), where it appears, or whether users can dismiss it. FR-031 mentions "error state" but the visual treatment is undefined. Auto-recovery behavior is implied but not explicit.

---

### 4. Empty State Message Placement and Design

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: For the empty state ("No outline available..."), should this message appear in a specific visual style (muted text, icon, illustration)? Should it span the entire panel or be centered? Is the guidance text sufficient or should there be action buttons?
- **Impact Score**: 2

**Analysis**: Edge case specifies the message text but not the visual presentation. Modern UIs often include helpful illustrations or quick-action buttons in empty states.

---

### 5. Keyboard Navigation Flow Within Outline Tree

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: What is the complete keyboard navigation flow? Specifically: How does Tab/Shift+Tab interact with the tree? What happens when pressing Enter on a collapsed parent (expand or navigate)? Is there Escape to exit tree focus? What about Home/End keys?
- **Impact Score**: 4

**Analysis**: Non-functional requirements mention "arrow keys to move, Enter to select" and ARIA roles, but the full keyboard interaction model is incomplete. For example:
- Left/Right arrows for expand/collapse vs. Up/Down for traversal
- Tab behavior relative to other UI elements
- Focus ring visibility
- Typeahead search behavior

---

### 6. Screen Reader Announcement Specifics

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: What specific announcements should screen readers make? Should they announce the heading level (e.g., "Heading level 2, Installation"), component counts, section collapse state changes, and navigation success messages?
- **Impact Score**: 4

**Analysis**: The spec mentions "Screen readers must announce outline structure and navigation actions" but doesn't specify what text should be announced. This is critical for accessibility compliance. For example:
- "Installation, heading level 2, item 3 of 8"
- "Components section collapsed, 5 items hidden"
- "Navigated to line 42"

---

### 7. Visual Feedback During Navigation

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: Beyond the 500ms line highlight, should the clicked outline item show a selected/active state? What happens if the user clicks another item before the highlight fades - does the previous highlight cancel immediately?
- **Impact Score**: 2

**Analysis**: FR-022 specifies a 500ms flash highlight on the target line, but doesn't address:
- Whether the outline item itself shows selection state
- Behavior when rapidly clicking multiple items
- Whether the highlight uses the editor's current theme colors

---

### 8. Panel Resize Interaction

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: Can users manually resize the outline panel width? If so, what are the resize constraints (min/max width), is there a visual resize handle, and is the width persisted across sessions?
- **Impact Score**: 3

**Analysis**: FR-004 mentions minimum width of 150px enforced when narrow, but there's no specification of whether users can manually resize the panel. The spec only mentions auto-hide behavior. Manual resizing is a standard expectation for sidebar panels.

---

### 9. Hover State and Tooltip Behavior

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: For truncated headings (40+ chars), how long is the hover delay before showing the tooltip? Should tooltips also appear for component instances showing additional context (e.g., the component's props)?
- **Impact Score**: 2

**Analysis**: FR-009 mentions "showing full text on hover" but doesn't specify tooltip delay, positioning, or whether tooltips apply to other truncated content like long component names.

---

### 10. Focus Management After Navigation

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: After clicking an outline item and the editor scrolls to the target, where does keyboard focus go? Does it move to the editor (allowing immediate typing), stay in the outline panel, or follow a specific accessibility pattern?
- **Impact Score**: 4

**Analysis**: The spec describes cursor positioning (FR-021) but not focus management. For accessibility, focus should typically move to the editor after navigation to allow users to immediately start editing. This is critical for keyboard-only users.

---

### 11. Localization/i18n for Section Headers

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: Should the section headers ("Headings", "Components", "Frontmatter") and the empty state message be localized? If so, what is the localization strategy (i18n library, string keys)?
- **Impact Score**: 3

**Analysis**: The spec uses hard-coded English strings for section names and messages. There's no mention of localization support, string externalization, or RTL language considerations for the outline panel layout.

---

### 12. Animation/Transition Specifications

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: What are the animation specifications for panel show/hide, section collapse/expand, and the navigation highlight? Should animations respect prefers-reduced-motion for accessibility?
- **Impact Score**: 2

**Analysis**: The spec mentions toggle and collapse behaviors but not transition timing or animation style. Modern UI expectations include smooth animations, but accessibility requires respecting user motion preferences.

---

### 13. Outline Panel Header Actions

- **Category**: UX Flow
- **Status**: Clear
- **Question Candidate**: N/A
- **Impact Score**: N/A

**Analysis**: FR-005 clearly specifies a close button in the header. The toggle shortcut (Cmd+Shift+O) is well-defined.

---

### 14. Click-to-Navigate User Journey

- **Category**: UX Flow
- **Status**: Clear
- **Question Candidate**: N/A
- **Impact Score**: N/A

**Analysis**: User Story 1 provides a complete journey with clear acceptance scenarios. The flow from click to cursor position to highlight is well-specified.

---

### 15. Toggle Panel Visibility Journey

- **Category**: UX Flow
- **Status**: Clear
- **Question Candidate**: N/A
- **Impact Score**: N/A

**Analysis**: User Story 2 fully covers the toggle flow including persistence and both keyboard and button interactions.

---

### 16. Component Navigation Journey

- **Category**: UX Flow
- **Status**: Clear
- **Question Candidate**: N/A
- **Impact Score**: N/A

**Analysis**: User Story 3 clearly defines expanding component types, viewing instances, and clicking to navigate.

---

## Recommendations

### High Priority (Impact 4)
1. **Error State Design** - Define visual treatment for parsing errors and recovery flow
2. **Keyboard Navigation** - Document complete keyboard interaction model
3. **Screen Reader Announcements** - Specify announcement text templates
4. **Focus Management** - Define focus behavior after navigation

### Medium Priority (Impact 3)
5. **Loading States** - Define initial load and document switch transitions
6. **Panel Resizing** - Clarify if manual resize is supported
7. **Localization** - Determine i18n strategy

### Lower Priority (Impact 2)
8. **Empty State Design** - Enhance visual treatment specification
9. **Hover/Tooltip Behavior** - Specify timing and scope
10. **Animation Specs** - Define transitions and motion preferences

---

## Appendix: Checklist of UX Flow Topics

| Topic | Covered | Notes |
|-------|---------|-------|
| Happy path user journey | Yes | User Stories 1-5 well-defined |
| Empty state | Partial | Message defined, visual treatment not |
| Loading state | No | Not addressed |
| Error state | Partial | Mentioned but not detailed |
| Keyboard navigation | Partial | Basic mentioned, details missing |
| Screen reader support | Partial | Required but not specified |
| Focus management | No | Not addressed |
| Localization | No | Not addressed |
| Animations | Partial | Behavior implied, timing not specified |
| Responsive behavior | Yes | Auto-hide thresholds defined |
