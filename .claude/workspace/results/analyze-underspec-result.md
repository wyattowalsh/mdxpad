# Underspecification Analysis: Application Shell (006)

**Analyzed Files:**
- `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/spec.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/plan.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/tasks.md`

**Analysis Date:** 2026-01-10

---

## Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| U1 | HIGH | spec.md:163-164, tasks.md | Edge case "file deleted/moved externally" mentions showing warning and "orphaned" state, but no task implements this handling. FR-017a only covers modification detection, not deletion/move. | Add explicit task for detecting deleted/moved files on focus. Define orphaned state in document store schema. Specify dialog text and actions for orphaned documents. |
| U2 | HIGH | spec.md:169, tasks.md | Edge case "user rapidly opens multiple files" mentions queueing operations, but no task or implementation detail addresses operation queueing or debouncing concurrent file opens. | Add queueing mechanism specification to T003 (File Lifecycle Commands) or create new task. Define behavior when second open request arrives while first is pending. |
| U3 | MEDIUM | spec.md:165, tasks.md:T003 | Edge case "disk full during save" specifies showing error message, but T003 acceptance criteria only verify IPC calls without specifying error handling UI or message content. | Add acceptance criterion to T003: "Save failure shows error dialog with specific problem (e.g., disk full, permission denied). Editor content preserved." Define error message templates. |
| U4 | MEDIUM | spec.md:168, tasks.md | Edge case "window resized very small" mentions enforcing minimum window size and collapsing panels, but no task addresses minimum window dimensions or graceful collapse thresholds. | Add implementation details to T006 or main/index.ts modification. Specify minimum window width/height (e.g., 400x300). Define collapse behavior when window < threshold. |
| U5 | MEDIUM | spec.md:FR-006, tasks.md | FR-006 requires "titlebar/header area compatible with macOS traffic lights (hiddenInset style)" but no task explicitly creates this area or verifies traffic light positioning. T006 mentions "macOS titlebar area with traffic lights support" but lacks implementation detail. | Add explicit acceptance criterion with pixel dimensions for drag region. Verify traffic lights don't overlap content. Reference Electron titleBarOverlay API configuration. |
| U6 | MEDIUM | spec.md:US5-SC5, tasks.md:T004 | Acceptance scenario US5-SC5 requires error click to show "error details popover" but T004/T007 don't specify popover content structure (line number, error message, error code), dismiss behavior, or positioning. | Define ErrorPopover content structure: `{line: number, column: number, message: string}`. Specify dismiss triggers (click outside, Escape, click error again). Define position relative to error badge. |
| U7 | MEDIUM | plan.md:contracts/, tasks.md | Plan references `contracts/shell-schemas.ts` but no task creates this file. T001 references it as "Implementation Reference" without CREATE directive for the contracts file. | Add explicit file creation to T001 or create separate T000 task for contracts/schemas file. Include zod schema definitions for DocumentState, FileHandle, Layout, Settings. |
| U8 | LOW | spec.md:FR-037a, tasks.md | FR-037a specifies 3-second compilation timeout with "error state" but no task defines what this error state looks like, whether a retry button exists, or how to distinguish timeout from other errors. | Add timeout error state UI definition to PreviewPane task or T005. Specify: visual treatment, retry mechanism if any, differentiation from syntax errors. |
| U9 | LOW | spec.md:US3-SC3, tasks.md:T003 | US3-SC3 says "cursor is positioned at the start of the document" after open, but no task acceptance criterion explicitly verifies cursor positioning behavior post-open. | Add acceptance criterion to T003 or T005: "After file open, cursor position is (line 1, column 1)" and "CursorPosition component shows 'Ln 1, Col 1'". |
| U10 | LOW | spec.md:US6-SC4, tasks.md:T002 | US6-SC4 requires "all settings applied before UI visible (no flash)" but T002 only tests splitRatio persistence. Other settings (previewVisible, zoomLevel) not addressed in any task acceptance criteria. | Expand T002 acceptance criteria to include: previewVisible persistence, zoomLevel persistence. Add test for "no visible flash" (verify synchronous load timing). |
| U11 | LOW | spec.md:Key Entities, tasks.md:T001 | Document entity includes `fileId (UUID for tracking)` but T001 acceptance criteria say `newDocument()` resets with new UUID without specifying UUID generation method or when UUID changes vs persists. | Clarify: Does UUID persist across saves? Is it generated client-side (crypto.randomUUID)? Add to T001: "UUID generated via crypto.randomUUID(), persists for document lifetime until newDocument() called." |
| U12 | LOW | spec.md:FR-031a, tasks.md:T007 | FR-031a requires preview to "scroll to show the error" but no specification for how preview identifies error location or scrolling API. Preview iframe isolation may complicate scroll coordination. | Define IPC message or postMessage protocol for scroll-to-error. Specify how error line maps to preview DOM position. Document if scrolling to approximate location is acceptable. |
| U13 | LOW | spec.md:257-258, tasks.md | Settings entity includes `recentFiles (array of paths)` but spec says "Recent files list in UI" is out of scope. Unclear if recentFiles should be populated/persisted or left empty for future use. | Clarify intent: If populating recentFiles, add task for electron-store persistence. If deferring, note explicitly that field exists but is not written to in this spec. |
| U14 | LOW | tasks.md:T011 | T011 acceptance criterion "Menu items enable/disable based on state (future)" defers dynamic menu state, but spec FR-021 (Save As) implies menu should always be enabled. Clarify which items need dynamic state. | Remove "(future)" qualifier or explicitly list which menu items are always enabled (New, Open, Save As) vs conditionally enabled (Save - disabled when clean?). |

---

## Summary by Severity

| Severity | Count | Impact |
|----------|-------|--------|
| HIGH | 2 | Core functionality gaps that could cause data loss or undefined behavior |
| MEDIUM | 5 | Non-critical features missing implementation details |
| LOW | 7 | Edge cases or optional behaviors that could be refined |

## Critical Path Impact

The HIGH severity issues (U1, U2) both relate to edge cases that could cause undefined application behavior:
- **U1** (orphaned files): User opens file, external process deletes it, user saves - what happens? Current spec doesn't define this path.
- **U2** (rapid opens): User spams Cmd+O or programmatic opens could corrupt document state without queueing.

Both should be addressed before implementation begins to avoid late-stage architectural changes.
