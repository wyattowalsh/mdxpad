# Requirements Quality Checklist: Interface Contracts

**Purpose**: Validate completeness, clarity, consistency, and measurability of Spec 001 requirements
**Created**: 2025-12-30
**Focus Areas**: Type Contract Quality, Cross-Lane Integration Readiness, Constitution Compliance
**Depth**: Author Self-Review + Peer Review Gate + Release Gate
**Scope**: Full (no exclusions)

---

## Requirement Completeness

- [ ] CHK001 - Are all six type domain files (editor, file, preview, ipc, ui, index) explicitly listed with their exact paths? [Completeness, Spec §R1-R6]
- [ ] CHK002 - Are all four utility library files (result, events, utils, index) explicitly specified? [Completeness, Spec §R7-R10]
- [ ] CHK003 - Are ALL dependencies from Technology Stack Additions enumerated with version constraints? [Completeness, Spec §R11]
- [ ] CHK004 - Is the complete list of shadcn/ui components to install explicitly specified? [Completeness, Spec §R13]
- [ ] CHK005 - Are all five path aliases (@shared, @main, @preload, @renderer, @ui) documented? [Completeness, Spec §R15]
- [ ] CHK006 - Are CSS variable requirements specified for both light AND dark themes? [Completeness, Spec §R14]
- [ ] CHK007 - Is the `createFileId()` function signature fully specified including return type? [Completeness, Spec §R2]
- [ ] CHK008 - Are ALL IPC channel names explicitly listed (not just examples)? [Completeness, Spec §R4]
- [ ] CHK009 - Are ALL Result monad utility functions (ok, err, map, mapErr, flatMap, unwrapOr, unwrap) specified with signatures? [Completeness, Spec §R7]
- [ ] CHK010 - Are ALL TypedEventEmitter methods (on, once, emit, off) specified with signatures? [Completeness, Spec §R8]

---

## Requirement Clarity

- [ ] CHK011 - Is the branded type pattern for FileId explicitly defined with `__brand` syntax? [Clarity, Spec §R2]
- [ ] CHK012 - Are the discriminated union patterns (ok: true/false) consistently specified across Result, FileResult, CompileResult? [Clarity, Spec §R2, R3, R7]
- [ ] CHK013 - Is "READ-ONLY for parallel lanes" defined with explicit modification prohibition? [Clarity, Spec §File Ownership]
- [ ] CHK014 - Are the exact TypeScript `readonly` modifiers specified for all interface properties? [Clarity, Spec §R1-R5]
- [ ] CHK015 - Is the IPC channel naming pattern `mdxpad:<domain>:<action>` explicitly documented? [Clarity, Spec §R4]
- [ ] CHK016 - Are Optional vs Required properties clearly distinguished (using `?` syntax)? [Clarity, Spec §R1 EditorConfig]
- [ ] CHK017 - Is the relationship between Selection (anchor/head) and SelectionInfo (from/to/empty) clearly explained? [Clarity, Spec §R1]
- [ ] CHK018 - Are FileError discriminated union variants explicitly enumerated with all fields? [Clarity, Spec §R2]
- [ ] CHK019 - Are PreviewState discriminated union variants explicitly enumerated with all fields? [Clarity, Spec §R3]
- [ ] CHK020 - Is the cn() utility implementation explicitly shown (not just described)? [Clarity, Spec §R9]

---

## Requirement Consistency

- [ ] CHK021 - Does FileResult<T> in R2 match the Result<T,E> pattern in R7? [Consistency, Spec §R2 vs R7]
- [ ] CHK022 - Does CompileResult discriminator (ok: true/false) align with FileResult and Result patterns? [Consistency, Spec §R3 vs R2 vs R7]
- [ ] CHK023 - Are IpcApi method signatures consistent with FileResult<T> return types? [Consistency, Spec §R4 vs R2]
- [ ] CHK024 - Do Technology Stack version ranges in spec.md match exact versions in plan.md? [Consistency, Spec vs Plan]
- [ ] CHK025 - Does the Task Batching Guidance in spec.md align with actual task IDs in tasks.md? [Consistency, Spec vs Tasks]
- [ ] CHK026 - Are shadcn/ui components listed in Technology Stack consistent with R13 requirements? [Consistency, Spec §Tech Stack vs R13]
- [ ] CHK027 - Are path alias names consistent between tsconfig requirements and vite.config requirements? [Consistency, Spec §R15]
- [ ] CHK028 - Is the Theme type ('light' | 'dark' | 'system') consistent with CSS variable requirements? [Consistency, Spec §R5 vs R14]

---

## Constitution Compliance

