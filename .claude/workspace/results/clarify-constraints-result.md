# Constraints Category Ambiguity Analysis

**Spec**: `/Users/ww/dev/projects/mdxpad-persist/specs/011-autosave-recovery/spec.md`
**Feature**: Autosave & Crash Recovery
**Category**: Constraints & Tradeoffs
**Date**: 2026-01-17

---

## Summary

The spec has significant gaps in the Constraints category. While it defines autosave interval bounds and platform assumptions (Electron), it lacks explicit constraints on storage location, file format, atomic write strategy, retention policies, and performance budgets. No rejected alternatives or explicit tradeoffs are documented.

| Status | Count |
|--------|-------|
| Clear | 3 |
| Partial | 5 |
| Missing | 4 |

---

## Ambiguity Findings

### 1. Storage Location for Recovery Files

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | Where should recovery files be stored? Options include: (a) Electron's userData directory via `app.getPath('userData')`, (b) OS temp directory, (c) A `.mdxpad-recovery` folder alongside source files, (d) A user-configurable location? |
| **Impact Score** | 5 |
| **Rationale** | The spec mentions "recovery location" (FR-001) and "dedicated directory separate from user documents" (Assumptions) but does not specify WHERE this directory should be. Storage location affects cross-platform behavior, file cleanup on uninstall, user privacy, and portability of recovery data. |

---

### 2. Recovery File Format

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | What format should recovery files use? Options include: (a) Plain MDX content only with filename convention for metadata, (b) JSON envelope with content + metadata, (c) SQLite database for all recovery data, (d) Native file copy with separate sidecar metadata file? |
| **Impact Score** | 4 |
| **Rationale** | The spec defines `RecoveryFile` entity (Key Entities) with "document identifier, content snapshot, timestamp, and original file path reference" but does not specify serialization format. Format choice affects recovery reliability, corruption detection, file size, and parsing complexity. |

---

### 3. Atomic Write / Locking Strategy

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | What atomic write/locking strategy should be used to prevent corrupted recovery files? Options include: (a) Write to temp file then atomic rename, (b) Write-ahead logging, (c) File system advisory locks, (d) Accept potential corruption with checksum-based detection? |
| **Impact Score** | 4 |
| **Rationale** | Edge case asks "What happens if the application exits during an autosave write operation?" but no constraint on write strategy is provided. This is critical for preventing corrupted recovery files during crashes or power loss. FR-013 says "handle autosave failures gracefully" but doesn't specify prevention strategy. |

---

### 4. RecoveryManifest Persistence Strategy

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | How should the RecoveryManifest be persisted? Options include: (a) Single JSON manifest file updated atomically, (b) Individual metadata files per recovery file, (c) electron-store, (d) SQLite database? |
| **Impact Score** | 3 |
| **Rationale** | `RecoveryManifest` is defined as an entity ("Index of all recoverable documents from previous sessions") but there's no constraint on its persistence mechanism. Affects atomic write guarantees, corruption resilience, and recovery scanning performance. |

---

### 5. Recovery Data Retention/Cleanup Policy

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | What retention policy applies to recovery data? Options include: (a) Keep forever until manually cleared, (b) Auto-delete after N days (specify N), (c) Keep last N recovery points per document, (d) Storage quota with LRU eviction? |
| **Impact Score** | 3 |
| **Rationale** | `AutosaveSettings` entity mentions "retention settings" but no constraints on retention period, maximum storage size, or cleanup triggers are defined. FR-008 only covers clearing on successful manual save. |

---

### 6. Performance Budget for Autosave Operations

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | What is the maximum acceptable main thread blocking time during autosave? Options include: (a) <16ms (one frame at 60fps), (b) <50ms, (c) <100ms, (d) Must be fully async with zero main thread impact? |
| **Impact Score** | 3 |
| **Rationale** | SC-002 requires "no perceptible interruption to user typing (no visible lag or pause)" but provides no quantified latency budget. This affects implementation choice between sync/async writes, worker threads, chunked writes, etc. |

---

