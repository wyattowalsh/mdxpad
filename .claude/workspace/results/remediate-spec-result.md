# Spec Remediation Edits

This document provides concrete edit instructions for fixing HIGH and MEDIUM severity issues in `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/spec.md`.

---

## Fix D4: FR-017 vs FR-017a numbering confusion

**File:** spec.md
**Location:** Line 205
**Action:** REPLACE

**Current text:**
```
- **FR-017a**: System MUST check if the current file has been modified externally when the window regains focus, and if so, prompt user to reload or keep current version
```

**New text:**
```
- **FR-042**: System MUST check if the current file has been modified externally when the window regains focus, and if so, prompt user to reload or keep current version
```

**Rationale:** FR-017a is confusingly adjacent to FR-017 but covers a different concern (external modification detection vs dirty check before open). Renumbering to FR-042 places it after all other FRs and eliminates the ambiguous "a" suffix numbering.

---

## Fix B1: SC-009 "feel smooth" is subjective

**File:** spec.md
**Location:** Line 274
**Action:** REPLACE

**Current text:**
```
- **SC-009**: Window operations (resize, divider drag) feel smooth with no perceptible lag (60fps target)
```

**New text:**
```
- **SC-009**: Window operations (resize, divider drag) MUST maintain at least 60 frames per second (16.67ms frame budget) with no dropped frames during continuous interaction
```

**Rationale:** "Feel smooth" is subjective and untestable. The replacement quantifies the requirement with a measurable 60fps threshold and explicit frame budget, making it verifiable via performance profiling tools.

---

## Fix B2: SC-010 "recoverable" error states undefined

**File:** spec.md
**Location:** Line 275
**Action:** REPLACE

**Current text:**
```
- **SC-010**: Error states are always recoverable - no action leaves the app in an unusable state
```

**New text:**
```
- **SC-010**: Error states are always recoverable - specifically: (1) save failures preserve editor content and allow retry, (2) file open failures return to previous document state, (3) preview compilation errors allow continued editing, (4) external file deletion allows save-as to new location. No error shall require force-quit or data loss to recover.
```

**Rationale:** "Recoverable" is vague without specifying which errors and what recovery means. The replacement enumerates the four primary error scenarios (save, open, preview, external deletion) and their specific recovery behaviors, making the criterion testable.

---

## Fix U1: Orphan file handling unspecified

**File:** spec.md
**Location:** After line 163
**Action:** INSERT

**Current text (line 163):**
```
- **What happens when** the file being edited is deleted or moved externally? → Show a warning and mark document as "orphaned" with option to save elsewhere
```

**New text:**
```
- **What happens when** the file being edited is deleted or moved externally? → Show a warning and mark document as "orphaned" with option to save elsewhere. Specifically: (1) status bar shows "(Deleted)" suffix after filename, (2) Cmd+S triggers save-as dialog instead of overwriting missing path, (3) warning persists until user saves to new location or creates new document
```

**Rationale:** The original edge case mentions "orphaned" state but doesn't define what that means for UX. The expanded definition specifies the three concrete behaviors users will experience.

---

## Fix U2: Rapid file opens queueing undefined

**File:** spec.md
**Location:** Line 169
**Action:** REPLACE

**Current text:**
```
- **What happens when** user rapidly opens multiple files? → Queue operations, show last opened file, maintain data integrity
```

**New text:**
```
- **What happens when** user rapidly opens multiple files? → Queue operations sequentially, showing loading indicator during transitions. Final state displays the last file in queue order. Each open request triggers dirty check for current document before proceeding. If user cancels any dirty check, the queue is cleared and current document is preserved.
```

**Rationale:** "Queue operations" doesn't specify queue behavior, dirty check interaction, or cancellation handling. The replacement defines sequential processing, loading feedback, dirty check integration, and cancellation semantics.

---

## Fix D1: Dialog terminology inconsistent

**File:** spec.md
**Location:** Lines 85-86
**Action:** REPLACE

**Current text:**
```
4. **Given** there are unsaved changes in the current document, **When** the user tries to open another file, **Then** a confirmation dialog appears asking to save, discard, or cancel
```

**New text:**
```
4. **Given** there are unsaved changes in the current document, **When** the user tries to open another file, **Then** a confirmation dialog appears asking to "Save", "Don't Save", or "Cancel" (per macOS convention)
```

**Rationale:** Line 85 uses "discard" while lines 99-102 use "Don't Save". macOS convention uses "Don't Save" (not "Discard"). This edit standardizes to the macOS convention and explicitly notes it.

---

## Fix D12: FR-037a timeout duplicated in Edge Cases

**File:** spec.md
**Location:** Line 167
**Action:** REPLACE

