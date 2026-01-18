# Non-Functional Requirements Ambiguity Analysis

**Spec**: `specs/011-autosave-recovery/spec.md`
**Category**: Non-Functional Quality Attributes
**Analyzed**: 2026-01-17

---

## Summary

| Quality Attribute | Status | Issues Found |
|-------------------|--------|--------------|
| Performance | Partial | 3 issues |
| Scalability | Missing | 1 issue |
| Reliability & Availability | Partial | 3 issues |
| Observability | Missing | 2 issues |
| Security & Privacy | Partial | 2 issues |
| Compliance / Regulatory | Partial | 1 issue |

**Total Ambiguities Identified**: 12

**Note**: The spec includes Success Criteria with some measurable targets (SC-001 through SC-006) but lacks a dedicated Non-Functional Requirements section. Critical NFR categories like observability and security are not addressed.

---

## Detailed Analysis

### 1. Performance (Latency, Throughput Targets)

#### 1.1 Autosave Latency Threshold Undefined
- **Category**: Non-Functional
- **Status**: Partial
- **Location**: SC-002 (line 114)
- **Issue**: SC-002 states "Autosave operations complete without perceptible interruption to user typing (no visible lag or pause)" but "perceptible" is subjective and not quantified.
- **Question Candidate**: What is the maximum acceptable latency in milliseconds for an autosave operation (e.g., main thread block <50ms)? Should autosave be performed asynchronously in a background process?
- **Impact Score**: 4

#### 1.2 Large Document Handling Unspecified
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: Edge Cases (line 81)
- **Issue**: Edge case asks "How does the system handle very large documents that take longer to save than the autosave interval?" but no requirement addresses this. No document size limits or handling strategy defined.
- **Question Candidate**: What is the maximum document size the autosave system must support without performance degradation? Should there be a document size threshold that triggers chunked, incremental, or diff-based saving?
- **Impact Score**: 4

#### 1.3 Concurrent Document Throughput Not Defined
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: FR-014 (line 100)
- **Issue**: FR-014 mentions "multiple documents from a single crash event" but no throughput or concurrency requirements are specified for simultaneous autosave operations.
- **Question Candidate**: How many concurrent documents should the autosave system support simultaneously without performance degradation? Should autosaves be serialized, parallelized, or prioritized?
- **Impact Score**: 3

---

### 2. Scalability (Limits, Storage)

#### 2.1 Recovery Storage Limits Undefined
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: Assumptions (line 126)
- **Issue**: Assumptions mention "Recovery files use a dedicated directory separate from user documents" but no limits on number of recovery files, total disk space, or retention period are defined. The AutosaveSettings entity (line 105) mentions "retention settings" but provides no specifics.
- **Question Candidate**: What is the maximum number of recovery files to retain? What is the maximum total disk space the recovery system may consume? What is the retention policy for old recovery files (e.g., delete after 7 days, keep last 10 sessions)?
- **Impact Score**: 4

---

### 3. Reliability & Availability (Recovery Guarantees)

#### 3.1 Atomic Write Guarantee Missing
- **Category**: Non-Functional
- **Status**: Partial
- **Location**: Edge Cases (line 78)
- **Issue**: Edge case asks "What happens if the application exits during an autosave write operation?" but no requirement addresses atomic writes or crash-safe persistence. A partial write could corrupt the recovery file.
- **Question Candidate**: Should autosave writes be atomic (write to temp file then rename) to guarantee crash-safe persistence? What guarantees exist that a crash during write won't corrupt the recovery file?
- **Impact Score**: 5

#### 3.2 Recovery Data Validation Missing
- **Category**: Non-Functional
- **Status**: Partial
- **Location**: Edge Cases (line 80)
- **Issue**: Edge case mentions "What happens when recovery data is corrupted or incomplete?" but no integrity validation requirements exist. FR-013 mentions "handle autosave failures gracefully" but doesn't address data integrity.
- **Question Candidate**: Should recovery files include checksums or integrity markers? How should the system detect and handle corrupted recovery data (e.g., show warning, skip file, attempt partial recovery)?
- **Impact Score**: 4

#### 3.3 Recovery Success Rate Well-Defined
- **Category**: Non-Functional
- **Status**: Clear
- **Location**: SC-001 (line 113)
- **Issue**: N/A - SC-001 states "Users can recover at least 95% of their work after an unexpected application exit"
- **Question Candidate**: N/A
- **Impact Score**: N/A

#### 3.4 External File Conflict Handling Unspecified
- **Category**: Non-Functional
- **Status**: Partial
- **Location**: Edge Cases (line 79)
- **Issue**: Edge case asks "How are conflicts handled if the source file was modified externally between autosaves?" but no requirement addresses conflict detection or resolution strategy.
- **Question Candidate**: When recovering a document, how should the system detect and handle conflicts if the original file was modified externally (e.g., show diff, offer merge options, warn user)?
- **Impact Score**: 3

---

### 4. Observability (Logging, Metrics)

#### 4.1 No Logging Requirements
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: No logging requirements exist for autosave operations. Debugging autosave failures, recovery issues, or performance problems would be difficult without logs.
- **Question Candidate**: What autosave events should be logged (start, success, failure, recovery attempts, file conflicts)? What log level and format should be used? Should there be user-visible status indicators for autosave operations (e.g., "Last autosaved 30 seconds ago")?
- **Impact Score**: 3

#### 4.2 No Metrics or Telemetry
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: N/A (not addressed)
- **Issue**: No metrics requirements exist. SC-001 targets 95% recovery rate but no mechanism to measure real-world success is specified.
- **Question Candidate**: Should autosave emit metrics (save duration, file sizes, success/failure rates)? Should there be telemetry to measure real-world recovery success rates against SC-001?
- **Impact Score**: 2

