# Integration Ambiguity Analysis: Spec 011-autosave-recovery

**Analyzed**: 2026-01-17
**Spec File**: `/Users/ww/dev/projects/mdxpad-persist/specs/011-autosave-recovery/spec.md`
**Focus**: Integration & External Dependencies

---

## Summary

| Status | Count |
|--------|-------|
| Clear | 2 |
| Partial | 5 |
| Missing | 4 |

---

## Ambiguity Details

### 1. Recovery File Format Specification

- **Category**: Integration
- **Status**: Missing
- **Description**: The spec defines `RecoveryFile` as a key entity but does not specify the file format for autosaved content. Is it plain text, JSON, binary, or a custom format? What encoding is used? What metadata is stored alongside content?
- **Question Candidate**: What file format and encoding should recovery files use (e.g., JSON with UTF-8, binary blob, plain MDX text), and what metadata fields must be included in each recovery file?
- **Impact Score**: 4
- **Rationale**: Without a defined format, recovery files may be incompatible across versions, unreadable after format changes, or cause data corruption during recovery.

---

### 2. Recovery Manifest Schema/Format

- **Category**: Integration
- **Status**: Missing
- **Description**: The `RecoveryManifest` entity is mentioned as an "index of all recoverable documents" but its schema, format, and storage location are not defined.
- **Question Candidate**: What is the schema and file format for the RecoveryManifest (e.g., JSON schema with specific fields), and where is it stored relative to recovery files?
- **Impact Score**: 4
- **Rationale**: The manifest is critical for recovery discovery. An undefined format risks forward compatibility issues and makes it impossible to migrate recovery data between versions.

---

### 3. Recovery Data Storage Location

- **Category**: Integration
- **Status**: Partial
- **Description**: The spec mentions "Recovery files use a dedicated directory separate from user documents" (Assumptions) and "local storage paths" (Electron environment), but does not specify the exact path or how it's determined across platforms.
- **Question Candidate**: What is the specific recovery data directory path on each platform (Windows, macOS, Linux), and should it use Electron's `app.getPath('userData')` or another location?
- **Impact Score**: 3
- **Rationale**: Platform-specific paths affect cross-platform consistency, user data portability, and cleanup/uninstall behavior.

---

### 4. Document Store Integration Protocol

- **Category**: Integration
- **Status**: Partial
- **Description**: FR-012 requires integration with "document store for dirty state tracking," and Dependencies mention "Document Store (assumed existing from application architecture)." However, the integration protocol--events, method signatures, state synchronization mechanism--is not specified.
- **Question Candidate**: What is the API contract for document store integration: which events/methods are used to track dirty state, and how does autosave notify the document store of state changes?
- **Impact Score**: 4
- **Rationale**: Without a defined integration contract, the autosave system may conflict with document store state management, leading to inconsistent dirty indicators or lost saves.

---

### 5. File System Shell (004) Integration Points

- **Category**: Integration
- **Status**: Partial
- **Description**: Dependency on 004-file-system-shell is declared, but specific APIs or methods to be used for reading/writing recovery files are not enumerated.
- **Question Candidate**: Which specific APIs from Spec 004 (File System Shell) will be used for recovery file operations (e.g., `writeFile`, `readFile`, `watch`), and are there any required extensions?
- **Impact Score**: 3
- **Rationale**: Unclear integration points may lead to API misuse, missing error handling, or requiring changes to the file system shell spec.

---

### 6. External File Modification Conflict Handling

- **Category**: Integration
- **Status**: Partial
- **Description**: Edge case mentions "conflicts if the source file was modified externally between autosaves" but provides no resolution strategy.
- **Question Candidate**: When the source file is modified externally while recovery data exists, should the system: (a) prefer recovery data, (b) prefer external file, (c) prompt user to choose, or (d) attempt to merge?
- **Impact Score**: 4
- **Rationale**: This is a common real-world scenario with file sync services (Dropbox, iCloud) that could lead to data loss or user confusion without clear behavior.

---

### 7. Recovery Data Versioning

- **Category**: Integration
- **Status**: Missing
- **Description**: No versioning scheme is defined for recovery files or manifest. Future application updates may change the recovery format.
- **Question Candidate**: What versioning strategy should be used for recovery data to ensure forward compatibility, and how should the application handle recovery files from older or newer versions?
- **Impact Score**: 3
- **Rationale**: Without versioning, application updates could render existing recovery data unreadable, defeating the purpose of crash recovery during upgrade scenarios.

---

### 8. Autosave Settings Persistence Format

- **Category**: Integration
- **Status**: Partial
- **Description**: FR-011 requires settings to "persist across application restarts." The CLAUDE.md mentions `electron-store` for main process data, but the spec doesn't confirm this or define the settings schema.
- **Question Candidate**: Should autosave settings use `electron-store` for persistence (consistent with other specs), and what is the exact schema for `AutosaveSettings` including field names, types, and defaults?
- **Impact Score**: 2
- **Rationale**: Inconsistent persistence mechanisms across features increase maintenance burden and may cause settings migration issues.

---

### 9. IPC Protocol for Renderer-Main Communication

- **Category**: Integration
- **Status**: Missing
- **Description**: Autosave involves file system operations (main process) triggered by document state (renderer process). No IPC channel names, message formats, or security considerations are defined.
- **Question Candidate**: What IPC channels and message schemas should be used for autosave communication between renderer and main processes, and what validation/security measures are required?
- **Impact Score**: 4
- **Rationale**: Electron's security model requires explicit IPC design. Missing IPC contracts could lead to security vulnerabilities or integration failures.

---

### 10. Concurrent Autosave Operation Handling

- **Category**: Integration
- **Status**: Clear
- **Description**: FR-014 supports "recovery of multiple documents from a single crash event," and Acceptance Scenario for Story 1.2 addresses "autosave in progress when user continues typing." The multi-document concurrent behavior is adequately addressed.
- **Question Candidate**: N/A
- **Impact Score**: N/A

---

### 11. Application Lifecycle Integration

- **Category**: Integration
- **Status**: Clear
- **Description**: FR-003 clearly specifies "detect on startup whether recovery data exists." FR-008 specifies clearing recovery data after manual save. Lifecycle hooks are adequately defined at the requirement level.
- **Question Candidate**: N/A
- **Impact Score**: N/A

---

## Recommended Clarification Questions (Prioritized)

1. **[Impact: 4]** What is the API contract for document store integration: which events/methods are used to track dirty state, and how does autosave notify the document store of state changes?

2. **[Impact: 4]** What IPC channels and message schemas should be used for autosave communication between renderer and main processes, and what validation/security measures are required?

3. **[Impact: 4]** What file format and encoding should recovery files use (e.g., JSON with UTF-8, binary blob, plain MDX text), and what metadata fields must be included in each recovery file?

4. **[Impact: 4]** When the source file is modified externally while recovery data exists, should the system: (a) prefer recovery data, (b) prefer external file, (c) prompt user to choose, or (d) attempt to merge?

5. **[Impact: 4]** What is the schema and file format for the RecoveryManifest (e.g., JSON schema with specific fields), and where is it stored relative to recovery files?

6. **[Impact: 3]** What versioning strategy should be used for recovery data to ensure forward compatibility, and how should the application handle recovery files from older or newer versions?

7. **[Impact: 3]** What is the specific recovery data directory path on each platform (Windows, macOS, Linux), and should it use Electron's `app.getPath('userData')` or another location?

8. **[Impact: 3]** Which specific APIs from Spec 004 (File System Shell) will be used for recovery file operations (e.g., `writeFile`, `readFile`, `watch`), and are there any required extensions?
