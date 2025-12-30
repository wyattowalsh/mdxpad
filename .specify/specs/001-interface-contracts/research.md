# Research: Interface Contracts

**Branch**: `001-interface-contracts` | **Date**: 2025-12-30

## Research Summary

This document captures research findings for technology decisions in the Interface Contracts spec. Since this is primarily a type definition and dependency installation spec, research focuses on version compatibility and best practices.

---

## R1: CodeMirror 6 Version Selection

**Decision**: Use `@codemirror/state` 6.5.2, `@codemirror/view` 6.39.7

**Rationale**:
- Constitution Article II mandates CodeMirror 6.x
- Latest stable versions as of 2025-12-30
- CodeMirror 6 changelog shows active maintenance with bug fixes through December 2025
- Version 6.39.7 includes Chrome selection bug fixes (released 2025-12-09)

**Alternatives Considered**:
- CodeMirror 5.x - Rejected: Constitution mandates 6.x; 5.x is legacy
- Pinning to older 6.x - Rejected: No benefit, latest has bug fixes

**Source**: https://codemirror.net/docs/changelog/

---

## R2: React 19.x Version Selection

**Decision**: Use `react` 19.2.3, `react-dom` 19.2.3

**Rationale**:
- Constitution Article II mandates React 19.x
- React 19.2 released October 2025, 19.2.3 is latest patch (December 2025)
- Includes performance improvements and stability fixes
- Full compatibility with Electron renderer process

**Alternatives Considered**:
- React 19.1.x - Rejected: 19.2.x has performance improvements
- React 19.0.x - Rejected: Superseded by 19.1 and 19.2

**Source**: https://react.dev/blog/2025/10/01/react-19-2

---

## R3: Tailwind CSS v4 Configuration

**Decision**: Use `tailwindcss` 4.1.18 with `@tailwindcss/vite` 4.1.18

**Rationale**:
- Constitution Article II mandates Tailwind CSS 4.x
- v4.0 released early 2025, v4.1 is mature with Vite-first architecture
- Uses new CSS-first configuration approach (theme in CSS, not JS config)
- Native support for CSS variables and color schemes

**Alternatives Considered**:
- Tailwind CSS 3.x - Rejected: Constitution mandates 4.x
- CSS-in-JS (styled-components, emotion) - Rejected: Constitution mandates Tailwind

**Configuration Notes**:
- Tailwind v4 uses `@import "tailwindcss"` in CSS file
- Vite plugin handles processing automatically
- Theme customization via CSS variables in `globals.css`

**Source**: https://tailwindcss.com/blog/tailwindcss-v4

---

## R4: shadcn/ui Integration Strategy

**Decision**: Use shadcn CLI with Tailwind v4 configuration

**Rationale**:
- shadcn/ui provides accessible, customizable components
- Works with Tailwind CSS v4 via updated CLI
- Components are copied to project (not npm dependency)
- Allows full customization without fighting library

**Alternatives Considered**:
- Radix UI directly - Rejected: Would need to build all styling from scratch
- Headless UI - Rejected: Less comprehensive component set
- Material UI - Rejected: Heavy bundle, opinionated styling

**Configuration Notes**:
- `rsc: false` since Electron renderer is not React Server Components
- Style: "new-york" (modern, clean aesthetic)
- Base color: "zinc" (neutral gray scale)
- CSS variables: enabled for theme support

**Source**: https://ui.shadcn.com/docs/installation/vite

---

## R5: IPC Channel Naming Convention

**Decision**: Follow `mdxpad:<domain>:<action>` pattern per Constitution Article III.3

**Rationale**:
- Constitution explicitly requires this naming convention
- Prevents channel name collisions with Electron internals
- Clear domain separation (file, window, app)
- Consistent pattern across all IPC communication

**Channel Mapping**:

| Domain | Channels |
|--------|----------|
| `mdxpad:file:*` | open, save, save-as, read, write |
| `mdxpad:window:*` | close, minimize, maximize |
| `mdxpad:app:*` | version, ready |

**Alternatives Considered**:
- Short names (file:open) - Rejected: Violates constitution
- Camel case (mdxpad.file.open) - Rejected: Constitution uses colons

