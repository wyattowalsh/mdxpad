# Integration Ambiguity Analysis: 006-application-shell

**Spec**: `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/spec.md`
**Analysis Date**: 2026-01-10
**Category Focus**: Integration & External Dependencies

---

## Summary

The Application Shell spec (006) primarily focuses on integrating existing internal components rather than external services. However, several integration-related ambiguities exist around data persistence formats, dependency contracts, and failure mode handling.

---

## Findings

### 1. Settings Persistence Storage Backend

| Attribute | Value |
|-----------|-------|
| **Status** | Partial |
| **Impact** | 4 |

**Current State**: The spec references "electron-store persistence" in the input description and FR-033/FR-034 require persisting layout and user preferences across sessions. However, the spec does not explicitly define:
- Whether to use `electron-store` (main process) vs `localStorage` (renderer process)
- The store schema/data format for settings
- Migration strategy if schema changes

**Evidence from Codebase**:
- `src/main/services/recent-files.ts` uses `electron-store` for recent files
- `src/renderer/stores/ui-layout-store.ts` uses `localStorage` for UI layout
- These are two different persistence mechanisms

**Question Candidate**: Which persistence backend should be used for settings in Spec 006 - `electron-store` (main process, per Spec 004 pattern) or `localStorage` (renderer process, per Spec 005 pattern)? If both, which settings belong where?

---

### 2. Split Ratio Persistence Format

| Attribute | Value |
|-----------|-------|
| **Status** | Partial |
| **Impact** | 3 |

**Current State**: FR-033 requires persisting "layout preferences (split ratio, panel visibility)" but does not specify:
- The exact data structure for split ratio storage
- Validation rules for persisted values (is 0-1 range enforced on load?)
- Default value if persisted value is invalid or missing

**Key Entity Definition**: "Layout: ... splitRatio (0-1, position of divider)" - defines the range but not the persistence format.

**Question Candidate**: What is the exact schema for persisting split ratio? Should invalid persisted values (outside 0-1) be rejected with error, clamped to valid range, or reset to default?

---

### 3. Dependency on Spec 004 Auto-Save Recovery

| Attribute | Value |
|-----------|-------|
| **Status** | Missing |
| **Impact** | 4 |

**Current State**: The spec mentions in Edge Cases: "What happens when the app crashes with unsaved changes? → Future: autosave/recovery (out of scope for this spec, but design should not preclude it)". However, Spec 004 (File System Shell) FR-014/FR-015 already mandate:
- FR-014: Auto-save dirty files every 30 seconds to a temporary location
- FR-015: On app launch detect recoverable auto-saved files and show a dialog

This creates a contract dependency that is not explicitly acknowledged in Spec 006's Dependencies section.

**Question Candidate**: Should Spec 006 integrate with Spec 004's auto-save recovery system (FR-014/FR-015)? If so, how should the recovery dialog integrate with the Application Shell's document lifecycle?

---

### 4. External File Modification Detection Integration

| Attribute | Value |
|-----------|-------|
| **Status** | Missing |
| **Impact** | 5 |

**Current State**: Edge Cases mention: "What happens when the file being edited is deleted or moved externally?" and "What happens when the file is modified externally while open?" with behavioral descriptions. However:
- No explicit FR requirements exist for this behavior
- Spec 004 FR-010/FR-011 provide file watching infrastructure
- The `MdxpadAPI.onFileChange` callback exists in `src/preload/api.ts`

The Application Shell needs to consume these events but there is no requirement specifying the integration contract.

**Question Candidate**: How should Spec 006 integrate with Spec 004's file change events (FR-010/FR-011)? Specifically: (a) What UI should display the "orphaned" warning for deleted files? (b) What dialog options for external modification conflicts (reload/keep/merge)?

---

### 5. Menu Event Routing Contract

| Attribute | Value |
|-----------|-------|
| **Status** | Partial |
| **Impact** | 3 |

**Current State**: FR-040 states "System MUST handle menu events (from native menu) and route them to appropriate commands". The `MdxpadAPI` in `src/preload/api.ts` defines several menu event subscriptions:
- `onMenuCommandPalette`
- `onMenuNewFile`
- `onMenuOpenFileDialog`
- `onMenuOpenFile`
- `onMenuSaveFile`
- `onMenuSaveFileAs`

However, the spec does not explicitly enumerate:
- Which menu events must be handled
- The expected event payload types
- How menu state (enabled/disabled) synchronizes with document state

**Question Candidate**: Which specific menu events from `MdxpadAPI` must be integrated? How should menu item enabled states (e.g., "Save" disabled when not dirty) be synchronized with Application Shell state?

---

### 6. Command Context Data Contract

| Attribute | Value |
|-----------|-------|
| **Status** | Partial |
| **Impact** | 4 |

**Current State**: FR-039 states "System MUST provide complete CommandContext to command palette including current document and editor state". The `CommandContext` type in `src/shared/types/commands.ts` defines:
- `editor: EditorView | null`
- `document: DocumentContext`
- `ui: UIContext`
- `platform: PlatformContext`
- `api: MdxpadAPI`
- `notify: (notification: NotificationInput) => void`

The spec references `DocumentContext` fields (fileId, filePath, content, isDirty) but does not explicitly map how the Application Shell's document state store provides these values to the command context.

**Question Candidate**: Should the Application Shell's document state store directly implement `DocumentContext`, or should a transformation layer exist? Who owns the creation of `CommandContext` instances?

---

### 7. Error Count Integration with Preview

| Attribute | Value |
|-----------|-------|
| **Status** | Partial |
| **Impact** | 3 |

**Current State**: FR-031 requires "System MUST display error count when preview compilation has errors" and FR-041 requires "System MUST connect error click events from preview to editor navigation (jump to error line)". However:
- The spec does not define how error state is obtained from the preview component
- No contract for the error data structure (line number, column, message)
- Spec 003 (Preview Pane) contract details are not explicitly referenced

**Question Candidate**: What is the contract for obtaining error information from the Preview Pane? Does the preview expose an error list/count via props, store subscription, or callback?

---

### 8. IPC Zod Schema Versioning

| Attribute | Value |
|-----------|-------|
| **Status** | Missing |
| **Impact** | 3 |

**Current State**: FR-009 in Spec 004 mandates "System MUST validate all IPC payloads using zod schemas on both ends". The Application Shell relies on these IPC channels but does not address:
- What happens if schema validation fails on one end
- How schema evolution/versioning is handled
- Error reporting for schema validation failures

This could cause silent failures or unclear errors during IPC communication.

**Question Candidate**: How should the Application Shell handle IPC schema validation failures? Should validation errors be surfaced to the user, logged silently, or trigger a specific error flow?

---

## Impact Summary

| Impact Score | Count | Items |
|--------------|-------|-------|
| 5 (Critical) | 1 | External File Modification Detection Integration |
| 4 (High) | 3 | Settings Persistence Backend, Dependency on Auto-Save Recovery, Command Context Data Contract |
| 3 (Medium) | 4 | Split Ratio Persistence Format, Menu Event Routing Contract, Error Count Integration, IPC Schema Versioning |

---

## Recommendations

1. **High Priority**: Explicitly document the integration contract with Spec 004's file watching and auto-save features. These are already implemented and the Application Shell must consume them.

2. **High Priority**: Clarify the persistence strategy - recommend using `electron-store` for settings that need main process access (file paths, window state) and `localStorage` for renderer-only UI state (similar to existing pattern).

3. **Medium Priority**: Add explicit FRs for external file modification handling, referencing Spec 004's infrastructure.

4. **Medium Priority**: Document the `CommandContext` creation ownership and its relationship to the document state store.
