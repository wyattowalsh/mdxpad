# Data Model Ambiguity Analysis

**Spec**: 006-application-shell
**Category**: Data Model
**Analyzed**: 2026-01-10

---

## Summary

The spec defines 4 key entities (Document, Layout, Settings, Status) in the "Key Entities" section (lines 235-244). While the high-level structure is clear, several data model details require clarification.

---

## Ambiguity Findings

### 1. Document Entity - fileId UUID Generation & Lifecycle

| Attribute | Value |
|-----------|-------|
| **Status** | Partial |
| **Location** | Line 237 |
| **Description** | The Document entity includes `fileId (UUID for tracking)` but does not specify when/how this UUID is generated or its lifecycle. |
| **Question Candidate** | When is the `fileId` UUID generated (on document creation, on first save, or on open)? Does it persist across app restarts? Is it stored in the file or only in memory? |
| **Impact Score** | 4 |
| **Rationale** | fileId is used for tracking but its generation timing affects whether new unsaved documents can be reliably tracked, and whether opened files maintain stable identities across sessions. Critical for future features like autosave recovery. |

---

### 2. Document Entity - Content Comparison for isDirty

| Attribute | Value |
|-----------|-------|
| **Status** | Partial |
| **Location** | Line 237 |
| **Description** | `isDirty` is derived as `content !== savedContent` but the comparison semantics are not specified. |
| **Question Candidate** | Should `isDirty` use strict equality (`===`), deep equality, or string comparison? How are whitespace-only changes handled? Is trailing newline normalization applied? |
| **Impact Score** | 3 |
| **Rationale** | Comparison semantics affect user experience - strict string comparison may mark documents dirty for invisible changes (e.g., trailing whitespace), while normalization may miss intentional whitespace changes. |

---

### 3. Layout Entity - splitRatio Bounds Validation

| Attribute | Value |
|-----------|-------|
| **Status** | Partial |
| **Location** | Line 239, FR-003 (Line 169) |
| **Description** | `splitRatio` is defined as 0-1, but FR-003 mentions "minimum widths" without specifying what splitRatio values correspond to those minimums. |
| **Question Candidate** | What are the effective min/max bounds for `splitRatio` given the minimum pane width constraints? Should invalid values be clamped or rejected? |
| **Impact Score** | 2 |
| **Rationale** | Without clear bounds, persisted splitRatio values from previous sessions (with different window sizes) may result in invalid layouts on restore. |

---

### 4. Settings Entity - recentFiles Structure

| Attribute | Value |
|-----------|-------|
| **Status** | Partial |
| **Location** | Line 241 |
| **Description** | `recentFiles` is described as "array of paths" but the structure and limits are not defined. |
| **Question Candidate** | What is the maximum number of entries in `recentFiles`? Should entries include metadata (last opened timestamp, file name)? How are missing/moved files handled in the list? |
| **Impact Score** | 2 |
| **Rationale** | Out of Scope section (line 313) mentions "Recent files list in UI (though settings store should support it)" indicating this data structure needs to be defined even if UI is deferred. Affects storage schema. |

---

### 5. Settings Entity - Schema Version & Migration

| Attribute | Value |
|-----------|-------|
| **Status** | Missing |
| **Location** | Line 241 (Settings entity) |
| **Description** | No schema version or migration strategy is defined for the Settings entity persisted via electron-store. |
| **Question Candidate** | How will settings schema changes be handled across app versions? Should a `schemaVersion` field be included? What is the migration strategy for incompatible changes? |
| **Impact Score** | 3 |
| **Rationale** | Without versioning, future settings schema changes may corrupt persisted data or cause silent failures. FR-035 requires loading preferences "before UI is shown" - corrupt data handling is critical. |

---

### 6. Status Entity - errorCount Source of Truth

| Attribute | Value |
|-----------|-------|
| **Status** | Partial |
| **Location** | Line 243 |
| **Description** | `errorCount` is described as "number from preview state" but the synchronization mechanism and error type scope are not defined. |
| **Question Candidate** | What types of errors contribute to `errorCount` (MDX compilation only, or also runtime errors)? Is there a separate store for errors or is it derived directly from PreviewPane state? |
| **Impact Score** | 2 |
| **Rationale** | FR-031 and FR-041 reference errors but the data flow between preview and status bar needs clear ownership. Affects component coupling. |

---

### 7. Document State - Orphaned Document Representation

| Attribute | Value |
|-----------|-------|
| **Status** | Missing |
| **Location** | Edge Cases (Line 151) |
| **Description** | Edge case mentions marking document as "orphaned" when external file is deleted, but Document entity has no field to represent this state. |
| **Question Candidate** | Should the Document entity include an `orphanedStatus` field or similar? What transitions are valid from orphaned state (save-as only?)? |
| **Impact Score** | 3 |
| **Rationale** | Without explicit state representation, orphaned handling becomes implicit and error-prone. Affects dirty check behavior and save flow. |

---

### 8. Document Entity - Maximum Content Size

| Attribute | Value |
|-----------|-------|
| **Status** | Missing |
| **Location** | Line 237 |
| **Description** | No maximum size or scale assumptions for document `content` field. |
| **Question Candidate** | What is the expected maximum document size? Should the system impose limits? How should performance degrade for very large files (>1MB, >10MB)? |
| **Impact Score** | 2 |
| **Rationale** | SC-002 requires preview updates within 500ms - this may not be achievable for very large files. Performance budgets implicitly assume document size bounds. |

---

### 9. Layout Entity - State Persistence Granularity

| Attribute | Value |
|-----------|-------|
| **Status** | Partial |
| **Location** | Line 239, FR-033 |
| **Description** | Layout is persisted but it's unclear if this is per-window, per-document, or global. |
| **Question Candidate** | Is layout state global (one layout for the app) or per-window? In single-document mode, is this distinction moot? |
| **Impact Score** | 1 |
| **Rationale** | Assumption 1 states single-document model, so likely global. Low impact but worth confirming for future multi-window support. |

---

### 10. Settings Entity - theme Validation

| Attribute | Value |
|-----------|-------|
| **Status** | Clear |
| **Location** | Line 241 |
| **Description** | `theme` is clearly defined as `'light' | 'dark' | 'system'` union type. |
| **Question Candidate** | N/A |
| **Impact Score** | 0 |
| **Rationale** | Explicitly enumerated values with clear semantics. |

---

## Impact Summary

| Impact Score | Count | Items |
|--------------|-------|-------|
| 5 (Critical) | 0 | - |
| 4 (High) | 1 | fileId lifecycle |
| 3 (Medium) | 3 | isDirty comparison, settings migration, orphaned state |
| 2 (Low) | 4 | splitRatio bounds, recentFiles structure, errorCount source, content size |
| 1 (Minimal) | 1 | layout persistence granularity |
| 0 (Clear) | 1 | theme validation |

---

## Recommended Clarification Questions (Priority Order)

1. **[Impact 4]** How and when is `Document.fileId` UUID generated, and does it persist across sessions?

2. **[Impact 3]** Should the Settings entity include a `schemaVersion` field for migration support?

3. **[Impact 3]** Should the Document entity include an explicit `orphanedStatus` field for externally-deleted files?

4. **[Impact 3]** What comparison semantics should `isDirty` use - strict string equality or normalized comparison?

5. **[Impact 2]** What is the structure and size limit for `Settings.recentFiles`?
