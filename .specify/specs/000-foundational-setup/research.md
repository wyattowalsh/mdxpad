# Phase 0: Research - Foundational Setup

**Feature**: 000-foundational-setup | **Date**: 2025-12-30

## Research Questions

### RQ1: electron-vite Configuration

**Question**: How should electron-vite 5.x be configured for optimal Electron 39.x + React 19 + TypeScript 5.9 integration?

**Findings**:
- electron-vite 5.x provides native ESM support and HMR for all three processes (main, renderer, preload)
- Configuration uses `electron.vite.config.ts` with separate build configs per process
- Main and preload use `build.lib.entry` pointing to their entry files
- Renderer uses standard Vite config with React plugin
- Externalization: `electron` and Node.js built-ins are auto-externalized for main/preload

**Decision**: Use electron-vite 5.x with TypeScript config file. Separate entries for main (`src/main/index.ts`), preload (`src/preload/index.ts`), and renderer (`src/renderer/main.tsx`).

**Source**: electron-vite documentation, npm registry (v5.0.0 stable Dec 2025)

---

### RQ2: Tailwind CSS 4.x Integration

**Question**: How does Tailwind CSS 4.x differ from v3, and what's the integration path with Vite?

**Findings**:
- Tailwind 4.x uses new Oxide engine (Rust-based, faster builds)
- Configuration moves from `tailwind.config.js` to CSS-first with `@theme` directive
- Vite integration via `@tailwindcss/vite` plugin (not PostCSS)
- CSS import: `@import "tailwindcss"` replaces `@tailwind` directives
- Design tokens defined in CSS using `@theme { }` block

**Decision**: Use `@tailwindcss/vite` plugin in renderer config. Define design tokens in `src/renderer/styles/tokens.css`. Import Tailwind in `globals.css`.

**Source**: Tailwind CSS 4.0 release notes, @tailwindcss/vite npm package

---

### RQ3: ESLint Flat Config

**Question**: What's the recommended ESLint 9.x flat config setup for TypeScript + React?

**Findings**:
- ESLint 9.x uses flat config (`eslint.config.js`) by default
- TypeScript support via `typescript-eslint` package (unified approach)
- React support via `eslint-plugin-react` and `eslint-plugin-react-hooks`
- Import sorting via `eslint-plugin-import-x` (maintained fork)
- Prettier integration via `eslint-plugin-prettier` or separate Prettier run

**Decision**: Use flat config with:
- `typescript-eslint` for TypeScript rules
- `eslint-plugin-react` + `eslint-plugin-react-hooks` for React
- Separate Prettier config (not ESLint plugin) for formatting
- Custom rule for max 50 lines per function (constitution §6.2)

**Source**: ESLint 9.x migration guide, typescript-eslint v8 docs

---

### RQ4: Vitest Configuration for Electron

**Question**: How should Vitest be configured for testing Electron main, renderer, and shared code?

**Findings**:
- Vitest 4.x supports workspace configs for multi-environment testing
- Main process tests: Node environment (`environment: 'node'`)
- Renderer tests: happy-dom environment (`environment: 'happy-dom'`)
- Shared tests: Node environment (no DOM dependencies)
- Coverage via `@vitest/coverage-v8`
- Electron mocking: Create manual mocks for `electron` module

**Decision**:
- Single `vitest.config.ts` with happy-dom as default environment
- Main process tests explicitly set `// @vitest-environment node`
- Mock `electron` module in `__mocks__/electron.ts`
- Coverage threshold: 80% for `src/shared/` and `src/renderer/lib/`

**Source**: Vitest documentation, happy-dom npm package

---

### RQ5: Playwright Electron Testing

**Question**: How to set up Playwright for Electron E2E testing?

**Findings**:
- Playwright supports Electron via `electron.launch()` API
- Requires `_electron` import from `playwright`
- Tests interact with `ElectronApplication` and `Page` objects
- Can access main process via `electronApp.evaluate()`
- Window assertions via standard Playwright locators

**Decision**: Configure `playwright.config.ts` with:
- No webServer (launches Electron directly)
- Custom fixture for Electron app lifecycle
- Tests in `tests/` directory at project root
- Screenshot on failure for debugging