- [ ] CHK029 - Does IPC channel count (10) comply with Constitution Article III.3 maximum? [Constitution, Art III.3]
- [ ] CHK030 - Does IPC naming pattern follow Constitution Article III.3 `mdxpad:domain:action` format? [Constitution, Art III.3]
- [ ] CHK031 - Are all technology versions within Constitution Article II mandated ranges? [Constitution, Art II]
- [ ] CHK032 - Does React version (19.x) comply with Constitution Article II? [Constitution, Art II]
- [ ] CHK033 - Does CodeMirror version (6.x) comply with Constitution Article II? [Constitution, Art II]
- [ ] CHK034 - Does Tailwind CSS version (4.x) comply with Constitution Article II? [Constitution, Art II]
- [ ] CHK035 - Is TypeScript strict: true requirement aligned with Constitution Article VI.1? [Constitution, Art VI.1]
- [ ] CHK036 - Do utility function sizes comply with Constitution Article VI.2 (max 50 lines)? [Constitution, Art VI.2]
- [ ] CHK037 - Do type file sizes comply with Constitution Article VI.2 (max 400 lines)? [Constitution, Art VI.2]
- [ ] CHK038 - Is Zod 4.x deferral explicitly documented and justified? [Constitution, Art II - Deferred]

---

## Cross-Lane Integration Readiness

- [ ] CHK039 - Are Editor lane type dependencies (EditorState, Selection, Command) fully specified? [Integration, US1]
- [ ] CHK040 - Are Shell lane type dependencies (FileHandle, FileState, IpcApi) fully specified? [Integration, US2]
- [ ] CHK041 - Are Preview lane type dependencies (CompileResult, PreviewState, PreviewConfig) fully specified? [Integration, US3]
- [ ] CHK042 - Is the File Ownership Declaration table complete with all owned files? [Integration, Spec §Ownership]
- [ ] CHK043 - Are consumer lanes explicitly listed for each owned file? [Integration, Spec §Ownership]
- [ ] CHK044 - Is the `_local/types.ts` escape hatch documented for lane-specific extensions? [Integration, Edge Cases]
- [ ] CHK045 - Are index.ts re-export requirements specified for both types and lib directories? [Integration, Spec §R6, R10]
- [ ] CHK046 - Is the import path convention (@shared/types, @shared/lib) documented for consumers? [Integration, Quickstart]

---

## Acceptance Criteria Quality

- [ ] CHK047 - Are Success Criteria SC-001 through SC-008 measurable and objective? [Measurability, Spec §Success Criteria]
- [ ] CHK048 - Is "all type files compile with --strict" testable via specific command? [Measurability, SC-001]
- [ ] CHK049 - Is "pnpm typecheck passes with zero errors" a binary pass/fail criterion? [Measurability, SC-002]
- [ ] CHK050 - Is "shadcn/ui components render correctly" defined with observable criteria? [Measurability, SC-006]
- [ ] CHK051 - Is "CSS variables functional" defined with testable light/dark mode behavior? [Measurability, SC-007]
- [ ] CHK052 - Are User Story acceptance scenarios written in Given/When/Then format? [Measurability, Spec §US1-5]
- [ ] CHK053 - Is each User Story's "Independent Test" method explicitly described? [Measurability, Spec §US1-5]

---

## Edge Case & Scenario Coverage

- [ ] CHK054 - Is the untitled file scenario (path: null) explicitly addressed in FileHandle? [Edge Case, Spec §R2]
- [ ] CHK055 - Is the "CANCELLED" file error case defined for user-cancelled dialogs? [Edge Case, Spec §R2]
- [ ] CHK056 - Is the empty selection case (anchor === head) handled in Selection type? [Edge Case, Spec §R1]
- [ ] CHK057 - Is the compilation error scenario with line/column info documented? [Edge Case, Spec §R3]
- [ ] CHK058 - Is the "idle" preview state before any compilation defined? [Edge Case, Spec §R3]
- [ ] CHK059 - Is the lane type extension escape hatch (_local/types.ts) documented? [Edge Case, Spec §Edge Cases]
- [ ] CHK060 - Is version mismatch handling via pnpm lockfile documented? [Edge Case, Spec §Edge Cases]
- [ ] CHK061 - Are all four FileError variants (NOT_FOUND, PERMISSION_DENIED, CANCELLED, UNKNOWN) specified? [Coverage, Spec §R2]
- [ ] CHK062 - Are all four PreviewState variants (idle, compiling, success, error) specified? [Coverage, Spec §R3]

---

## Type Export & API Surface

