# UX Flow Ambiguity Analysis

**Spec**: `specs/008-bidirectional-sync/spec.md`
**Category**: UX Flow
**Analysis Date**: 2026-01-17

---

## Summary

| Status | Count |
|--------|-------|
| Clear | 3 |
| Partial | 6 |
| Missing | 5 |

---

## Findings

### 1. Critical User Journeys / Sequences

#### 1.1 Initial Sync Experience on Document Open

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: When a user opens a document, what is the initial sync state? Does sync automatically establish a position relationship, or does it only activate on first scroll? If the editor opens to a specific line (e.g., from "recent files" with saved position), should the preview immediately sync to that position?
- **Impact Score**: 4

**Analysis**: The spec does not describe the initial sync behavior when a document is first opened. Users may expect the preview to already show content corresponding to the editor's initial view. All user stories begin with an existing scroll action, not the initial document load state.

---

#### 1.2 Sync Toggle State Restoration Flow

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: When sync is toggled off via command palette (User Story 5), and later toggled back on, should it restore to the "last non-disabled mode" or always restore to "bidirectional"? The spec mentions "last non-disabled mode" but doesn't clarify if this is persisted across sessions.
- **Impact Score**: 3

**Analysis**: User Story 5 Acceptance Scenario 3 says "sync is enabled (to the last non-disabled mode)" but FR-003 only mentions persisting "sync mode preference" without clarifying toggle memory behavior. This creates ambiguity between the toggle command and the settings-based mode selection.

---

#### 1.3 Sync Behavior During Document Switching

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: When a user switches between multiple open documents (tabs), should the sync position be preserved per-document so returning to a document restores both editor and preview scroll positions? Or does each document switch reset to top?
- **Impact Score**: 4

**Analysis**: Out of Scope mentions "Multi-document sync" but doesn't clarify per-document position memory when switching. The spec states "Single document model: Sync operates on the currently active document only" (Assumption 4) but doesn't address what happens to sync state when documents are switched. This affects the core single-document UX when users work with multiple files.

---

#### 1.4 User Journey for Discovering Sync Feature

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: How does a new user discover that sync exists and how to configure it? Is there any onboarding hint, status bar indicator, or visual cue that sync is active/inactive?
- **Impact Score**: 3

**Analysis**: No mention of visual indicators showing current sync mode. Users may not know sync is happening automatically (it defaults to bidirectional per FR-002) or how to change it without exploring settings. The feature is essentially invisible unless the user discovers the command palette command or settings.

---

#### 1.5 Sync Behavior During Active Typing Flow

- **Category**: UX Flow
- **Status**: Clear
- **Question Candidate**: N/A
- **Impact Score**: N/A

**Analysis**: User Story 4 adequately describes sync while typing, including debounce behavior and the relationship between cursor position and preview sync. FR-014 specifies the threshold (SYNC_THRESHOLD_LINES) to prevent micro-syncs.

---

### 2. Error / Empty / Loading States

#### 2.1 Preview Parse Error State and Recovery

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: When the preview shows a parse error, the spec says "Editor sync is disabled; preview shows error state without attempting scroll sync." But what happens when the parse error is resolved mid-session? Does sync automatically re-enable, or must the user take action? Is there any visual indication in the sync UI that sync is suspended due to parse error?
- **Impact Score**: 4

**Analysis**: Edge case mentions error state behavior but not the recovery flow. Users need to understand that:
1. Sync will automatically resume once content is valid
2. They don't need to manually re-enable sync
3. A visual cue might help indicate sync is suspended (not disabled by user choice)

---

#### 2.2 Empty Document State

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: When a document is empty (new file with no content), what is the expected sync behavior? Is sync effectively disabled, or does it remain "ready" for when content appears? Should scroll events still be captured/debounced even when there's nothing to sync?
- **Impact Score**: 2

**Analysis**: Edge case covers "document is very short and fits in both viewports" as "sync is effectively no-op" but truly empty document (0 lines) behavior is not specified. While low impact, this is a common state for new documents.

---

#### 2.3 Loading State During Initial Preview Render

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: When a large document is opened and the preview is still rendering/compiling MDX, what sync behavior occurs? Should scroll events be queued until preview is ready, silently ignored, or should a loading indicator appear? What if the user scrolls rapidly before preview is ready?
- **Impact Score**: 3

**Analysis**: Performance constants and success criteria exist (e.g., SC-003, SC-007) but no UX flow for the loading/rendering phase before sync can operate. The spec assumes preview is always ready, but large documents or slow systems may have noticeable lag.

---

#### 2.4 Position Cache Miss Feedback

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: When position mapping falls back from "Primary (AST)" to "Secondary (DOM)" to "Fallback (proportional)", is there any visual or behavioral indication to the user that sync accuracy may be reduced? Should users expect different sync precision for different content types?
- **Impact Score**: 2

**Analysis**: Position Mapping Strategy defines fallback hierarchy but no UX consideration for when fallback is used. Users may notice "imprecise" sync without understanding why. SC-004 targets "90%+ accuracy for documents with AST source positions" implying 10% may be less accurate.

---

### 3. Accessibility / Localization Notes

#### 3.1 Screen Reader Announcements

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: The spec states "Sync state must be announced to screen readers when changed" but does not specify the announcement text, timing, or ARIA mechanism. What phrases should be announced for each mode change? Example: "Preview sync enabled, bidirectional mode" vs "Sync: bidirectional"? Should announcements use ARIA live regions, role="status", or another mechanism?
- **Impact Score**: 3

