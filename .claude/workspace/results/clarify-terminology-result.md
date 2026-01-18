# Terminology & Consistency Scan Results

**Spec File**: `/Users/ww/dev/projects/mdxpad-persist/specs/011-autosave-recovery/spec.md`
**Category**: Terminology
**Date**: 2026-01-17

---

## Executive Summary

The 011-autosave-recovery spec has several terminology inconsistencies when compared against the Constitution glossary and existing codebase implementation (`src/main/services/auto-save.ts`, `src/renderer/stores/document-store.ts`). Key issues include entity naming conflicts with existing code, undefined terms, and inconsistent hyphenation of "auto-save".

---

## Findings

### 1. "RecoveryFile" vs "AutoSaveEntry" Entity Conflict

- **Category**: Terminology
- **Status**: Missing (name conflict with codebase)
- **Location**: Line 104 (Key Entities section)
- **Issue**: The spec introduces "RecoveryFile" as a Key Entity representing autosaved backup content. However, the existing codebase (`src/main/services/auto-save.ts`) already defines `AutoSaveEntry` interface with nearly identical properties (`fileId`, `originalPath`, `tempPath`, `savedAt`, `displayName`).
- **Existing Codebase Usage**:
  - `src/main/services/auto-save.ts`: `AutoSaveEntry` interface (lines 31-46)
- **Question Candidate**: Should the spec adopt "AutoSaveEntry" to align with existing codebase, or should the codebase be refactored to use "RecoveryFile"? Which term is canonical for auto-saved document backups?
- **Impact Score**: 4

---

### 2. "RecoveryManifest" Not Implemented

- **Category**: Terminology
- **Status**: Missing (new entity not in codebase)
- **Location**: Line 107 (Key Entities section)
- **Issue**: The spec introduces "RecoveryManifest" as "Index of all recoverable documents from previous sessions". The current implementation in `AutoSaveManager.findRecoverable()` discovers files dynamically via glob pattern scanning - no manifest file exists.
- **Existing Codebase Usage**: None - dynamic discovery via `glob(pattern)` in `auto-save.ts`
- **Question Candidate**: Is a formal RecoveryManifest file/structure required, or does the existing dynamic file discovery approach satisfy FR-003 ("detect on startup whether recovery data exists")? If a manifest is needed, what format (JSON?) and storage location?
- **Impact Score**: 4

---

### 3. "DirtyState" vs "isDirty" Property

- **Category**: Terminology
- **Status**: Partial
- **Location**: Line 106 (Key Entities section)
- **Issue**: The spec describes "DirtyState" as a Key Entity: "Tracks whether a document has unsaved changes; synchronized with document store; cleared on successful save or autosave." However, the existing codebase implements this as a simple `isDirty: boolean` property on `DocumentState` interface, not as a standalone type.
- **Existing Codebase Usage**:
  - `src/shared/types/document.ts` line 59: `readonly isDirty: boolean`
  - `src/renderer/stores/document-store.ts`: `selectIsDirty` selector
- **Question Candidate**: Should "DirtyState" remain a conceptual entity description, or does the spec intend a new standalone type beyond the existing `isDirty` boolean? The description mentions "synchronized with document store" which implies coordination logic beyond a simple flag.
- **Impact Score**: 3

---

### 4. "Autosave" vs "Auto-save" Hyphenation Inconsistency

- **Category**: Terminology
- **Status**: Partial
- **Location**: Title (line 1), throughout spec body
- **Issue**: Inconsistent hyphenation throughout:
  - Spec title: "Autosave & Crash Recovery" (no hyphen)
  - Spec body: "autosave" (no hyphen, ~30 occurrences)
  - Constitution §7.3: "Auto-save MUST prevent data loss" (hyphenated)
  - Codebase file: `auto-save.ts` (hyphenated)
  - Codebase class: `AutoSaveManager` (PascalCase, no hyphen - appropriate for class names)
  - Codebase constants: `AUTO_SAVE_PREFIX`, `AUTO_SAVE_INTERVAL` (underscored)
- **Question Candidate**: Should the canonical prose form be "auto-save" (hyphenated) to match Constitution, or "autosave" (one word)? Note: PascalCase `AutoSave` for code identifiers is acceptable regardless.
- **Impact Score**: 2

---

### 5. "Document Store" Undefined in Constitution

- **Category**: Terminology
- **Status**: Partial
- **Location**: Lines 6, 98, 106, 122, 132
- **Issue**: The spec references "document store" as an integration point but this term is not defined in the Constitution glossary. The codebase has `useDocumentStore` (Zustand store) and `DocumentStore` type.
- **Existing Codebase Usage**:
  - `src/renderer/stores/document-store.ts`: exports `useDocumentStore` hook
  - `src/shared/types/document.ts`: `DocumentState` interface
