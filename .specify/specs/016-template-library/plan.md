# Implementation Plan: Template Library

**Branch**: `016-template-library` | **Date**: 2026-01-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-template-library/spec.md`

## Summary

Template Library provides a collection of MDX document templates with browsing, preview, and management capabilities. Users can create documents from built-in or custom templates, with support for dynamic variables (`{{title}}`) and static placeholders. Templates are stored as `.mdxt` files with YAML frontmatter. The feature integrates with existing file creation workflow and leverages the preview pane for template previews.

## Technical Context

**Language/Version**: TypeScript 5.9.x, strict: true (per Constitution Article II)
**Primary Dependencies**: React 19.x, Zustand 5.x + Immer 11.x, zod 4.x, @mdx-js/mdx 3.x (for template validation)
**Storage**: File system via Spec 004 infrastructure; custom templates in `~/.mdxpad/templates/`; built-in templates bundled at `/Applications/mdxpad.app/Contents/Resources/templates/` per Constitution Article X (macOS target)
**Testing**: Vitest 4.x (unit), Playwright 1.57.x (E2E)
**Target Platform**: macOS (Electron 39.x) per Constitution Article X
**Project Type**: Web application (Electron with renderer process UI)
**Performance Goals**: Template preview < 1 second (per SC-002, includes MDX compile), Search < 200ms (per SC-004)
**Constraints**: Template browser must support keyboard navigation (WCAG AA per Constitution Article VII)
**Scale/Scope**: Up to 100 templates (per SC-004), no hard limits on custom templates

**Performance Budget Detail**:
| Operation | Budget | Article V Compliance |
|-----------|--------|---------------------|
| Template preview render | < 1000ms | Within user-facing budget (SC-002) |
| Template validation (MDX compile) | < 500ms | Within MDX compile budget |
| Custom template save (total) | < 2000ms | User-facing, includes validation (SC-009) |
| Search results | < 200ms | Per SC-004 |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| II | TypeScript 5.9.x strict: true | ✅ PASS | Using pinned version |
| II | React 19.x, Zustand 5.x, zod 4.x | ✅ PASS | Using pinned versions |
| II | gray-matter for YAML parsing | ✅ PASS | Using gray-matter ^4.0.3 for frontmatter parsing (Article II amendment approved) |
| III.1 | Process separation (renderer owns UI) | ✅ PASS | Template browser in renderer |
| III.2 | contextIsolation: true, sandbox: true | ✅ PASS | Inherits from Spec 000 |
| III.3 | IPC contract pattern, zod validation | ✅ PASS | All IPC uses zod schemas from template-schemas.ts |
| III.5 | Preview in sandboxed iframe | ✅ PASS | Reuses Spec 003 preview infrastructure |
| V | MDX compile < 500ms | ✅ PASS | Template preview reuses existing compiler |
| V | Template validation performance | ✅ PASS | Validation included in 500ms compile budget |
| VI.1 | JSDoc on public APIs | ✅ PASS | All template APIs will be documented |
| VI.2 | Functions < 50 lines, files < 400 lines | ✅ PASS | Will enforce during implementation |
| VI.4 | Unit coverage > 80% for lib/ | ✅ PASS | Gate 7.2 includes coverage threshold |
| VII.2 | Keyboard navigation, focus indicators | ✅ PASS | FR-019 requires keyboard nav |
| VII.3 | User-facing errors actionable | ✅ PASS | Error messages defined in spec.md |

**Gate Status**: ✅ PASS - All requirements satisfied, proceed to implementation

**IPC Validation Implementation** (Article III.3):
All template IPC handlers in `template-service.ts` MUST:
1. Parse incoming payload with `TemplateRequestSchema.safeParse()`
2. Return `TemplateErrorResponse` if validation fails
3. Use typed response schemas for all outgoing data
See `contracts/template-schemas.ts` for complete schema definitions.

## Project Structure

### Documentation (this feature)

```text
specs/016-template-library/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── template-schemas.ts
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main/
│   └── services/
│       └── template-service.ts      # Main process: template file I/O
├── renderer/
│   ├── components/
│   │   └── template-browser/
│   │       ├── TemplateBrowser.tsx  # Main browser component
│   │       ├── TemplateCard.tsx     # Individual template card
│   │       ├── TemplatePreview.tsx  # Preview panel (reuses Spec 003)
│   │       ├── TemplateFilters.tsx  # Search and category filters
│   │       ├── VariableDialog.tsx   # Dynamic variable input dialog
│   │       └── SaveTemplateDialog.tsx # Save as template dialog
│   ├── stores/
│   │   └── template-store.ts        # Zustand store for template state
│   └── lib/
│       ├── template-parser.ts       # Parse .mdxt files
│       └── template-variables.ts    # Variable extraction and substitution
├── shared/
│   └── ipc-channels.ts              # Add template IPC channels
└── preload/
    └── index.ts                     # Expose template API

tests/
├── unit/
│   ├── template-parser.test.ts
│   └── template-variables.test.ts
├── integration/
│   └── template-ipc.test.ts
└── e2e/
    └── template-browser.spec.ts

resources/
└── templates/                       # Built-in templates
    ├── blog-post.mdxt
    ├── documentation.mdxt
    ├── presentation.mdxt
    ├── meeting-notes.mdxt
    └── tutorial.mdxt
```

**Structure Decision**: Follows existing Electron architecture from Specs 000-007. Template browser is a renderer component, file operations go through main process via IPC, built-in templates bundled as resources.

**Note**: IPC channel constants (`TEMPLATE_IPC_CHANNEL`, `TEMPLATE_CREATE_CHANNEL`) are defined in `contracts/template-schemas.ts` and should be imported from there. T004 will add re-exports to `src/shared/ipc-channels.ts` for consistency with existing patterns.

**Prerequisite**: `src/shared/ipc-channels.ts` exists from prior specs (004-007). T004 adds template channel exports to this existing file.

**Security**: Custom templates restricted to `~/.mdxpad/templates/`; built-in templates restricted to app resources. Path validation rejects templates outside allowed directories (V-T007).

## Built-in Template Update Strategy

Built-in templates are bundled in the application package:
1. **Bundling**: Templates copied to `resources/templates/` during build (loose files, not Asar-packed)
2. **Runtime Loading**: Main process reads from `path.join(process.resourcesPath, 'templates')`
3. **Update Delivery**: New templates delivered with application updates
4. **No Remote Fetch**: Built-in templates never fetched from network
5. **Fallback**: If built-in templates missing, show error and offer to re-download app
6. **Electron Builder Config**: `extraResources: ['resources/templates/**/*']`

## Complexity Tracking

> No constitution violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
