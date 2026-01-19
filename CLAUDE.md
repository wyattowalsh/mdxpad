ALWAYS START BY READING ANY AND ALL PERTINENT `AGENTS.md` INSTRUCTION FILES FIRST!!!

## Active Technologies
- TypeScript 5.9.x with `strict: true` (000-foundational-setup)
- N/A (file system access deferred to Spec 003) (000-foundational-setup)
- TypeScript 5.9.x with `strict: true` (per Constitution Article II) (001-interface-contracts)
- N/A (type definitions only) (001-interface-contracts)
- TypeScript 5.9.x, strict: true (per Constitution Article II) + Electron 39.2.7, chokidar 5.0.0 (file watching), zod 4.3.5 (validation) (004-file-system-shell)
- File system (Node.js fs/promises), electron-store for recent files persistence (004-file-system-shell)
- TypeScript 5.9.x with `strict: true` (per Constitution Article II) + Electron 39.x, React 19.x, Zustand 5.x + Immer 11.x, CodeMirror 6.x, zod 4.x (005-command-palette)
- localStorage for recent commands and UI state persistence (005-command-palette)
- TypeScript 5.9.x, strict: true + React 19.x, Zustand 5.x + Immer 11.x, react-resizable-panels 4.1.0 (006-application-shell)
- localStorage for UI state (splitRatio, previewVisible, zoomLevel), electron-store for main process data (006-application-shell)
- TypeScript 5.9.x, strict: true + React 19.x, Zustand 5.x + Immer 11.x (007-mdx-content-outline)
- Reuses preview AST, localStorage for outline visibility persistence (007-mdx-content-outline)
- localStorage for filter query persistence per project/workspace (established pattern from specs 005/006) (014-smart-filtering)
- TypeScript 5.9.x, strict: true (per Constitution Article II) + React 19.x, Zustand 5.x + Immer 11.x, zod 4.x, yaml (YAML parsing library) (020-frontmatter-editor)
- localStorage for panel visibility state, electron-store for user schema defaults (020-frontmatter-editor)

## Recent Changes
- 000-foundational-setup: Added TypeScript 5.9.x with `strict: true`
- 006-application-shell: Planning complete - integrates editor, preview, file ops into cohesive shell
- 007-mdx-content-outline: Specification complete - live document outline with headings, components, and frontmatter navigation
