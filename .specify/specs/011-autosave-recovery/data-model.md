# Data Model: Autosave & Crash Recovery

**Feature**: 011-autosave-recovery
**Date**: 2026-01-17

## Entity Relationship Diagram

```
┌─────────────────────┐         ┌─────────────────────┐
│   DocumentState     │         │   AutosaveSettings  │
│   (Zustand Store)   │         │   (electron-store)  │
├─────────────────────┤         ├─────────────────────┤
│ fileId: DocumentId  │────┐    │ enabled: boolean    │
│ filePath: string?   │    │    │ intervalMs: number  │
│ fileName: string    │    │    │ retentionDays: int  │
│ content: string     │    │    │ maxFiles: number    │
│ savedContent: string│    │    │ maxStorageMB: number│
│ isDirty: boolean    │    │    └─────────────────────┘
│ lastKnownMtime: ms  │    │
└─────────────────────┘    │
                           │
         ┌─────────────────┘
         │ 1:1 (when dirty)
         ▼
┌─────────────────────┐         ┌─────────────────────┐
│    RecoveryFile     │         │  RecoveryManifest   │
│  (JSON file on disk)│◄───────│   (manifest.json)   │
├─────────────────────┤  refs   ├─────────────────────┤
│ version: 1          │         │ version: 1          │
│ documentId: DocId   │         │ entries: Map<Id,    │
│ filePath: string?   │         │   ManifestEntry>    │
│ fileName: string    │         └─────────────────────┘
│ content: string     │
│ savedAt: timestamp  │
│ checksum: sha256    │
└─────────────────────┘
```

## Core Entities

### DocumentId (Existing)

Already defined in `src/shared/types/document.ts`.

```typescript
// Branded type for type-safe document identification
export type DocumentId = string & { readonly __brand: 'DocumentId' };
```

- Format: UUID v4
- Generated when document is first opened or created
- Persists across autosave operations
- Used as primary key for recovery file association

### AutosaveSettings

User-configurable autosave preferences. Persisted via electron-store.

| Field | Type | Default | Constraints |
|-------|------|---------|-------------|
| enabled | boolean | true | - |
| intervalMs | number | 30000 | min: 5000, max: 600000 |
| retentionDays | number | 30 | min: 1, max: 365 |
| maxFiles | number | 50 | min: 5, max: 200 |
| maxStorageMB | number | 100 | min: 10, max: 1000 |

```typescript
interface AutosaveSettings {
  /** Whether autosave is enabled */
  enabled: boolean;
  /** Autosave interval in milliseconds (5s - 10min) */
  intervalMs: number;
  /** Days to retain recovery files before cleanup */
  retentionDays: number;
  /** Maximum number of recovery files */
  maxFiles: number;
  /** Maximum total storage in megabytes */
  maxStorageMB: number;
}
```

### RecoveryFile

Individual recovery file stored on disk. One per document with unsaved changes.

| Field | Type | Description |
|-------|------|-------------|
| version | 1 | Schema version for future migration |
| documentId | DocumentId | Links to document state |
| filePath | string \| null | Original file path, null for untitled |
| fileName | string | Display name for recovery dialog |
| content | string | Full document content at save time |
| savedAt | number | Unix timestamp (ms) of autosave |
| checksum | string | SHA-256 of content for integrity |

```typescript
interface RecoveryFile {
  readonly version: 1;
  readonly documentId: DocumentId;
  readonly filePath: string | null;
  readonly fileName: string;
  readonly content: string;
  readonly savedAt: number;
  readonly checksum: string;
}
```

**Storage Location**: `{userData}/recovery/{documentId}.json`

**Integrity**: Checksum computed as `SHA-256(content)`. On read, verify checksum matches; if mismatch, mark as corrupted in recovery dialog.

### RecoveryManifest

Index of all recovery files. Enables fast enumeration without reading each file.

| Field | Type | Description |
|-------|------|-------------|
| version | 1 | Schema version |
| entries | Map<DocumentId, ManifestEntry> | Index of recovery files |

```typescript
interface RecoveryManifest {
  readonly version: 1;
  readonly entries: Record<DocumentId, ManifestEntry>;
}

interface ManifestEntry {
  readonly documentId: DocumentId;
  readonly filePath: string | null;
  readonly fileName: string;
  readonly savedAt: number;
  readonly recoveryFilePath: string;  // Relative: "{documentId}.json"
}
```

**Storage Location**: `{userData}/recovery/manifest.json`

**Update Strategy**: Atomic write (temp + rename) alongside each recovery file operation.

### AutosaveState (Runtime)