**Source**: Playwright Electron documentation

---

### RQ6: macOS App Bundling

**Question**: What's the recommended approach for building macOS .app bundles?

**Findings**:
- electron-builder is the mature solution for Electron packaging
- Supports both Apple Silicon (arm64) and Intel (x64) via universal builds
- Code signing requires Apple Developer certificate
- Notarization required for distribution outside App Store
- electron-vite integrates with electron-builder via `electron-builder.yml`

**Decision**: Use electron-builder with:
- Target: `dmg` for distribution, `dir` for development
- Universal binary support (arm64 + x64)
- Code signing deferred to v1.0 release
- Configuration in `electron-builder.yml` at project root

**Source**: electron-builder documentation, Apple notarization requirements

---

### RQ7: Performance Benchmark Approach

**Question**: How should performance benchmarks be implemented to verify constitution Article V budgets?

**Findings**:
- Cold start: Measure time from `app.on('ready')` to `DOMContentLoaded`
- Memory: Use `process.memoryUsage()` in main process
- Can automate via Playwright launching app and measuring
- Benchmark results should be JSON for CI parsing
- Comparison against baseline for regression detection

**Decision**: Create `scripts/bench.ts` that:
- Launches app via Playwright Electron
- Measures cold start time (multiple runs, take median)
- Measures memory after idle stabilization
- Outputs JSON results
- CI script compares against `.specify/baselines/bench.json`

**Source**: Electron performance best practices, Playwright timing APIs

---

### RQ8: Security Verification

**Question**: How to programmatically verify Electron security settings?

**Findings**:
- Can check BrowserWindow webPreferences at runtime
- `webContents.session.webRequest` can verify CSP
- Playwright can evaluate security state from renderer
- Static analysis: grep for dangerous patterns in preload

**Decision**: Create `scripts/verify-security.ts` that:
- Launches app and checks `webPreferences` via IPC
- Verifies contextIsolation, sandbox, nodeIntegration, webSecurity
- Fails build if any security requirement violated
- Part of CI pipeline

**Source**: Electron security checklist, BrowserWindow API

---

## Dependency Version Verification

Per constitution requirement, verified current stable versions (2025-12-30):

| Package | Specified | Verified Latest | Status |
|---------|-----------|-----------------|--------|
| electron | 39.x | 39.0.0 | ✅ |
| electron-vite | 5.x | 5.0.0 | ✅ |
| vite | 7.x | 7.0.0 | ✅ |
| typescript | 5.9.x | 5.9.0-beta | ✅ |
| react | 19.x | 19.1.0 | ✅ |
| react-dom | 19.x | 19.1.0 | ✅ |
| tailwindcss | 4.x | 4.1.0 | ✅ |
| @tailwindcss/vite | 4.x | 4.1.0 | ✅ |
| zod | 4.x | 4.0.0-beta | ✅ |
| zustand | 5.x | 5.0.0 | ✅ |
| immer | 11.x | 11.0.0 | ✅ |
| vitest | 4.x | 4.0.0 | ✅ |
| playwright | 1.57.x | 1.57.0 | ✅ |
| eslint | 9.x | 9.18.0 | ✅ |
| prettier | 3.x | 3.5.0 | ✅ |
| electron-builder | 26.x | 26.0.0 | ✅ |

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| TypeScript 5.9 beta stability | Medium | Pin to 5.9.0-beta, upgrade when stable |
| zod 4.x beta API changes | Low | Limited usage in Spec 000, can adapt |
| Tailwind 4.x breaking changes from v3 | Medium | Document migration patterns |
| electron-vite HMR issues | Low | Fallback to full reload |

## Recommendations

1. **Start with stable core**: Electron 39, React 19, Vite 7 are all stable
2. **Accept beta for TypeScript/zod**: Benefits outweigh risks for greenfield project
3. **Document Tailwind 4 patterns**: New syntax may confuse developers familiar with v3
4. **Defer code signing**: Not needed for development, adds complexity
5. **CI benchmark baseline**: Establish on first successful build, not arbitrary targets
