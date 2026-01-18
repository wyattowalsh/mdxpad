# T005 Result: RecoveryService Implementation

**Task**: Implement RecoveryService in `src/main/services/recovery-service.ts`
**Status**: Complete
**Date**: 2026-01-18

## Summary

Implemented the RecoveryService class for managing crash recovery operations. The service provides all required functionality for startup recovery detection, document restoration, discard logic, and retention cleanup.

## Implementation Details

### Key Methods

| Method | Purpose | FR Reference |
|--------|---------|--------------|
| `checkForRecovery()` | Startup check - reads manifest, returns count | FR-003 |
| `listRecoverable()` | Returns `RecoveryDialogEntry[]` for dialog display | FR-004, FR-005 |
| `getPreview(documentId)` | Reads full content, checks for conflicts | FR-005, FR-016 |
| `restore(request)` | Handles accept/decline/dismiss decisions | FR-006, FR-007 |
| `discardRecovery(documentIds)` | Deletes specified recovery files | FR-007, FR-008 |
| `runRetentionCleanup()` | Enforces retention and file count limits | FR-021 |
| `validateChecksum(file)` | Verifies SHA-256 checksum integrity | FR-019 |

### Architecture

- **Storage Location**: `{userData}/recovery/` (same as AutosaveService)
- **Manifest**: `manifest.json` for O(1) recovery detection
- **Recovery Files**: `{documentId}.json` containing full document state
- **Atomic Writes**: Uses temp file + rename pattern for manifest updates

### Dependencies

```typescript
constructor(
  settingsService: AutosaveSettingsService,  // Required - for retention settings
  autosaveService?: AutosaveService           // Optional - delegates deletes
)
```

The service can operate independently for read operations (useful during startup before AutosaveService is fully initialized), but delegates deletion to AutosaveService when available to maintain consistency.

### Checksum Validation (FR-019)

```typescript
validateChecksum(file: RecoveryFile): boolean {
  const computed = createHash('sha256').update(file.content, 'utf-8').digest('hex');
  return computed === file.checksum;
}
```

- Called in `getPreview()` - returns `CORRUPTED` error on mismatch
- Called in `restore()` - skips corrupted files with warning
- Called in `createDialogEntry()` - marks invalid entries in dialog

### Retention Cleanup (FR-021)

Two-phase cleanup algorithm:
1. Delete files older than `settings.retentionDays` (default: 30 days)
2. If count > `settings.maxFiles` (default: 50), delete oldest files

### Conflict Detection

For files with a disk path, compares disk `mtime` to `recoveryTimestamp`. If disk was modified after recovery save, returns conflict info for UI display.

## Validation

TypeScript compilation passes with no errors in `recovery-service.ts`:

```bash
npx tsc --noEmit 2>&1 | grep "recovery-service.ts"
# (no output = no errors)
```

## Files Modified

- `/Users/ww/dev/projects/mdxpad-persist/src/main/services/recovery-service.ts` - Full rewrite

## Constitution Compliance

| Article | Requirement | Status |
|---------|-------------|--------|
| III.1 | Main process owns file I/O | PASS |
| VI.1 | JSDoc with @param, @returns | PASS |
| VI.2 | Functions max 50 lines | PASS |

## Next Steps

- T006: Implement IPC handlers to wire RecoveryService to IPC channels
- T011: Implement RecoveryDialog component to consume `listRecoverable()` output