Ephemeral state for autosave orchestration. Not persisted.

```typescript
interface AutosaveState {
  /** Whether autosave timer is active */
  isRunning: boolean;
  /** Timestamp of last successful autosave */
  lastSaveTime: number | null;
  /** Count of consecutive failures (resets on success) */
  consecutiveFailures: number;
  /** Whether failure indicator is shown */
  showingFailureIndicator: boolean;
}
```

## State Transitions

### DirtyState Lifecycle

```
┌──────────┐     edit      ┌──────────┐
│  clean   │──────────────►│  dirty   │
│ (isDirty │               │ (isDirty │
│  false)  │               │   true)  │
└──────────┘               └────┬─────┘
     ▲                          │
     │                          │ autosave
     │                          ▼
     │                    ┌──────────────┐
     │  manual save       │dirty+recovery│
     │  OR close (normal) │ (isDirty true│
     └────────────────────┤  + recovery  │
                          │  file exists)│
                          └──────────────┘
```

Key behaviors:
1. **Autosave** creates recovery file but does NOT clear isDirty
2. **Manual save** clears isDirty AND deletes recovery file
3. **Normal close** (not crash) clears isDirty AND deletes recovery file
4. **Crash** leaves recovery file for next startup

### Recovery Flow

```
App Startup
    │
    ▼
Check manifest.json
    │
    ├─ No entries ──► Normal startup
    │
    └─ Has entries ──► Show Recovery Dialog
                           │
                           ├─ User accepts (some/all)
                           │      │
                           │      ▼
                           │  Restore selected documents
                           │  Delete restored recovery files
                           │      │
                           │      ▼
                           │  Normal startup with restored docs
                           │
                           ├─ User declines (explicit)
                           │      │
                           │      ▼
                           │  Delete ALL recovery files
                           │  Normal startup
                           │
                           └─ User dismisses (ESC/X)
                                  │
                                  ▼
                              Keep recovery files
                              Normal startup
                              (dialog shown again next time)
```

## File System Layout

```
{app.getPath('userData')}/
└── recovery/
    ├── manifest.json           # RecoveryManifest
    ├── {documentId-1}.json     # RecoveryFile
    ├── {documentId-2}.json     # RecoveryFile
    └── ...
```

Example paths (macOS):
```
~/Library/Application Support/mdxpad/recovery/manifest.json
~/Library/Application Support/mdxpad/recovery/550e8400-e29b-41d4-a716-446655440000.json
```

## Validation Schemas (Zod)

```typescript
import { z } from 'zod';

// Reuse existing DocumentId schema pattern
export const DocumentIdSchema = z.string().uuid().brand<'DocumentId'>();

export const AutosaveSettingsSchema = z.object({
  enabled: z.boolean(),
  intervalMs: z.number().min(5000).max(600000),
  retentionDays: z.number().int().min(1).max(365),
  maxFiles: z.number().int().min(5).max(200),
  maxStorageMB: z.number().min(10).max(1000),
});

export const RecoveryFileSchema = z.object({
  version: z.literal(1),
  documentId: DocumentIdSchema,
  filePath: z.string().nullable(),
  fileName: z.string().min(1),
  content: z.string(),
  savedAt: z.number(),
  checksum: z.string().length(64), // SHA-256 hex
});

export const ManifestEntrySchema = z.object({
  documentId: DocumentIdSchema,
  filePath: z.string().nullable(),
  fileName: z.string().min(1),
  savedAt: z.number(),
  recoveryFilePath: z.string(),
});

export const RecoveryManifestSchema = z.object({
  version: z.literal(1),
  entries: z.record(DocumentIdSchema, ManifestEntrySchema),
});
```

## Default Values

```typescript
export const DEFAULT_AUTOSAVE_SETTINGS: AutosaveSettings = {
  enabled: true,
  intervalMs: 30_000,      // 30 seconds (per Constitution VII.3)
  retentionDays: 30,
  maxFiles: 50,
  maxStorageMB: 100,
};

export const EMPTY_RECOVERY_MANIFEST: RecoveryManifest = {
  version: 1,
  entries: {},
};
```

## Invariants

1. **RecoveryFile.documentId** must match a valid `DocumentId` (UUID v4)
2. **RecoveryFile.checksum** must equal `SHA-256(content)` for file to be valid
3. **RecoveryManifest.entries[id].documentId** must equal the key `id`
4. **AutosaveSettings.intervalMs** must be in range [5000, 600000]
5. Recovery files are deleted when:
   - Document is manually saved
   - User explicitly declines recovery
   - Retention period expires
   - Storage limits exceeded (LRU eviction)