- [ ] CHK063 - Is R16 "type-only exports" rule clearly stated with exceptions for runtime utilities? [Clarity, Spec §R16]
- [ ] CHK064 - Are the exceptions (Result monad, EventEmitter, utils) explicitly listed? [Completeness, Spec §R16]
- [ ] CHK065 - Is the IpcHandler<C> type helper signature fully specified? [Completeness, Spec §R4]
- [ ] CHK066 - Is the IpcApi interface keyed by IpcChannels const values (computed property names)? [Clarity, Spec §R4]
- [ ] CHK067 - Are generic type parameters (T, E, Events, K) consistently named across utilities? [Consistency, Spec §R7-R8]

---

## Build & Configuration Requirements

- [ ] CHK068 - Is Tailwind v4 CSS-first configuration approach documented? [Completeness, Spec §R12]
- [ ] CHK069 - Are PostCSS configuration requirements specified? [Completeness, Plan §postcss.config.js]
- [ ] CHK070 - Is Vite @tailwindcss/vite plugin integration documented? [Completeness, Spec §R12]
- [ ] CHK071 - Is components.json schema and required fields documented? [Completeness, Plan §shadcn/ui]
- [ ] CHK072 - Are all tsconfig.json files requiring path alias updates identified? [Completeness, Spec §R15]
- [ ] CHK073 - Is vite.config.ts resolve.alias requirement documented? [Completeness, Spec §R15]
- [ ] CHK074 - Is globals.css location (src/renderer/styles/) explicitly specified? [Clarity, Spec §R14]

---

## Verification & Validation Requirements

- [ ] CHK075 - Is R17 verification requirement testable via three specific commands? [Measurability, Spec §R17]
- [ ] CHK076 - Are gate validation commands in tasks.md aligned with R17 requirements? [Consistency, Tasks vs Spec §R17]
- [ ] CHK077 - Is the verification sequence (typecheck → lint → build) explicitly ordered? [Clarity, Spec §R17]
- [ ] CHK078 - Are dev server verification criteria ("must launch without errors") defined? [Measurability, Tasks §Gate 5.2]

---

## Traceability & Dependencies

- [ ] CHK079 - Does every task in tasks.md reference at least one requirement [R#]? [Traceability]
- [ ] CHK080 - Are all 17 requirements (R1-R17) mapped to at least one task? [Traceability]
- [ ] CHK081 - Are inter-batch dependencies explicitly documented in tasks.md? [Dependencies, Tasks §Phase Dependencies]
- [ ] CHK082 - Is the Phase 2 independence (Batches 2.1, 2.2, 2.3 can run simultaneously) documented? [Dependencies, Tasks]
- [ ] CHK083 - Is the Phase 3 dependency on Phase 2 Batch 2.3 (Tailwind) documented? [Dependencies, Tasks]

---

## Gaps & Ambiguities Identified

- [ ] CHK084 - Is the APP_READY IPC channel purpose documented (missing from IpcApi signatures)? [Gap, Spec §R4]
- [ ] CHK085 - Are window operation return types (Promise<void>) intentional with no error handling? [Ambiguity, Spec §R4]
- [ ] CHK086 - Is debounce/throttle cancellation behavior specified? [Gap, Spec §R9]
- [ ] CHK087 - Is uid() uniqueness guarantee (UUID v4, nanoid, etc.) specified? [Ambiguity, Spec §R9]
- [ ] CHK088 - Are shadcn/ui component customization requirements defined beyond installation? [Gap, Spec §R13]
- [ ] CHK089 - Is the relationship between Theme 'system' and resolvedTheme calculation specified? [Gap, Spec §R5]
- [ ] CHK090 - Are panel size units (pixels, percentages) specified for PanelConstraints? [Ambiguity, Spec §R5]

---

## Summary

| Category | Items | Range |
|----------|-------|-------|
| Requirement Completeness | 10 | CHK001-CHK010 |
| Requirement Clarity | 10 | CHK011-CHK020 |
| Requirement Consistency | 8 | CHK021-CHK028 |
| Constitution Compliance | 10 | CHK029-CHK038 |
| Cross-Lane Integration | 8 | CHK039-CHK046 |
| Acceptance Criteria Quality | 7 | CHK047-CHK053 |
| Edge Case & Scenario Coverage | 9 | CHK054-CHK062 |
| Type Export & API Surface | 5 | CHK063-CHK067 |
| Build & Configuration | 7 | CHK068-CHK074 |
| Verification & Validation | 4 | CHK075-CHK078 |
| Traceability & Dependencies | 5 | CHK079-CHK083 |
| Gaps & Ambiguities | 7 | CHK084-CHK090 |
| **Total** | **90** | CHK001-CHK090 |
