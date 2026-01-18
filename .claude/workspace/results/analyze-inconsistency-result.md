# Inconsistency Analysis: Autosave & Crash Recovery

**Feature**: 011-autosave-recovery
**Date**: 2026-01-17
**Analyzer**: Claude Code

## Summary

After thorough cross-referencing of all artifacts, **3 inconsistencies** were detected.

## Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| I1 | MEDIUM | data-model.md (lines 238-273) vs contracts/autosave-schemas.ts (lines 122-127) | **RecoveryManifest entries key type mismatch**: data-model.md defines `entries: z.record(DocumentIdSchema, ManifestEntrySchema)` using `DocumentIdSchema` as the key type, but contracts/autosave-schemas.ts uses `entries: z.record(z.string(), ManifestEntrySchema)` with plain `z.string()` as the key type. This loses the branded DocumentId type safety on manifest keys. | Update contracts/autosave-schemas.ts line 126 to use `z.record(z.string().uuid(), ManifestEntrySchema)` or document that zod's `z.record()` cannot validate branded key types and plain string is intentional. |
| I2 | LOW | data-model.md (line 84) vs contracts/autosave-schemas.ts (line 85) | **savedAt field type constraint mismatch**: data-model.md specifies `savedAt: z.number()` without constraints, while contracts/autosave-schemas.ts specifies `savedAt: z.number().int().positive()` with `.int().positive()` constraints. The contracts version is stricter. Similar difference exists for ManifestEntry.savedAt (data-model line 268 vs contract line 109). | Synchronize data-model.md to match the stricter contracts definition with `.int().positive()` since timestamps should indeed be positive integers. |
| I3 | LOW | spec.md (line 108) vs data-model.md (line 143-154) vs tasks.md (line 13) | **Terminology drift - AutosaveState vs AutosaveStatus**: spec.md defines key entity "DirtyState" (line 108), data-model.md defines "AutosaveState" (line 143), contracts/autosave-schemas.ts defines "AutosaveStatus" (line 250), and tasks.md references both "AutosaveStatus" (line 13) and "AutosaveState" (line 13). While these serve different purposes (DirtyState=document dirty tracking, AutosaveState=runtime orchestration, AutosaveStatus=UI indicator), the naming overlap between AutosaveState and AutosaveStatus could cause confusion during implementation. | Clarify in data-model.md that AutosaveState is the internal runtime orchestration state while AutosaveStatus is the externalized UI-facing state. Consider renaming AutosaveState to AutosaveRuntimeState for clarity. |

## Verification Notes

### Items Verified as Consistent

1. **IPC Channel Naming**: All channels in autosave-ipc.ts follow the `mdxpad:<domain>:<action>` pattern per Constitution III.3
2. **Entity Field Alignment**: RecoveryFile, ManifestEntry, and AutosaveSettings fields are consistent between data-model.md and contracts/autosave-schemas.ts
3. **Task Ordering**: Task dependencies in tasks.md correctly reflect that foundational services (T003-T007) must complete before user story implementation
4. **Default Values**: DEFAULT_AUTOSAVE_SETTINGS is identical in both data-model.md (lines 279-286) and contracts/autosave-schemas.ts (lines 55-61)
5. **Functional Requirements**: All FR references in contracts match spec.md definitions
6. **User Story Coverage**: All 4 user stories from spec.md are represented in tasks.md phases 3-6
7. **Recovery Location**: Consistently specified as `{userData}/recovery/` across all documents
