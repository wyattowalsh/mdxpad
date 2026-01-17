# Inconsistency Analysis: Application Shell (006)

**Analyzed Files**:
- `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/spec.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/plan.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/tasks.md`

**Analysis Date**: 2026-01-10

---

## Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| I1 | MEDIUM | plan.md (line 80), tasks.md (T004, line 156-158) | **StatusBar directory structure mismatch**: Plan shows `StatusBar.tsx` at root of `shell/` and a nested `StatusBar/` subdirectory with child components. Tasks only reference `StatusBar/StatusBar.tsx` (nested). The plan structure implies two separate paths (`shell/StatusBar.tsx` AND `shell/StatusBar/FileInfo.tsx`), which is contradictory. | Clarify: use either flat (`StatusBar.tsx`) or nested (`StatusBar/StatusBar.tsx`) structure consistently. Tasks use nested; update plan to match. |
| I2 | LOW | spec.md (line 252), tasks.md (T001, line 84-85) | **Document entity property naming drift**: Spec defines `savedContent` as property name in Key Entities section. Tasks T001 acceptance criteria use same name but quickstart reference may differ. Also, spec uses `fileId` while tasks reference `DocumentId` type. | Verify `savedContent` and `DocumentId`/`fileId` naming is consistent in quickstart.md and contracts. |
| I3 | MEDIUM | plan.md (line 96), tasks.md (T003, line 130) | **File commands location mismatch**: Plan shows `src/renderer/commands/file-commands.ts` (CREATE), but tasks also reference `src/renderer/commands/index.ts` (MODIFY) for registration. The plan's project structure does not show `index.ts` exists or needs modification. | Update plan's project structure to explicitly list `src/renderer/commands/index.ts` as MODIFY. |
| I4 | LOW | spec.md (line 335-338), plan.md (line 9-15), tasks.md | **Component terminology drift**: Spec Dependencies section references "MDXEditor component", plan Summary references "MDXEditor", but tasks T005 uses "MDXEditor" while spec User Story 1 line 40 says "CodeMirror editor". These are technically the same but could cause confusion. | Standardize on "MDXEditor" (the wrapper) vs "CodeMirror" (the underlying library) throughout. |
| I5 | HIGH | tasks.md T007 (line 234), plan.md (line 96-97) | **Missing hook file in plan structure**: Tasks T007 creates `src/renderer/hooks/useErrorNavigation.ts`, but plan's project structure only lists `useDocumentLifecycle.ts` under `hooks/`. Missing file from plan. | Add `useErrorNavigation.ts` to plan's project structure under `hooks/`. |
| I6 | LOW | spec.md (line 346), tasks.md (various) | **Split ratio range inconsistency**: Spec Glossary defines split ratio as "0 to 1" without constraints. Tasks T002 (line 108) clamps to "0.1-0.9 range". This is actually correct behavior (allows minimum pane sizes) but the spec glossary could be more precise. | Update spec glossary to note the practical range is 0.1-0.9 due to minimum pane width constraints. |
| I7 | MEDIUM | spec.md FR-006 (line 184), tasks.md | **Titlebar requirement has no explicit task coverage**: FR-006 requires "titlebar/header area compatible with macOS traffic lights (hiddenInset style)". This is only partially addressed in T006 acceptance criteria ("macOS titlebar area with traffic lights support") but no explicit implementation guidance exists. | Verify existing Electron config handles this or add explicit acceptance criteria to T006 with implementation details. |
| I8 | LOW | spec.md (line 157), tasks.md (T003, T011) | **Toggle preview shortcut inconsistency**: Spec US7 acceptance scenario 6 defines `Cmd+\` for preview toggle. However, neither T003 (file commands) nor T011 (menu integration) explicitly lists this shortcut in acceptance criteria. | Add `view.togglePreview` command with `Cmd+\` shortcut to T003 or create separate task for view commands. |
| I9 | MEDIUM | tasks.md T010 (line 301-303), plan.md (line 16) | **External modification detection dependencies mismatch**: Tasks T010 depends on "T001, T009" but logically it could run in parallel with T009 since it only needs T001 (document store) and file system IPC. The dependency on T009 (window close) seems artificial. | Review if T010 truly depends on T009 or if they can be parallelized in Batch 3. |
| I10 | LOW | spec.md (line 254), tasks.md (T002, line 107-108) | **Layout entity vs store naming**: Spec Key Entities defines "Layout" entity with `splitRatio`. Tasks T002 references "ui-layout-store" with `splitRatio`. The entity name "Layout" vs store name "UILayout" is slightly inconsistent. | Minor: either rename entity to "UILayout" in spec or clarify that Layout entity is implemented as ui-layout-store. |
| I11 | HIGH | plan.md (lines 80-81), tasks.md (T006, line 210) | **PreviewPane.tsx conflicting locations**: Plan shows `PreviewPane.tsx` at `src/renderer/components/shell/PreviewPane.tsx` (line 79, comment: "existing, wire up"). However, plan also shows existing `PreviewFrame.tsx` at `src/renderer/components/preview/PreviewFrame.tsx` (line 87). Tasks T006 creates `src/renderer/components/shell/PreviewPane.tsx` as a NEW wrapper. The plan incorrectly labels shell/PreviewPane.tsx as "existing" when it should be CREATE. | Fix plan line 79: change comment from "(existing, wire up)" to "(CREATE) - Preview wrapper". This matches tasks T006. |
| I12 | MEDIUM | tasks.md T014 (line 405) | **Performance checklist path inconsistency with project conventions**: T014 creates `.specify/specs/006-application-shell/checklists/performance.md`, but the plan's documentation structure (lines 55-64) does not include a `checklists/` directory. | Either add `checklists/` to plan's documentation structure or change T014 output path to match existing patterns. |

---

## Summary by Severity

| Severity | Count | IDs |
|----------|-------|-----|
| HIGH | 2 | I5, I11 |
| MEDIUM | 5 | I1, I3, I7, I9, I12 |
| LOW | 5 | I2, I4, I6, I8, I10 |

---

## Critical Issues Requiring Resolution

### I5 (HIGH): Missing useErrorNavigation hook in plan
The plan's project structure is incomplete. Tasks will create a file not documented in the plan.

### I11 (HIGH): PreviewPane.tsx labeled as "existing" but actually new
This could cause implementers to look for a non-existent file. The plan incorrectly states the shell PreviewPane wrapper already exists.
