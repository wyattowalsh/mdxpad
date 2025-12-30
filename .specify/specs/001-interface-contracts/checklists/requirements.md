# Requirements Checklist - Interface Contracts

**Spec**: 001-interface-contracts
**Created**: 2025-12-30
**Status**: Draft

## Type Definition Requirements

### R1: Editor Types (`src/shared/types/editor.ts`)
- [ ] EditorState interface defined with `doc` and `selection` properties
- [ ] Selection interface defined with `anchor` and `head` properties
- [ ] SelectionInfo interface defined with `from`, `to`, `empty` properties
- [ ] Command type defined as function signature
- [ ] EditorConfig interface defined with all optional config properties
- [ ] EditorChange interface defined with change event payload

### R2: File Types (`src/shared/types/file.ts`)
- [ ] FileId branded type defined
- [ ] createFileId function signature declared
- [ ] FileHandle interface defined with `id`, `path`, `name`
- [ ] FileState interface defined with `handle`, `content`, `savedContent`, `isDirty`
- [ ] FileResult generic type defined as discriminated union
- [ ] FileError type defined with all error codes

### R3: Preview Types (`src/shared/types/preview.ts`)
- [ ] CompileResult discriminated union defined
- [ ] CompileSuccess interface defined with `ok`, `code`, `frontmatter`
- [ ] CompileFailure interface defined with `ok`, `errors`
- [ ] CompileError interface defined
- [ ] PreviewConfig interface defined
- [ ] PreviewState discriminated union defined

### R4: IPC Types (`src/shared/types/ipc.ts`)
- [ ] IpcChannels const object defined with all channel names
- [ ] IpcChannel type derived from IpcChannels
- [ ] IpcApi interface defined with type-safe signatures
- [ ] IpcHandler type helper defined

### R5: UI Types (`src/shared/types/ui.ts`)
- [ ] LayoutState interface defined
- [ ] Theme type defined ('light' | 'dark' | 'system')
- [ ] ThemeConfig interface defined
- [ ] PanelConstraints interface defined

### R6: Index Export (`src/shared/types/index.ts`)
- [ ] Re-exports all type modules

## Utility Implementation Requirements

### R7: Result Monad (`src/shared/lib/result.ts`)
- [ ] Result<T, E> type defined
- [ ] ok() function implemented
- [ ] err() function implemented
- [ ] map() function implemented
- [ ] mapErr() function implemented
- [ ] flatMap() function implemented
- [ ] unwrapOr() function implemented
- [ ] unwrap() function implemented

### R8: Event Emitter (`src/shared/lib/events.ts`)
- [ ] TypedEventEmitter interface defined
- [ ] on() method returns unsubscribe function
- [ ] once() method defined
- [ ] emit() method defined
- [ ] off() method defined
- [ ] createEventEmitter() factory function implemented

### R9: Utility Library (`src/shared/lib/utils.ts`)
- [ ] cn() function implemented (clsx + twMerge)
- [ ] debounce() function implemented
- [ ] throttle() function implemented
- [ ] uid() function implemented

### R10: Lib Index (`src/shared/lib/index.ts`)
- [ ] Re-exports all lib modules

## Infrastructure Requirements

### R11: Package Dependencies
- [ ] All CodeMirror packages added
- [ ] All MDX packages added
- [ ] React 19.x added
- [ ] Tailwind CSS v4 added
- [ ] shadcn/ui dependencies added
- [ ] Dev dependencies added

### R12: Tailwind Configuration
- [ ] `tailwind.config.ts` created
- [ ] Vite plugin configured
- [ ] Content paths configured

### R13: shadcn/ui Setup
- [ ] `components.json` created with correct paths
- [ ] Button component installed
- [ ] Input component installed
- [ ] Dialog component installed
- [ ] Dropdown-menu component installed
- [ ] Popover component installed
- [ ] Tooltip component installed
- [ ] Tabs component installed
- [ ] Scroll-area component installed
- [ ] Separator component installed
- [ ] Command component installed

### R14: CSS Variables
- [ ] Light theme variables defined
- [ ] Dark theme variables defined
- [ ] Color scheme support configured

### R15: Path Aliases
- [ ] `@shared/*` alias configured
- [ ] `@main/*` alias configured
- [ ] `@preload/*` alias configured
- [ ] `@renderer/*` alias configured
- [ ] `@ui/*` alias configured
- [ ] Aliases work in all tsconfig files

### R16: Type Exports
- [ ] Type files export only types (no runtime code except where noted)
- [ ] Result monad includes implementations (as specified)
- [ ] Events include implementation (as specified)
- [ ] Utils include implementations (as specified)

### R17: Compilation Verification
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` succeeds

## Success Criteria Verification

- [ ] SC-001: All type files compile with `--strict`
- [ ] SC-002: `pnpm typecheck` zero errors
- [ ] SC-003: `pnpm lint` zero errors
- [ ] SC-004: `pnpm build` succeeds
- [ ] SC-005: All dependencies importable
- [ ] SC-006: shadcn/ui components render
- [ ] SC-007: CSS variables functional
- [ ] SC-008: Path aliases resolve correctly