---

### 5. Security & Privacy (Data Protection)

#### 5.1 Recovery File Protection Unspecified
- **Category**: Non-Functional
- **Status**: Partial
- **Location**: Assumptions (line 126)
- **Issue**: Assumptions mention "dedicated directory separate from user documents" but no security requirements exist for recovery files. Recovery files contain full document content which may be sensitive.
- **Question Candidate**: What file permissions should recovery files have (e.g., 600/owner-only)? Should recovery files be encrypted at rest for sensitive documents? How are recovery files protected from unauthorized access on shared systems?
- **Impact Score**: 3

#### 5.2 Secure Deletion Not Addressed
- **Category**: Non-Functional
- **Status**: Missing
- **Location**: FR-007 (line 93)
- **Issue**: FR-007 states "discard recovery data when user explicitly declines recovery" but doesn't specify secure deletion. Simple file deletion may leave recoverable data on disk.
- **Question Candidate**: Should declined or obsolete recovery files be securely deleted (overwritten) rather than simply unlinked? Is there a risk of residual sensitive data persisting on disk?
- **Impact Score**: 2

---

### 6. Compliance / Regulatory Constraints

#### 6.1 Data Retention Compliance Unclear
- **Category**: Non-Functional
- **Status**: Partial
- **Location**: AutosaveSettings entity (line 105)
- **Issue**: AutosaveSettings mentions "retention settings" but no specifics provided. No consideration of data retention compliance (GDPR, organizational policies) for storing document copies.
- **Question Candidate**: What is the maximum retention period for recovery files? Should users be informed that document copies are stored? Are there compliance considerations (GDPR right to deletion, etc.) for recovery file storage?
- **Impact Score**: 2

---

## Prioritized Question Candidates

Sorted by impact score (highest first):

| # | Impact | Quality Attribute | Question |
|---|--------|-------------------|----------|
| 1 | 5 | Reliability | Should autosave writes be atomic (write-then-rename) to prevent corruption during crashes? |
| 2 | 4 | Performance | What is the maximum acceptable latency in milliseconds for autosave operations? Should autosave run in a background thread/process? |
| 3 | 4 | Performance | What is the maximum document size autosave must support? Should large documents use incremental/chunked/diff-based saving? |
| 4 | 4 | Scalability | What are the maximum number of recovery files and total disk space allowed? What is the retention policy? |
| 5 | 4 | Reliability | Should recovery files include checksums? How is corrupted data detected and handled? |
| 6 | 3 | Performance | How many concurrent documents should autosave support? Should saves be serialized or parallelized? |
| 7 | 3 | Reliability | How should conflicts with externally-modified source files be detected and handled during recovery? |
| 8 | 3 | Observability | What autosave events should be logged? Should there be user-visible autosave status indicators? |
| 9 | 3 | Security | What file permissions should recovery files have? Should they be encrypted at rest? |
| 10 | 2 | Observability | Should autosave emit performance and success metrics for monitoring? |
| 11 | 2 | Security | Should recovery files be securely deleted when discarded? |
| 12 | 2 | Compliance | What is the maximum retention period? Any GDPR or compliance considerations? |

---

## Recommendations

### Critical (Impact 5)
1. **Atomic Writes**: Define a requirement for atomic/crash-safe writes (write to temp file, then rename). This is fundamental to the core value proposition - without atomic writes, crashes during autosave could corrupt the recovery file, resulting in worse outcomes than no autosave at all.

### High Priority (Impact 4)
2. **Autosave Latency**: Specify maximum main thread blocking time (e.g., <50ms) and require asynchronous saving for larger documents.

3. **Document Size Strategy**: Define maximum supported document size and specify handling for large documents (chunked saving, incremental diffs, or clear performance degradation expectations).

4. **Storage Limits**: Specify retention policy (e.g., "Keep recovery files for 7 days or until manual save, maximum 500MB total, oldest files purged first").

5. **Data Integrity**: Require checksums or magic bytes for recovery files and define behavior for corrupted data detection.

### Medium Priority (Impact 3)
6. **Concurrency Model**: Specify whether autosaves are serialized (simpler, prevents I/O contention) or parallelized (faster for multiple documents).

7. **Conflict Detection**: Define strategy for detecting and presenting conflicts when source file changed externally.

8. **Observability**: Add logging requirements for autosave events and consider user-visible "last saved" indicator.

9. **File Security**: Specify restrictive file permissions (600) for recovery files.

### Low Priority (Impact 2)
10. **Metrics**: Consider adding telemetry hooks for measuring real-world recovery success rates.

11. **Secure Deletion**: Document whether secure deletion is required (typically overkill for desktop apps).

12. **Compliance**: Document retention expectations and user notification if required by target markets.

---

## Clear Requirements (No Issues)

| Requirement | Location | Status |
|-------------|----------|--------|
| Recovery success rate target (95%) | SC-001 | Clear |
| Recovery dialog timing (2 seconds) | SC-003 | Clear |
| User recovery workflow timing (30 seconds) | SC-004 | Clear |
| Autosave interval range (5s - 10min) | FR-009 | Clear |
| Settings persistence requirement | FR-011 | Clear |

---

## Notes

- The spec has a strong user-focused structure with clear acceptance scenarios
- Success Criteria provide some quantitative targets but key NFR categories are absent
- Edge cases section (lines 74-81) identifies important reliability questions but they aren't resolved as requirements
- The "graceful failure handling" requirement (FR-013) is too vague to be actionable
- Security is particularly important for autosave since recovery files contain full document content that persists on disk