- **Question Candidate**: Should "Document Store" be added to the Constitution glossary as a canonical term? Definition: "Zustand store (`useDocumentStore`) managing document state including content, file handle, and dirty tracking."
- **Impact Score**: 2

---

### 6. "Recovery Location" Vague Terminology

- **Category**: Terminology
- **Status**: Partial
- **Location**: Lines 16, 20
- **Issue**: The spec uses "recovery location" without specifying where. The existing implementation uses the system temp directory: `app.getPath('temp')`.
- **Existing Codebase Usage**:
  - `src/main/services/auto-save.ts` line 101-104: `app.getPath('temp')`
- **Question Candidate**: Should the spec explicitly define "recovery location" as the system temp directory, or is a dedicated recovery directory needed (e.g., `~/.mdxpad/recovery/`)? The temp directory may be cleared by OS; is this acceptable?
- **Impact Score**: 2

---

### 7. "Content Snapshot" vs "Content"

- **Category**: Terminology
- **Status**: Partial
- **Location**: Line 104
- **Issue**: RecoveryFile entity uses "content snapshot" while existing code uses plain "content" string in `DirtyFile` interface.
- **Existing Codebase Usage**:
  - `src/main/services/auto-save.ts` line 62: `readonly content: string`
- **Question Candidate**: Is "snapshot" a meaningful distinction to preserve (implies point-in-time capture), or should "content" be used consistently?
- **Impact Score**: 1

---

### 8. "Document" Terminology

- **Category**: Terminology
- **Status**: Clear
- **Location**: Throughout spec
- **Issue**: None - "document" is used consistently to mean an MDX file being edited, matching codebase `DocumentState` type and established usage in other specs.
- **Impact Score**: 0

---

### 9. "Session" Terminology

- **Category**: Terminology
- **Status**: Clear
- **Location**: Lines 89, 107
- **Issue**: None - "session" is used correctly to mean a single application run/instance, consistent with standard usage.
- **Impact Score**: 0

---

### 10. "Crash" Terminology

- **Category**: Terminology
- **Status**: Clear
- **Location**: Lines 26-38, 100
- **Issue**: None - "crash" consistently refers to unexpected application exit (crash, power loss, forced quit). User Story 2 clarifies scope appropriately.
- **Impact Score**: 0

---

### 11. "Interval" Terminology

- **Category**: Terminology
- **Status**: Clear
- **Location**: Lines 20, 64, 68, 95
- **Issue**: None - "interval" consistently refers to the time period between auto-saves. Matches codebase `AUTO_SAVE_INTERVAL` constant.
- **Impact Score**: 0

---

## Summary Table

| # | Term/Issue | Status | Impact | Action Required |
|---|------------|--------|--------|-----------------|
| 1 | RecoveryFile vs AutoSaveEntry | Missing | 4 | Align with codebase or refactor |
| 2 | RecoveryManifest undefined | Missing | 4 | Clarify if manifest required |
| 3 | DirtyState vs isDirty | Partial | 3 | Clarify entity vs property |
| 4 | Autosave vs Auto-save | Partial | 2 | Standardize hyphenation |
| 5 | Document Store undefined | Partial | 2 | Add to Constitution glossary |
| 6 | Recovery Location vague | Partial | 2 | Specify storage location |
| 7 | Content Snapshot vs Content | Partial | 1 | Align terminology |
| 8 | Document | Clear | 0 | No action |
| 9 | Session | Clear | 0 | No action |
| 10 | Crash | Clear | 0 | No action |
| 11 | Interval | Clear | 0 | No action |

---

## Recommended Glossary Additions

The following terms should be considered for addition to the Constitution glossary:

| Term | Recommended Definition |
|------|------------------------|
| **Auto-save** | Automatic periodic saving of dirty documents to a recovery location to prevent data loss (per §7.3) |
| **Recovery File** (or **AutoSaveEntry**) | Temporary file containing auto-saved document content for crash recovery |
| **Document Store** | Zustand store (`useDocumentStore`) managing document state including content, file handle, and dirty tracking |

---

## Recommended Clarification Questions (Priority Order)

1. **(Impact 4)** Should "RecoveryFile" be renamed to "AutoSaveEntry" to align with existing codebase (`src/main/services/auto-save.ts`), or should the codebase be refactored? Which term is canonical?

2. **(Impact 4)** Is a formal "RecoveryManifest" file required for this spec, or does the existing dynamic file discovery approach (glob scanning temp directory) satisfy requirements FR-003 and FR-004?

3. **(Impact 3)** Should "DirtyState" be a new standalone type/entity with synchronization logic, or continue as the existing `isDirty` boolean property on `DocumentState`?

4. **(Impact 2)** Should the canonical prose form be "auto-save" (hyphenated, per Constitution §7.3) or "autosave" (one word, per spec title)?

5. **(Impact 2)** Should "recovery location" be explicitly defined as the system temp directory, or does the spec require a dedicated persistent directory?