---

## R6: Path Alias Strategy

**Decision**: Configure aliases in both tsconfig.json and vite.config.ts

**Rationale**:
- TypeScript needs paths for type resolution
- Vite needs resolve.alias for runtime bundling
- Electron has multiple tsconfig files (main, preload, renderer)

**Alias Configuration**:

```typescript
// In all tsconfig.json files
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["./src/shared/*"],
      "@main/*": ["./src/main/*"],
      "@preload/*": ["./src/preload/*"],
      "@renderer/*": ["./src/renderer/*"],
      "@ui/*": ["./src/renderer/components/ui/*"]
    }
  }
}

// In vite.config.ts (for renderer)
{
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@ui': path.resolve(__dirname, 'src/renderer/components/ui')
    }
  }
}
```

**Alternatives Considered**:
- Relative imports - Rejected: Verbose, fragile to refactoring
- npm workspaces - Rejected: Overkill for single-package Electron app

---

## R7: Result Monad Implementation

**Decision**: Implement custom Result<T, E> type with utility functions

**Rationale**:
- Provides type-safe error handling without exceptions
- Aligns with functional programming patterns in TypeScript
- Lightweight (no external dependency)
- Compatible with async/await via Promise<Result<T, E>>

**Alternatives Considered**:
- neverthrow library - Rejected: External dependency for simple pattern
- ts-results library - Rejected: Similar concern
- Plain try/catch - Rejected: Less type-safe, loses error type information

**Implementation Notes**:
- Discriminated union with `ok: boolean` discriminator
- Utility functions: ok(), err(), map(), mapErr(), flatMap(), unwrapOr(), unwrap()
- All functions are pure and type-safe

---

## R8: TypedEventEmitter Implementation

**Decision**: Implement generic TypedEventEmitter interface with factory function

**Rationale**:
- Node's EventEmitter lacks type safety
- Generic Events record provides compile-time event name and payload checking
- Returns unsubscribe function from on() for easy cleanup
- Simple implementation without external dependencies

**Alternatives Considered**:
- mitt library - Rejected: Very simple, but external dependency
- eventemitter3 - Rejected: External dependency, no type generics
- RxJS - Rejected: Overkill for simple pub/sub

**Implementation Notes**:
- Handler storage via Map<keyof Events, Set<handler>>
- Returns cleanup function from on() and once()
- No inheritance required (factory pattern)

---

## R9: MDX Compilation Pipeline

**Decision**: Use @mdx-js/mdx 3.1.x with remark/rehype plugins

**Rationale**:
- Constitution Article II mandates @mdx-js/mdx 3.x
- remark-gfm for GitHub Flavored Markdown (tables, strikethrough, etc.)
- remark-frontmatter for YAML front matter extraction
- rehype-highlight for code syntax highlighting in preview

**Plugin Order**:
1. remark-frontmatter (parse YAML)
2. remark-gfm (GFM extensions)
3. rehype-highlight (syntax highlighting)

**Alternatives Considered**:
- MDX 2.x - Rejected: Constitution mandates 3.x
- Custom markdown parser - Rejected: MDX is required for JSX support

---

## R10: Zod Validation (Deferred)

**Decision**: Install Zod 4.1.x but defer schema definitions to implementation lanes

**Rationale**:
- Constitution Article II mandates Zod 4.x
- IPC payloads MUST be validated per Article III.3
- Actual schemas depend on implementation details
- This spec only installs the dependency

**Notes**:
- Zod 4 includes z.toJSONSchema() for schema export
- 3x faster parsing than Zod 3
- Will be used in Shell lane for IPC validation

---

## Unresolved Items

None. All technical decisions have been made with constitutional alignment.

---

## References

1. CodeMirror Changelog: https://codemirror.net/docs/changelog/
2. React 19.2 Blog: https://react.dev/blog/2025/10/01/react-19-2
3. Tailwind CSS v4: https://tailwindcss.com/blog/tailwindcss-v4
4. shadcn/ui Installation: https://ui.shadcn.com/docs/installation/vite
5. Zod v4 Release Notes: https://zod.dev/v4
