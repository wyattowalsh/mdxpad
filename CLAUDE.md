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
- TypeScript 5.9.x, strict: true + Electron 39.x (safeStorage), React 19.x, Zustand 5.x + Immer 11.x, Vercel AI SDK v6 (@ai-sdk/*) (028-ai-provider-abstraction)
- electron-store for config/usage, safeStorage for credentials (macOS Keychain), memory for session fallback (028-ai-provider-abstraction)

## Recent Changes
- 000-foundational-setup: Added TypeScript 5.9.x with `strict: true`
- 006-application-shell: Planning complete - integrates editor, preview, file ops into cohesive shell
- 007-mdx-content-outline: Specification complete - live document outline with headings, components, and frontmatter navigation
- 028-ai-provider-abstraction: Planning complete - BYOK AI provider abstraction with Vercel AI SDK, safeStorage credentials, hybrid capability detection