### 7. Large Document Handling Strategy

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | How should the system handle documents larger than can be saved within the autosave interval? Options include: (a) No limit, extend interval dynamically, (b) Skip interval if previous save incomplete (coalesce), (c) Stream/chunk large files, (d) Warn user and recommend longer interval? |
| **Impact Score** | 3 |
| **Rationale** | Edge case asks "How does the system handle very large documents that take longer to save than the autosave interval?" but no size limit or strategy is defined. Could cause overlapping save operations or performance issues. |

---

### 8. Encryption/Security Constraints

| Field | Value |
|-------|-------|
| **Status** | Missing |
| **Question Candidate** | Should recovery files be encrypted at rest? Options include: (a) No encryption (plain text, acceptable for MVP), (b) Encryption using OS keychain integration, (c) User-provided password option, (d) Defer to future spec? |
| **Impact Score** | 2 |
| **Rationale** | No mention of whether recovery files should be protected, especially if they contain sensitive user content. Likely acceptable to defer for MVP, but should be explicitly documented as out of scope if so. |

---

### 9. Rejected Alternatives / Explicit Tradeoffs

| Field | Value |
|-------|-------|
| **Status** | Partial |
| **Question Candidate** | What alternative approaches were considered and explicitly rejected? For example: (a) Cloud-based recovery sync, (b) Git-style versioning/history, (c) In-memory only recovery, (d) Integration with external backup tools, (e) Undo history as recovery mechanism? |
| **Impact Score** | 2 |
| **Rationale** | The spec implies some tradeoffs (e.g., "30 seconds balances protection with performance" in Assumptions) but does not explicitly document rejected alternatives. The spec has no "Out of Scope" or "Tradeoffs" section. Documenting rejected alternatives prevents scope creep and re-litigation. |

---

### 10. Autosave Interval Constraints

| Field | Value |
|-------|-------|
| **Status** | Clear |
| **Question Candidate** | N/A |
| **Impact Score** | N/A |
| **Rationale** | FR-009 clearly specifies "minimum 5 seconds, maximum 10 minutes" and Assumptions state "Default autosave interval of 30 seconds". This constraint is well-defined. |

---

### 11. Platform/Runtime Constraints

| Field | Value |
|-------|-------|
| **Status** | Clear |
| **Question Candidate** | N/A |
| **Impact Score** | N/A |
| **Rationale** | Assumptions clearly state "Electron environment with access to local storage paths" and dependency on "004-file-system-shell". Technology stack is inherited from codebase standards (TypeScript 5.9.x strict, Electron 39.x per CLAUDE.md). |

---

### 12. Language/Framework Constraints

| Field | Value |
|-------|-------|
| **Status** | Clear |
| **Question Candidate** | N/A |
| **Impact Score** | N/A |
| **Rationale** | Project-level constraints apply: TypeScript 5.9.x with `strict: true`, Electron 39.x, Zustand 5.x, zod 4.x per constitution and CLAUDE.md. Spec 004 dependency provides file system patterns. |

---

## Prioritized Question Candidates for Clarification

| Priority | Question | Impact |
|----------|----------|--------|
| 1 | Where should recovery files be stored? (userData, temp, alongside source, configurable?) | 5 |
| 2 | What format should recovery files use? (plain MDX, JSON envelope, SQLite, sidecar?) | 4 |
| 3 | What atomic write/locking strategy should be used? (temp+rename, WAL, locks, checksum?) | 4 |
| 4 | How should RecoveryManifest be persisted? (single JSON, per-file, electron-store, SQLite?) | 3 |
| 5 | What retention policy applies to recovery data? (forever, N days, N versions, quota?) | 3 |
| 6 | What is the maximum main thread blocking time during autosave? | 3 |
| 7 | How should large documents (save time > interval) be handled? | 3 |
| 8 | Should recovery files be encrypted? (or explicitly deferred?) | 2 |
| 9 | What alternatives were explicitly rejected? | 2 |

---

## Impact Summary

| Impact Score | Count | Description |
|--------------|-------|-------------|
| 5 (Critical) | 1 | Storage location |
| 4 (High) | 2 | File format, atomic writes |
| 3 (Medium) | 4 | Manifest persistence, retention, performance budget, large docs |
| 2 (Low) | 2 | Encryption, rejected alternatives |
| 1 (Minimal) | 0 | - |

**Total Ambiguities Analyzed**: 12
**Clear**: 3
**Requiring Clarification**: 9 (7 high-priority with impact >= 3)
