# Research: Autosave & Crash Recovery

**Feature**: 011-autosave-recovery
**Date**: 2026-01-17
**Status**: Complete

## Existing Codebase Analysis

### Document Store Integration

The existing document store (`src/renderer/stores/document-store.ts`) provides:

- **DocumentId**: Branded type (UUID v4) for unique document identification
- **DocumentState**: Tracks `fileId`, `filePath`, `fileName`, `content`, `savedContent`, `isDirty`, `lastKnownMtime`
- **Dirty State**: Computed as `content !== savedContent` in `setContent` action
- **File Handle**: `DocumentFileHandle` with `fileId`, `filePath`, `mtime`

Key integration point: Autosave subscribes to `isDirty` changes and saves when dirty.

### IPC Patterns

From `src/shared/types/ipc.ts` and `src/shared/contracts/file-schemas.ts`:

- Channel naming: `mdxpad:<domain>:<action>` (per Constitution Article III.3)
- All payloads validated with zod on both ends
- Result types: Discriminated union on `ok` field with `FileError` variants
- Existing schemas: `AutoSaveEntrySchema`, `RecoverySelectionSchema` already defined

### File System Access

Dependency on Spec 004 (file-system-shell) provides:
- Atomic write patterns (temp file + rename)
- File watching via chokidar
- Access to Electron's userData directory via `app.getPath('userData')`

## Decisions from Clarification Session

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Atomic writes | Write to temp file, then rename | Prevents corruption during crash (FR-015) |
| Storage location | `app.getPath('userData')/recovery` | Standard Electron pattern, survives reinstall |
| External conflict | Show conflict warning with diff view | Let user choose version (FR-016) |
| Dialog dismiss | Preserve recovery data | Dismiss ≠ decline, prevents accidental data loss (FR-007) |
| Failure notification | Subtle indicator + toast after 3 failures | Balance between awareness and disruption (FR-013) |

## Data Model Decisions

### RecoveryFile Identity

Use existing `DocumentId` (UUID v4) as primary identifier. For untitled documents, a new UUID is generated when the document is first edited (before any save).

**Key insight**: The document store already uses `DocumentId` as `fileId`. Autosave uses the same ID, creating a natural 1:1 relationship between active document and recovery file.

### Recovery File Format

JSON envelope with content + metadata:
```typescript
interface RecoveryFile {
  version: 1;
  documentId: DocumentId;
  filePath: string | null;      // null for untitled
  fileName: string;
  content: string;
  savedAt: number;              // Unix timestamp ms
  checksum: string;             // SHA-256 of content for integrity
}
```

Rationale: JSON is human-readable, simple to validate, and supports metadata needed for recovery dialog.

### RecoveryManifest

Single JSON file at `{recovery-dir}/manifest.json`:
```typescript
interface RecoveryManifest {
  version: 1;
  entries: Record<DocumentId, ManifestEntry>;
}

interface ManifestEntry {
  documentId: DocumentId;
  filePath: string | null;
  fileName: string;
  savedAt: number;
  recoveryFilePath: string;  // Relative path within recovery dir
}
```

Updated atomically alongside each recovery file write.

### DirtyState Lifecycle

```
[clean] → edit → [dirty] → autosave → [dirty+recovered]
                         → manual save → [clean] (clears recovery)
[dirty+recovered] → close normally → [clean] (clears recovery)
[dirty+recovered] → crash → recovery available
```

Note: Autosave does NOT clear dirty state. Only manual save or close-without-crash clears dirty + recovery data.

## Performance Considerations

### Autosave Latency Budget

Per Constitution Article V:
- Keystroke latency: <16ms (p99)
- Autosave must NOT block UI thread

Implementation:
- Autosave runs asynchronously via IPC to main process
- Uses debounce to avoid saving during rapid edits
- Main process performs file I/O in background

### Debounce Strategy

- Wait for 2 seconds of idle time after last edit before autosaving
- If autosave interval elapses during active editing, wait until 2s idle
- This prevents excessive disk I/O during typing

### Large Document Handling

- No size limit enforced (MDX documents rarely exceed 1MB)
- If save takes longer than next interval, skip that interval (coalesce)
- Log warning if save consistently exceeds 500ms

## Storage Limits

- Maximum 50 recovery files (LRU eviction if exceeded)
- Maximum 100MB total recovery storage
- Recovery files older than 30 days auto-deleted on startup
- These defaults are reasonable for typical MDX editing

## Security Considerations

- Recovery files use restrictive permissions (600/owner-only)
- No encryption at rest for MVP (documented as future consideration)
- Recovery directory is user-specific (`userData`)

## Out of Scope

Per spec and constitution:
- Multi-window concurrent edit conflict resolution (single document focus)
- Cloud sync of recovery data (local-first MVP)
- Encryption at rest (future version)

## Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| 004-file-system-shell | File I/O, atomic writes | Implemented |
| Document Store | isDirty state, document metadata | Implemented |
| electron-store | Settings persistence | Available |

## Constitution Compliance

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| II | TypeScript 5.9.x strict | PASS | All types use strict mode |
| III.3 | IPC invoke/handle + zod | PASS | New recovery channels follow pattern |
| III.2 | contextIsolation: true | PASS | Inherits from existing config |
| V | Keystroke <16ms | PASS | Async autosave, no UI blocking |
| VII.3 | Auto-save every 30s if dirty | PASS | Default interval matches constitution |
| VI.1 | JSDoc + strict types | PASS | All public APIs documented |

## Open Questions (None)

All critical questions resolved during clarification session.
