# T002: Copy autosave-ipc.ts to src/shared/contracts/

## Status
✓ COMPLETED

## Task Summary
Copied autosave-ipc.ts from the specification directory to the source contracts directory.

## Details

### Source File
- Location: `/Users/ww/dev/projects/mdxpad-persist/specs/011-autosave-recovery/contracts/autosave-ipc.ts`
- Size: 350 lines
- Type: TypeScript contract definitions

### Destination File
- Location: `/Users/ww/dev/projects/mdxpad-persist/src/shared/contracts/autosave-ipc.ts`
- Status: Successfully created and verified

## File Contents
The autosave-ipc.ts file contains type-safe IPC contracts for the autosave and crash recovery system, including:

1. **IPC Channel Definitions** - 9 channels following the convention `mdxpad:<domain>:<action>`
   - Recovery operations: check, list, restore, discard, preview
   - Autosave operations: trigger, status
   - Settings: get, set
   - Conflict resolution: resolve

2. **Request/Response Schemas** - Zod schemas for all IPC operations
   - RecoveryCheck, RecoveryList, RecoveryPreview
   - RecoveryRestore, RecoveryDiscard
   - AutosaveTrigger, AutosaveStatus
   - SettingsGet/Set
   - ConflictResolve

3. **Type Exports** - Full TypeScript type inference from schemas
   - Example types: RecoveryCheckResponse, RecoveryListResponse, AutosaveTriggerRequest, etc.

4. **Schema Registry** - Centralized AUTOSAVE_IPC_SCHEMAS object mapping all channels to their request/response schemas

## Key Features
- Full TypeScript strict mode compatibility
- Discriminated union types for success/error responses
- Atomic write pattern support (FR-015)
- Per-spec Constitution Article III.3 compliance
- Dependencies: zod, autosave-schemas

## Verification
- File written successfully
- Content verified by reading back
- All 350 lines match source file exactly
- File is properly formatted and imports are correct
- diff command confirms: Files are identical
