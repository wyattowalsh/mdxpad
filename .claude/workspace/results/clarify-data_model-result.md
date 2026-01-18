# Data Model Clarification Analysis

**Spec**: 011-autosave-recovery
**Category**: Data Model
**Analyzed**: 2026-01-17

---

## Summary

The specification defines four key entities (RecoveryFile, AutosaveSettings, DirtyState, RecoveryManifest) at a conceptual level but lacks critical detail on identity rules, relationships, lifecycle transitions, and scale assumptions.

---

## Ambiguity Findings

### 1. RecoveryFile Identity & Uniqueness

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | RecoveryFile identity/key |
| **Question Candidate** | How is a RecoveryFile uniquely identified? Is identity based on a combination of document identifier + timestamp, or is there a separate recovery file ID? What exactly constitutes the "document identifier" - is this a UUID, file path, or something else? Can multiple RecoveryFiles exist for the same document (e.g., multiple snapshots at different times)? |
| **Impact Score** | 5 |

**Rationale**: Identity is fundamental to all CRUD operations, deduplication logic, and recovery selection. Without clear uniqueness rules, implementation will face conflicts, duplicate recovery entries, or orphaned files.

---

### 2. RecoveryFile-to-Document Relationship

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | RecoveryFile-Document cardinality |
| **Question Candidate** | What is the relationship cardinality between RecoveryFile and Document? Is it 1:1 (latest only), 1:N (multiple snapshots per document), or N:1 (multiple documents consolidated)? How does the system link a RecoveryFile back to its source document if the source file was renamed, moved, or deleted? For new unsaved documents (no file path yet), what serves as the document identifier? |
| **Impact Score** | 5 |

**Rationale**: This affects recovery logic, storage strategy, and the recovery dialog's ability to match recovery data with documents. Critical for the core recovery flow.

---

### 3. RecoveryManifest Structure & Contents

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | RecoveryManifest attributes |
| **Question Candidate** | What attributes does the RecoveryManifest contain for each entry (file name, path, last modified, preview snippet, recovery file path)? Is there one global RecoveryManifest or per-session manifests? How does the manifest relate to individual RecoveryFiles - does it reference them by path, ID, or embed them? |
| **Impact Score** | 4 |

**Rationale**: The manifest structure determines how quickly recovery data can be enumerated (SC-003: 2 second requirement), what information is shown in the recovery dialog, and how recovery selection works.

---

### 4. DirtyState Lifecycle & Transitions

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | DirtyState state machine |
| **Question Candidate** | What are all valid DirtyState transitions? (e.g., clean -> dirty -> autosaved -> clean) Is "autosaved" a distinct state from "clean" or does autosave clear dirty state entirely? If autosave occurs but the source file is never manually saved, what is the dirty state? Does DirtyState track whether recovery data exists separately from unsaved changes? |
| **Impact Score** | 4 |

**Rationale**: DirtyState drives UI indicators, autosave trigger logic, and integration with the document store (FR-012). Unclear transitions lead to inconsistent UI and missed autosaves.

---

### 5. AutosaveSettings Attributes & Defaults

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | AutosaveSettings schema |
| **Question Candidate** | What exactly are "retention settings"? (e.g., max recovery files per document, max total size, max age) What are the precise default values for each setting? Are settings stored per-user, per-workspace, or globally? |
| **Impact Score** | 3 |

**Rationale**: Retention settings affect storage management and data model design. Without clarity, implementation may default to unbounded retention, causing disk space issues.

---

### 6. RecoveryFile Content Structure

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Missing |
| **Element** | Content snapshot format |
| **Question Candidate** | What format is the content snapshot stored in (raw MDX text, AST, compressed blob)? Does the RecoveryFile store metadata alongside content (cursor position, scroll position, undo history)? Is the snapshot differential (changes only) or full document content? |
| **Impact Score** | 3 |

**Rationale**: Affects storage efficiency, recovery fidelity, and SC-001 (95% work recovery). Full vs. differential impacts performance and storage.

---

### 7. RecoveryFile Lifecycle & Cleanup

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Partial |
| **Element** | RecoveryFile state transitions |
| **Question Candidate** | What is the complete lifecycle of a RecoveryFile? (created on autosave -> updated on subsequent autosaves -> deleted on manual save/recovery decline -> ?) When are old RecoveryFiles purged if the user never manually saves? What happens to recovery data when a document is closed without saving (normal exit, not crash)? Is there a maximum age for recovery files before automatic cleanup? |
| **Impact Score** | 4 |

**Rationale**: Without clear lifecycle rules, recovery storage can grow unbounded. Edge case of "close without save" is common and unclear.

---

### 8. Data Volume & Scale Assumptions

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Missing |
| **Element** | Scale limits |
| **Question Candidate** | What is the expected maximum number of concurrent open documents requiring autosave? What is the expected maximum document size that autosave must handle? What is the expected maximum total recovery storage footprint? How many RecoveryFiles (snapshots) should be retained per document? |
| **Impact Score** | 3 |

**Rationale**: Scale assumptions affect storage strategy (flat files vs. SQLite), cleanup policies, and performance testing requirements. Edge case in spec (line 81) mentions "very large documents" without quantifying.

---

### 9. Timestamp Granularity & Timezone

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Missing |
| **Element** | Timestamp attributes |
| **Question Candidate** | What granularity is the timestamp (milliseconds, seconds)? Is the timestamp stored in UTC or local timezone? Is the timestamp the creation time, last modification time, or both? |
| **Impact Score** | 2 |

**Rationale**: Affects ordering, display in recovery dialog, and conflict resolution when multiple autosaves occur close together.

---

### 10. Corruption Handling Data Model

| Field | Value |
|-------|-------|
| **Category** | Data Model |
| **Status** | Missing |
| **Element** | Integrity tracking |
| **Question Candidate** | Should RecoveryFile include a checksum or integrity flag attribute? How is corruption detected and represented in the data model? Should there be a "recovery status" attribute (valid, corrupted, partial)? |
| **Impact Score** | 3 |

**Rationale**: Directly addresses edge case in spec (line 80: "What happens when recovery data is corrupted or incomplete?"). Without integrity tracking, the system cannot reliably filter out corrupted recovery files in the recovery dialog.

---

## Summary Statistics

| Status | Count |
|--------|-------|
| Clear | 0 |
| Partial | 6 |
| Missing | 4 |
| **Total Ambiguities** | **10** |

| Impact Score | Count |
|--------------|-------|
| 5 (Critical) | 2 |
| 4 (High) | 3 |
| 3 (Medium) | 4 |
| 2 (Low) | 1 |

---

## Recommended Clarification Priority

1. **RecoveryFile Identity & Uniqueness** (Impact: 5) - Foundational to all CRUD operations
2. **RecoveryFile-to-Document Relationship** (Impact: 5) - Core recovery flow depends on this
3. **RecoveryManifest Structure & Contents** (Impact: 4) - Required for recovery dialog
4. **DirtyState Lifecycle & Transitions** (Impact: 4) - UI and autosave trigger logic
5. **RecoveryFile Lifecycle & Cleanup** (Impact: 4) - Storage management
6. **AutosaveSettings Attributes & Defaults** (Impact: 3) - Configuration completeness
7. **RecoveryFile Content Structure** (Impact: 3) - Storage efficiency
8. **Data Volume & Scale Assumptions** (Impact: 3) - Performance testability
9. **Corruption Handling Data Model** (Impact: 3) - Edge case robustness
10. **Timestamp Granularity & Timezone** (Impact: 2) - Minor but affects ordering