**Current text:**
```
- **What happens when** preview compilation hangs or takes too long? → Show loading state, allow user to continue editing, timeout after 3 seconds and show error
```

**New text:**
```
- **What happens when** preview compilation hangs or takes too long? → Behavior defined in FR-037a: show loading state, allow continued editing, timeout after 3 seconds with error state
```

**Rationale:** The 3-second timeout is already specified in FR-037a (line 242). The edge case should reference the authoritative FR rather than redefining the timeout value, avoiding potential inconsistencies if the timeout is later changed.

---

## Fix U3: Disk full error handling UI undefined

**File:** spec.md
**Location:** Line 165
**Action:** REPLACE

**Current text:**
```
- **What happens when** disk is full during save? → Show clear error message with the specific problem and do not lose editor content
```

**New text:**
```
- **What happens when** disk is full during save? → Show modal error dialog with message "Could not save: Disk is full. Free up space and try again." Editor content is preserved. User can retry via Cmd+S or save to different location via Cmd+Shift+S (save-as).
```

**Rationale:** "Clear error message" doesn't specify the UI component (dialog vs toast vs inline) or the exact message. The replacement specifies a modal dialog, provides example copy, and clarifies available recovery actions.

---

## Fix U4: Minimum window size not specified

**File:** spec.md
**Location:** Line 168
**Action:** REPLACE

**Current text:**
```
- **What happens when** window is resized very small? → Enforce minimum window size, gracefully collapse panels below certain thresholds
```

**New text:**
```
- **What happens when** window is resized very small? → Enforce minimum window size of 400x300 pixels. Below this, OS prevents further shrinking. If preview is visible and window width drops below 300px (100px editor min + 100px preview min + divider), preview auto-hides to give editor full width.
```

**Rationale:** "Minimum window size" was unspecified. The replacement provides concrete pixel dimensions (400x300) aligned with typical desktop minimums and explains panel collapse behavior based on the already-specified 100px pane minimum.

---

## Fix U5: FR-006 titlebar area lacks implementation detail

**File:** spec.md
**Location:** Line 184
**Action:** REPLACE

**Current text:**
```
- **FR-006**: System MUST support a titlebar/header area compatible with macOS traffic lights (hiddenInset style)
```

**New text:**
```
- **FR-006**: System MUST support a titlebar/header area using Electron's `titleBarStyle: 'hiddenInset'` with `trafficLightPosition` set to `{ x: 12, y: 12 }`. The custom titlebar region MUST be marked as a drag region (-webkit-app-region: drag) with interactive elements excluded (-webkit-app-region: no-drag).
```

**Rationale:** "Compatible with macOS traffic lights" is vague. The replacement specifies the exact Electron configuration options, traffic light positioning, and CSS drag region requirements needed for implementation.

---

## Fix U6: Error popover content structure undefined

**File:** spec.md
**Location:** After line 229
**Action:** INSERT

**Current text (line 229):**
```
- **FR-031a**: System MUST respond to error count click by: (1) jumping cursor to first error line in editor, (2) showing error details popover, and (3) scrolling preview to show the error
```

**New text:**
```
- **FR-031a**: System MUST respond to error count click by: (1) jumping cursor to first error line in editor, (2) showing error details popover, and (3) scrolling preview to show the error
- **FR-031b**: Error details popover MUST display: (1) error message text from MDX compilation, (2) line number and column if available, (3) a "Go to Error" button that re-triggers the jump to error action, (4) dismiss on click outside or Escape key. Popover positioned below the error count badge with arrow pointing to badge.
```

**Rationale:** FR-031a mentions "error details popover" but doesn't define what content it displays or its behavior. FR-031b specifies the popover's content structure, positioning, and dismissal behavior.

---

## Summary of Changes

| Issue ID | Severity | Fix Summary |
|----------|----------|-------------|
| D4 | HIGH | Renumber FR-017a to FR-042 |
| B1 | HIGH | Replace "feel smooth" with 60fps quantified requirement |
| B2 | HIGH | Define specific recovery scenarios for error states |
| U1 | HIGH | Expand orphan file handling with specific UX behaviors |
| U2 | HIGH | Define rapid file open queue behavior and dirty check interaction |
| D1 | MEDIUM | Standardize dialog button text to macOS "Don't Save" convention |
| D12 | MEDIUM | Reference FR-037a instead of redefining timeout |
| U3 | MEDIUM | Specify disk full error UI (modal dialog with message) |
| U4 | MEDIUM | Specify minimum window size (400x300px) |
| U5 | MEDIUM | Add Electron config details for titlebar |
| U6 | MEDIUM | Define error popover content structure (FR-031b) |

All edits preserve spec formatting conventions and maintain consistency with existing requirement numbering where possible.
