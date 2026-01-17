# Edge Cases Ambiguity Analysis

**Spec**: 006-application-shell
**Category**: Edge Cases & Failure Handling
**Analyzed**: 2026-01-10

---

## Summary

The spec covers 7 explicit edge cases (lines 149-157) but has significant gaps in negative scenarios, rate limiting/throttling, and conflict resolution. Several edge cases are mentioned but lack concrete implementation details.

---

## Ambiguity Findings

### 1. External File Deletion Detection

**Status**: Partial

**Spec Statement** (line 151):
> "What happens when the file being edited is deleted or moved externally? → Show a warning and mark document as 'orphaned' with option to save elsewhere"

**Question Candidate**:
- How should the system detect that a file was deleted or moved externally? Polling interval? File watcher? On next save attempt only?
- What UI treatment defines "orphaned" state (visual indicator, status bar change, dialog)?
- Should the detection be active (continuous monitoring) or passive (discovered on save)?
- If moved (not deleted), should the system attempt to locate the new path?

**Impact Score**: 4

**Rationale**: File integrity is critical for user trust. Without clear detection mechanism, users may not know their file was moved until save fails, potentially causing confusion about where their work went.

---

### 2. External File Modification Conflict

**Status**: Partial

**Spec Statement** (line 152):
> "What happens when the file is modified externally while open? → Detect change and prompt user to reload or keep current version"

**Question Candidate**:
- How should external modifications be detected? File system watching, polling, or on-focus check?
- What if both local and external changes exist (true conflict)? Can user merge or only choose one version?
- Should the user see a diff of changes before deciding?
- What is the polling/detection interval if using active monitoring?
- If user chooses to keep current version, should we warn them that saving will overwrite external changes?

**Impact Score**: 5

**Rationale**: This is classic concurrent edit conflict resolution. Without clear handling, users risk losing external changes (e.g., from another tool editing the same file) or their own changes if they accidentally reload.

---

### 3. Disk Full During Save

**Status**: Partial

**Spec Statement** (line 153):
> "What happens when disk is full during save? → Show clear error message with the specific problem and do not lose editor content"

**Question Candidate**:
- What specific error message format/UI should be used?
- Should the system suggest solutions (e.g., "free up space", "save to different location")?
- Is partial write cleanup needed if write fails mid-stream?
- Should the user be prompted to save elsewhere immediately?
- What other I/O errors need similar handling (permission denied, path too long, network drive disconnected)?

**Impact Score**: 4

**Rationale**: Clear error handling prevents user panic but the spec doesn't enumerate other common I/O failure scenarios beyond disk full.

---

### 4. Preview Compilation Hang/Timeout

**Status**: Partial

**Spec Statement** (line 155):
> "What happens when preview compilation hangs or takes too long? → Show loading state, allow user to continue editing, timeout after reasonable period"

**Question Candidate**:
- What is the "reasonable period" timeout value? (1s? 5s? 10s?)
- After timeout, what error message is shown to the user?
- Is compilation cancelled or allowed to complete in background?
- If user makes additional edits during compilation, is current compilation cancelled or allowed to finish?
- What visual indicator shows the "loading state"?
- Should there be a manual "retry compilation" action?

**Impact Score**: 3

**Rationale**: Undefined timeout could lead to either frustrating waits or premature timeouts. Users need to understand why preview isn't updating.

---

### 5. Rapid File Operations (Rate Limiting)

**Status**: Partial

**Spec Statement** (line 157):
> "What happens when user rapidly opens multiple files? → Queue operations, show last opened file, maintain data integrity"

**Question Candidate**:
- What is "rapid"? What debounce/throttle interval?
- If dirty check dialogs are involved, how are they queued (one at a time? combined?)?
- Does the queue have a maximum size? What happens if exceeded?
- Is there visual feedback that operations are queued?
- What about rapid save operations (user pressing Cmd+S repeatedly)?
- What about rapid new document operations?

**Impact Score**: 3

**Rationale**: Without clear throttling strategy, rapid operations could create race conditions or confusing dialog stacking.

---

### 6. Window Minimum Size Behavior

**Status**: Partial

**Spec Statement** (line 156):
> "What happens when window is resized very small? → Enforce minimum window size, gracefully collapse panels below certain thresholds"

