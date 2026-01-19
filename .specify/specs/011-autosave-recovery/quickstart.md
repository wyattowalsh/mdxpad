# Quickstart: Autosave & Crash Recovery

**Feature**: 011-autosave-recovery
**Date**: 2026-01-17

## Overview

This feature implements automatic document saving and crash recovery for mdxpad. When enabled, documents with unsaved changes are periodically saved to a recovery location. If the application crashes, users can restore their work on the next startup.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RENDERER PROCESS                             │
│                                                                      │
│  ┌─────────────┐    subscribes     ┌──────────────────┐             │
│  │ Document    │◄──────────────────│  AutosaveManager │             │
│  │ Store       │    (isDirty)      │  (useAutosave)   │             │
│  │ (Zustand)   │                   └────────┬─────────┘             │
│  └─────────────┘                            │                        │
│                                             │ IPC invoke             │
└─────────────────────────────────────────────┼────────────────────────┘
                                              │
                              ┌───────────────┴───────────────┐
                              │     mdxpad:autosave:trigger   │
                              └───────────────┬───────────────┘
                                              │
┌─────────────────────────────────────────────┼────────────────────────┐
│                         MAIN PROCESS        │                        │
│                                             ▼                        │
│  ┌──────────────────┐      ┌────────────────────────────┐           │
│  │  Recovery        │◄─────│  AutosaveService           │           │
│  │  Directory       │      │  - writeRecoveryFile()     │           │
│  │  (userData/)     │      │  - updateManifest()        │           │
│  │  ├── manifest    │      │  - cleanup()               │           │
│  │  └── {id}.json   │      └────────────────────────────┘           │
│  └──────────────────┘                                               │
│                                                                      │
│  ┌──────────────────┐      ┌────────────────────────────┐           │
│  │  electron-store  │◄─────│  AutosaveSettingsService   │           │
│  │  (settings)      │      └────────────────────────────┘           │
│  └──────────────────┘                                               │
└──────────────────────────────────────────────────────────────────────┘
```

## Key Files to Create

### Main Process

| File | Purpose |
|------|---------|
| `src/main/services/autosave-service.ts` | Core autosave logic, file I/O, manifest management |
| `src/main/services/recovery-service.ts` | Startup recovery check, restore, discard |
| `src/main/services/autosave-settings.ts` | Settings persistence via electron-store |
| `src/main/ipc/autosave-handlers.ts` | IPC handlers for all autosave channels |

### Renderer Process

| File | Purpose |
|------|---------|
| `src/renderer/hooks/use-autosave.ts` | Autosave orchestration hook |
| `src/renderer/stores/autosave-store.ts` | Autosave status state (Zustand) |
| `src/renderer/components/recovery-dialog.tsx` | Recovery dialog UI |
| `src/renderer/components/autosave-indicator.tsx` | Status indicator in toolbar |
| `src/renderer/components/conflict-dialog.tsx` | Conflict resolution UI (FR-016) |

### Shared

| File | Purpose |
|------|---------|
| `src/shared/contracts/autosave-schemas.ts` | Zod schemas (copy from contracts/) |
| `src/shared/types/autosave.ts` | Type exports |

## Implementation Phases

### Phase 1: Core Autosave (P1 - User Story 1)

1. **AutosaveService** in main process
   - Atomic write: temp file + rename
   - SHA-256 checksum on write
   - Update manifest atomically

2. **useAutosave hook** in renderer
   - Subscribe to document store isDirty
   - Debounce 2s after last edit
   - Trigger autosave via IPC

3. **Settings persistence**
   - electron-store for interval, enabled flag
   - Default: 30s interval, enabled

### Phase 2: Recovery Flow (P1 - User Story 2)

1. **Startup check**
   - Read manifest.json on app ready
   - If entries exist, emit recovery-available event

2. **RecoveryDialog component**
   - List all recoverable documents
   - Accept/Decline/Dismiss actions
   - Dismiss preserves data for next startup

3. **Restore logic**
   - Load recovery file content
   - Open document in editor
   - Delete recovery file after successful restore

### Phase 3: Preview & Selection (P2 - User Story 3)

1. **Content preview**
   - IPC channel for full content fetch
   - Render preview in dialog

2. **Selective recovery**
   - Checkbox per document
   - Restore only selected

3. **Conflict detection**
   - Compare disk mtime vs recovery timestamp
   - Show conflict dialog with diff view

### Phase 4: Settings UI (P3 - User Story 4)

1. **Settings panel integration**
   - Interval slider (5s - 10min)
   - Enable/disable toggle

2. **Immediate effect**
   - Update timer on settings change
   - No restart required

## Critical Path

```
T001: AutosaveService (main) ─┬─► T003: useAutosave hook ─► T004: Integration test
                              │
T002: IPC handlers ───────────┘

T005: RecoveryService ─► T006: RecoveryDialog ─► T007: E2E test (crash simulation)

T008: Conflict detection ─► T009: ConflictDialog

T010: Settings UI
```

## Testing Strategy

### Unit Tests

- `autosave-service.test.ts`: Atomic writes, checksum, manifest updates
- `recovery-service.test.ts`: Manifest parsing, restore logic
- `use-autosave.test.ts`: Debounce, IPC triggering

### Integration Tests

- All IPC channels (per Constitution VI.4)
- Settings persistence across restart
- Dirty state synchronization

### E2E Tests

- Edit → Wait → Verify autosave file exists
- Simulate crash → Restart → Recovery dialog → Restore
- Decline recovery → Verify data deleted
- Dismiss dialog → Verify data preserved

## Performance Considerations

### SC-002: No perceptible interruption

- Autosave runs async via IPC
- Main process writes in background
- No renderer thread blocking

### SC-003: Recovery dialog < 2 seconds

- Manifest read is O(1) file read
- No full content parsing until preview requested
- Use content preview (first 500 chars) for dialog

### Debounce Strategy

```typescript
// Wait for 2s of idle time after last edit
const DEBOUNCE_MS = 2000;

// If interval elapses during active editing, wait for idle
// This prevents saving mid-keystroke
```

## Error Handling

### Autosave Failures (FR-013)

```typescript
// Track consecutive failures
if (consecutiveFailures >= 3) {
  showToast('Autosave failed. Your changes may not be protected.');
  showFailureIndicator(true);
}
```

### Corrupted Recovery Files

- Verify checksum on read
- Mark as corrupted in dialog (don't hide)
- Allow attempted recovery with warning

## Migration Notes

- No migration needed (new feature)
- Existing `AutoSaveEntrySchema` in file-schemas.ts can be removed or updated
- Recovery directory is new: `{userData}/recovery/`
