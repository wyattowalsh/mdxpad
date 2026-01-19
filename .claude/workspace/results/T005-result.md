<<<<<<< HEAD
# T005 Result: Create persistence utilities

**Status**: Complete
**Output File**: `/Users/ww/dev/projects/mdxpad-filter/src/renderer/lib/fuzzy-match/persistence.ts`

## Summary

Created the filter persistence utilities module that provides localStorage-based persistence for file tree filter queries. Each project gets its own isolated filter state via hashed storage keys using the FNV-1a algorithm.

## Implemented Components

### Constants
- `FILTER_STORAGE_KEY_PREFIX` = `'mdxpad:filter:query:'` - Namespace prefix for localStorage keys

### Functions

1. **`simpleHash(str: string): string`**
   - FNV-1a hash implementation for consistent key generation
   - FNV offset basis: `2166136261`
   - FNV prime: `16777619`
   - Uses unsigned 32-bit math with `>>> 0`
   - Returns 8-character hex string (padded with leading zeros)

2. **`getFilterStorageKey(projectPath: string): string`**
   - Generates localStorage key by combining prefix with hashed project path
   - Format: `'mdxpad:filter:query:<8-char-hash>'`

3. **`loadPersistedFilterQuery(projectPath: string): string`**
   - Loads previously saved filter query from localStorage
   - Returns empty string if not found or on error
   - Silent fail with `console.warn` on error

4. **`saveFilterQuery(projectPath: string, query: string): void`**
   - Persists filter query to localStorage
   - Removes key if query is empty (after trim)
   - Silent fail with `console.warn` on error

## Verification

- TypeScript compiles without errors
- Follows codebase patterns from `ui-layout-store.ts` for localStorage access
- Matches specification in `data-model.md` (Section 5: Persistence Model)
- Consistent with `filter-schemas.ts` contract definitions

## Code Quality

- Full JSDoc documentation on all exports
- Clear code organization with section headers
- TypeScript strict mode compatible
- Examples provided in JSDoc comments
||||||| 908aacf
=======
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
>>>>>>> 011-autosave-recovery