**Question Candidate**:
- What are the specific minimum dimensions (width x height)?
- What does "gracefully collapse" mean for each panel (preview hidden first? status bar hidden?)?
- At what threshold does each collapse occur?
- Can user manually toggle collapsed state vs automatic collapse?
- Should collapsed state persist or restore when window grows?

**Impact Score**: 2

**Rationale**: Important for UX polish but unlikely to cause data loss. Affects edge-case user scenarios with small displays.

---

### 7. Save Dialog Cancellation

**Status**: Missing

**Spec Statement**: Not explicitly covered in edge cases

**Question Candidate**:
- If user cancels the save dialog on an untitled document during close, what happens? (Return to editing? Close without save?)
- If user cancels save-as dialog, should dirty state remain?
- Repeated cancel on dirty close should not trap user in loop - is there a "force close without save" option?

**Impact Score**: 4

**Rationale**: Dialog cancellation is a common edge case in document lifecycle that could trap users or cause unexpected behavior.

---

### 8. IPC/Main Process Communication Failure

**Status**: Missing

**Spec Statement**: Not covered

**Question Candidate**:
- What happens if IPC communication between renderer and main process fails during file operation?
- Should there be retry logic? How many retries?
- What error message is shown to the user?
- Is there graceful degradation (e.g., can still edit, just can't save)?

**Impact Score**: 4

**Rationale**: Electron IPC is assumed reliable but failures can occur. Without handling, users could lose work or face cryptic errors.

---

### 9. Settings/Preferences Corruption

**Status**: Missing

**Spec Statement**: Not covered (electron-store persistence mentioned in FR-033 through FR-036 but no failure handling)

**Question Candidate**:
- What happens if the electron-store JSON file is corrupted or invalid?
- Should settings reset to defaults on corruption?
- Should user be notified of settings reset?
- Is there settings backup/versioning?

**Impact Score**: 2

**Rationale**: Settings corruption is rare but can cause confusing UX if not handled gracefully. Lower impact since data loss is settings, not document content.

---

### 10. Memory Pressure / Large Documents

**Status**: Missing

**Spec Statement**: Not covered

**Question Candidate**:
- Is there a maximum document size limit?
- What happens when editing very large MDX files that stress memory?
- Should there be lazy loading or chunking for large documents?
- What feedback is given if document is too large to handle?

**Impact Score**: 3

**Rationale**: Large document handling affects reliability. Without limits, app could crash on extremely large files.

---

### 11. File Path Length / Invalid Characters

**Status**: Missing

**Spec Statement**: Not covered

**Question Candidate**:
- What happens if user attempts to save to a path that exceeds OS limits?
- What happens with filenames containing special characters?
- Are there any filename validations before save dialog?

**Impact Score**: 2

**Rationale**: Edge case that's rare but could cause cryptic errors on Windows especially.

---

### 12. Concurrent Access from Same User

**Status**: Missing

**Spec Statement**: Not covered (spec assumes single document model per instance)

**Question Candidate**:
- What if user opens same file in two mdxpad windows?
- Is there file locking or just external modification detection?
- Should there be a warning when opening an already-open file?

**Impact Score**: 3

**Rationale**: Users may accidentally open same file twice, leading to save conflicts between their own instances.

---

## Impact Summary

| Score | Count | Topics |
|-------|-------|--------|
| 5 (Critical) | 1 | External modification conflict resolution |
| 4 (High) | 4 | File deletion, disk errors, save dialog cancel, IPC failure |
| 3 (Medium) | 4 | Preview timeout, rapid operations, memory pressure, concurrent access |
| 2 (Low) | 3 | Window sizing, settings corruption, path validation |

---

## Recommendations

1. **Priority Clarification Needed**: External modification conflict resolution (Impact 5) should be clarified before implementation - this affects core data integrity.

2. **Group Related Questions**: File system failures (deletion, modification, disk full, permissions) could be addressed with a unified error handling strategy.

3. **Define Concrete Values**: Timeouts, intervals, and thresholds need specific values (e.g., "compile timeout: 5 seconds", "minimum window: 600x400px").

4. **Consider Adding to Requirements**: Missing edge cases (IPC failure, settings corruption, concurrent access) should be documented even if handling is simple.