**Analysis**: NFR mentions screen reader announcement requirement but lacks specific ARIA label/announcement content specification. This is important for accessibility compliance but implementation details are missing.

---

#### 3.2 Reduced Motion Behavior Details

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: NFR states "Reduced motion preference should disable smooth scroll animation (use instant scroll)" but doesn't clarify: (1) Is this respecting `prefers-reduced-motion` media query automatically? (2) Should there be a manual override in app settings for users who want smooth scroll regardless? (3) Should the SCROLL_ANIMATION_MS constant be 0 or simply ignored?
- **Impact Score**: 3

**Analysis**: Good that reduced motion is mentioned, but implementation details for accessibility compliance need clarification. Modern accessibility practice requires respecting system preferences, but some users may want app-level control.

---

#### 3.3 Localization of Sync Mode Labels

- **Category**: UX Flow
- **Status**: Missing
- **Question Candidate**: The sync mode options (Disabled, Editor to Preview, Preview to Editor, Bidirectional) are English strings. Should these be localization keys? Are there any i18n considerations for the settings UI, command palette command names, and toggle notification messages?
- **Impact Score**: 2

**Analysis**: No mention of localization for user-facing strings. FR-052 mentions "a brief notification confirms the new state" but doesn't specify if notification text should be localized. If the application supports internationalization, these need to be translatable.

---

#### 3.4 Keyboard-Only Sync Interaction

- **Category**: UX Flow
- **Status**: Clear
- **Question Candidate**: N/A
- **Impact Score**: N/A

**Analysis**: FR-051 specifies keyboard shortcut (Cmd+Shift+Y / Ctrl+Shift+Y) and FR-050 registers command palette command. NFR mentions "Sync toggle must be accessible via keyboard shortcut." Keyboard accessibility for toggling is adequately specified.

---

#### 3.5 Focus Management During Sync

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: When the preview syncs to a new position (due to editor scroll), or when the editor syncs to a new position (due to preview scroll), should focus remain in the originating pane? If a user is navigating via keyboard in the preview, does synced scrolling interfere with their navigation or visible content?
- **Impact Score**: 3

**Analysis**: The spec discusses scroll behavior but not focus behavior. Synced scrolling should not steal focus or disrupt keyboard navigation in either pane. This is particularly important for accessibility - users shouldn't lose their place when sync scrolls the other pane.

---

#### 3.6 Notification Accessibility and Mechanism

- **Category**: UX Flow
- **Status**: Partial
- **Question Candidate**: FR-052 and User Story 5 mention "a brief notification confirms the new state" when sync is toggled. What is the notification mechanism (toast, status bar, ARIA live region)? How long does it persist? Is it dismissible? Does it use ARIA live regions for screen reader accessibility? Should it follow the app's existing notification pattern?
- **Impact Score**: 3

**Analysis**: Notification is mentioned but not specified. This affects both general UX and accessibility compliance. The notification should:
- Be visible but not intrusive
- Be accessible to screen readers
- Have consistent timing and placement with other app notifications
- Not require user dismissal for simple state confirmations

---

#### 3.7 Scroll Lock Feedback to User

- **Category**: UX Flow
- **Status**: Clear
- **Question Candidate**: N/A
- **Impact Score**: N/A

**Analysis**: The scroll lock algorithm (preventing feedback loops) is well-specified technically but appropriately invisible to users. Users should not see or need to understand the lock mechanism - they should simply experience smooth, non-jittery sync. The spec correctly treats this as an implementation detail rather than a UX concern.

---

## Recommendations

### High Priority (Impact 4)
1. **Initial Document Open Sync** - Define what happens when a document is first opened - does sync establish position immediately?
2. **Parse Error Recovery** - Clarify automatic sync re-enable behavior when errors are resolved
3. **Document Switching** - Specify per-document scroll position preservation behavior

### Medium Priority (Impact 3)
4. **Visual Sync Indicator** - Consider adding status bar or other visual indication of current sync mode
5. **Loading State** - Define behavior when preview is still rendering large documents
6. **Screen Reader Announcements** - Specify announcement text and ARIA implementation
7. **Reduced Motion** - Clarify `prefers-reduced-motion` integration details
8. **Focus Management** - Ensure sync scrolling doesn't interfere with keyboard navigation
9. **Notification Details** - Specify notification mechanism, duration, and accessibility
10. **Toggle State Persistence** - Clarify "last non-disabled mode" memory across sessions

### Lower Priority (Impact 2)
11. **Empty Document State** - Specify behavior for truly empty documents
12. **Position Cache Fallback** - Consider if users need to understand sync accuracy variations
13. **Localization** - Determine i18n strategy for user-facing strings

---

## Appendix: Checklist of UX Flow Topics

| Topic | Covered | Notes |
|-------|---------|-------|
| Happy path user journey | Yes | User Stories 1-4 well-defined |
| Empty state | Partial | Short document covered, truly empty not |
| Loading state | No | Not addressed |
| Error state | Partial | Behavior mentioned, recovery flow missing |
| Initial state on document open | No | Not addressed |
| Keyboard accessibility | Yes | Shortcut and command palette specified |
| Screen reader support | Partial | Required but announcements unspecified |
| Focus management | Partial | Not explicitly addressed for sync scrolling |
| Localization | No | Not addressed |
| Reduced motion | Partial | Requirement stated, details missing |
| Visual feedback/indicators | Partial | Notification mentioned, sync status indicator not |
| Document switching | No | Assumed single document, switching UX unclear |
