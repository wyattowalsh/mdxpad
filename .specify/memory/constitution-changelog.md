# Constitution Changelog

All notable changes to the mdxpad Constitution are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-12-30

### Changed

- Article II: Updated Electron from 28.x (pinned) to 39.x (latest stable)
- Article II: Pinned electron-vite to 5.x, Vite to 7.x
- Article II: Pinned TypeScript to 5.9.x
- Article II: Pinned Zustand to 5.x, Immer to 11.x
- Article II: Pinned pnpm to 10.x
- Article II: Pinned Vitest to 4.x, Playwright to 1.57.x
- Article II: Added zod 4.x as required validation library

### Rationale

- Electron 39.x is current stable (Dec 2025), provides better performance and security
- All dependencies updated to latest stable versions verified via npm registry
- zod added as explicit requirement per Section 3.3 IPC contract pattern

### Impact

- Spec 000 can proceed with latest stable versions
- No breaking changes to existing code (greenfield project)

## [1.0.0] - 2025-12-30

### Added

- Initial constitution ratification
- Article I: Value Hierarchy (Security > Performance > UX > Quality > Extensibility)
- Article II: Technology Stack (Electron 28.x, React 19.x, CodeMirror 6, TypeScript 5.x strict)
- Article III: Architecture (Process separation, security requirements, IPC contracts)
- Article IV: Plugin Architecture (3-tier security model, version-scoped roadmap)
- Article V: Performance Budgets (cold start <2s, keystroke <16ms, etc.)
- Article VI: Code Quality (TypeScript strict, 50-line functions, 80% coverage)
- Article VII: User Experience (macOS HIG, accessibility WCAG AA)
- Article VIII: Development Workflow (conventional commits, task-based commits)
- Article IX: Constitution Compliance (plan verification, implementation checkpoints)
- Article X: Deferred Decisions (cross-platform, cloud sync, collaborative editing)
- Article XI: Bootstrapping (Feature 000 requirements)
- Article XII: Amendment Process

### Rationale

- Establishing foundational governance for mdxpad development
- macOS-first strategy to validate market before cross-platform investment
- Security-first architecture with Electron best practices
- Performance budgets based on native app user expectations

### Impact

- All future specifications, plans, and implementations must comply
- Feature 000 (Foundational Setup) must be completed before any product features
