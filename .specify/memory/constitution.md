<!--
================================================================================
SYNC IMPACT REPORT
================================================================================
Version change: N/A (initial) → 1.0.0
Modified principles: N/A (initial creation)
Added sections:
  - Preamble
  - Article I: Value Hierarchy
  - Article II: Technology Stack
  - Article III: Architecture (5 sub-sections)
  - Article IV: Plugin Architecture (4 sub-sections)
  - Article V: Performance Budgets
  - Article VI: Code Quality (4 sub-sections)
  - Article VII: User Experience (3 sub-sections)
  - Article VIII: Development Workflow (3 sub-sections)
  - Article IX: Constitution Compliance (3 sub-sections)
  - Article X: Deferred Decisions
  - Article XI: Bootstrapping
  - Article XII: Amendment Process
  - Governance
  - Glossary
Removed sections: All template placeholders replaced
Templates requiring updates:
  - .specify/templates/plan-template.md: ✅ Compatible (has Constitution Check section)
  - .specify/templates/spec-template.md: ✅ Compatible (requirements format aligns)
  - .specify/templates/tasks-template.md: ✅ Compatible (phase structure aligns)
Follow-up TODOs: None
================================================================================
-->

---
version: "1.1.0"
last_updated: "2025-12-30"
status: ratified
---

# mdxpad Constitution {#constitution}

## Preamble {#preamble}

mdxpad is "the most powerful, performant, flexible, extendible, beautiful, modern, useful,
user-friendly, robust, efficient, configurable, awesome MDX editor."

**Target Audience**: Developers and technical writers who want native macOS performance with
plugin extensibility.

**Platform Scope**: macOS-only through v2.0. Cross-platform support is explicitly deferred.

### Language Conventions {#language-conventions}

The following terms are used precisely throughout this document:

| Term | Meaning |
|------|---------|
| MUST / SHALL / REQUIRED | Non-negotiable. Violation blocks merge. |
| MUST NOT / PROHIBITED | Absolute ban. No exceptions. |
| SHOULD / RECOMMENDED | Strong preference. Deviation requires documented justification. |
| MAY / OPTIONAL | Team discretion. |

## Article I: Value Hierarchy {#values}

When requirements conflict, this priority order governs (highest to lowest):

1. **Security** — never compromise, even for performance
2. **Performance** — user-perceived speed is paramount
3. **User Experience** — native feel, polish, accessibility
4. **Code Quality** — maintainability, test coverage
5. **Extensibility** — plugin ecosystem

**Example**: If achieving 80% test coverage adds 5ms keystroke latency, reduce coverage target.

## Article II: Technology Stack {#stack}

All technologies are pinned. Upgrades require constitution amendment.

| Layer | Technology | Version | Negotiable |
|-------|------------|---------|------------|
| Shell | Electron | 39.x | NO |
| Build | electron-vite + Vite | 5.x / 7.x | NO |
| Language | TypeScript | 5.9.x, strict: true | NO |
| UI | React | 19.x | NO |
| Editor | CodeMirror 6 | 6.x | NO |
| MDX | @mdx-js/mdx + unified | 3.x | NO |
| State | Zustand + Immer | 5.x / 11.x | NO |
| Styling | Tailwind CSS | 4.x | NO |
| Validation | zod | 4.x | NO |
| Package Manager | pnpm | 10.x | NO |
| Unit Tests | Vitest | 4.x | SHOULD |
| E2E Tests | Playwright | 1.57.x | SHOULD |

**VERIFICATION REQUIREMENT**: Before any `/speckit.plan`, agent MUST verify current stable
versions via npm registry. Do not assume—confirm.

## Article III: Architecture {#arch}

### Section 3.1: Process Separation {#arch-processes}

**MAIN PROCESS** owns:
- File system operations (via chokidar for watching)
- Plugin loading for Tier 2 and Tier 3 only
- Native APIs: menus, dialogs, system integration
- IPC hub: all cross-process communication routes through main

**RENDERER PROCESS** owns:
- All UI rendering
- CodeMirror editor instance
- Preview iframe (sandboxed)
- Tier 1 plugins only

**PRELOAD SCRIPTS**:
- MUST use contextBridge exclusively
- MUST expose typed, minimal API surface
- MUST NOT expose Node.js primitives directly

### Section 3.2: Security Requirements {#arch-security}

These are NON-NEGOTIABLE for all Electron configurations:

```javascript
// REQUIRED BrowserWindow settings
{
  webPreferences: {
    contextIsolation: true,    // MUST be true
    sandbox: true,             // MUST be true
    nodeIntegration: false,    // MUST be false
    webSecurity: true,         // MUST be true
  }
}
```

### Section 3.3: IPC Contract Pattern {#arch-ipc}

- All IPC channels MUST be defined in `shared/ipc-channels.ts`
- MUST use invoke/handle pattern (not send/on) for request/response
- All payloads MUST be validated with zod on both ends
- Maximum 10 top-level channels; nest related operations
- Channel naming: `mdxpad:<domain>:<action>` (e.g., `mdxpad:file:read`)

### Section 3.4: Editor Architecture {#arch-editor}

- CodeMirror 6 MUST own all editor state
- MUST NOT duplicate editor state in React state
- Extensions MUST follow CodeMirror idioms (Extension, Facet, StateField)
- MDX syntax MUST extend `@codemirror/lang-markdown` with JSX support

### Section 3.5: Preview Architecture {#arch-preview}

- Preview MUST render in sandboxed iframe with `sandbox="allow-scripts"`
- MDX compilation MUST run in Web Worker (MUST NOT block UI thread)
- Communication MUST use postMessage only (no direct DOM access)
- Components MUST be explicitly whitelisted and registered

**Content Security Policy for preview iframe**:

```
default-src 'none';
script-src 'self' blob:;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
```

## Article IV: Plugin Architecture {#plugins}

### Section 4.1: Tiered Security Model {#plugins-tiers}

**TIER 1 — Sandboxed (no permissions)**:
- Scope: CodeMirror extensions, themes, MDX components
- Runtime: Renderer process, NO Node.js access
- Distribution: npm packages, loaded dynamically
- User consent: Not required (inherently safe)

**TIER 2 — Permissioned (capability-gated)**:
- Scope: File operations, network requests, shell commands
- Runtime: Isolated worker with IPC capability bridge
- Capabilities granted individually, not globally
- User consent: REQUIRED at install, per-capability

**TIER 3 — Trusted (full access)**:
- Scope: Full Node.js, native modules
- Runtime: Main process
- Eligibility: First-party or security-audited ONLY
- User consent: REQUIRED with explicit warning

### Section 4.2: File Path Scoping (Tier 2) {#plugins-paths}

Tier 2 file access MUST be limited to:
- Workspace root and descendants
- `~/.mdxpad/plugin-data/<plugin-id>/`
- System temp directory for transient files

Path traversal attempts (`../`) MUST be rejected. Symlinks MUST resolve and re-validate.

### Section 4.3: Plugin Distribution {#plugins-dist}

- MUST use npm with keyword `mdxpad-plugin`
- MUST include manifest in package.json under `mdxpad` field
- Manifest MUST declare: id, version, tier, permissions[], contributes{}

### Section 4.4: Version-Scoped Roadmap {#plugins-roadmap}

| Version | Plugin Scope |
|---------|--------------|
| v0.1 MVP | NO plugin system. Bundled extensions only. |
| v1.0 | Tier 1 plugins. Local loading from `~/.mdxpad/plugins/` |
| v1.5 | Tier 1 npm distribution. Built-in registry UI. |
| v2.0 | Tier 2 plugins. Permission UI. Security audit process. |
| v3.0+ | Tier 3 plugins. Partner/audit program only. |

MUST NOT over-engineer plugin infrastructure ahead of this roadmap.

## Article V: Performance Budgets {#perf}

These are HARD LIMITS. Exceeding any budget blocks merge until resolved.

| Metric | Budget | Measurement |
|--------|--------|-------------|
| Cold start | < 2 seconds | M1 MacBook Air, Release build |
| Keystroke latency | < 16ms | p99, 10K char document |
| File open (1MB) | < 500ms | Time to interactive |
| File open (10MB) | < 2 seconds | Time to interactive |
| MDX preview compile | < 500ms | Typical document (~500 lines) |
| Memory (idle) | < 200MB | Single document open |
| Renderer bundle | < 5MB | gzipped |

**ENFORCEMENT**: Feature 000 MUST include performance benchmark harness. CI MUST run benchmarks.
Regressions >10% block merge.

**ESCALATION**: If baseline implementation exceeds any budget by >50%, halt and escalate for
architecture review before proceeding.

## Article VI: Code Quality {#quality}

### Section 6.1: TypeScript Requirements {#quality-ts}

- `strict: true` in tsconfig — NO EXCEPTIONS
- No `any` type without `// @ts-expect-error: <reason>` comment
- All public APIs MUST have JSDoc with @param, @returns
- @example REQUIRED for utility functions, OPTIONAL for React components
- Types MUST be exported alongside implementations

### Section 6.2: Code Limits {#quality-limits}

These are HARD LIMITS:
- Functions: Maximum 50 lines. Refactor if exceeded.
- Files: Maximum 400 lines. Split if exceeded.
- Cyclomatic complexity: Maximum 10 per function.

### Section 6.3: Code Style {#quality-style}

- ESLint flat config + Prettier MUST be enforced in CI
- No ESLint disables without `// eslint-disable-next-line <rule> -- <reason>`
- Use composition and functions. Class inheritance ONLY for framework requirements
  (e.g., Error subclasses).

### Section 6.4: Testing Requirements {#quality-testing}

- Unit coverage MUST be >80% for business logic (`src/renderer/lib/`, `src/shared/`)
- Integration tests REQUIRED for all IPC channels
- E2E tests REQUIRED for: open file, edit, save, preview render, theme switch
- Tests MUST be colocated: `feature.ts` + `feature.test.ts` in same directory

## Article VII: User Experience {#ux}

### Section 7.1: Platform Integration {#ux-platform}

- MUST follow macOS Human Interface Guidelines
- MUST support system light/dark mode via CSS `prefers-color-scheme`
- MUST respect `prefers-reduced-motion` for animations
- Native menu bar MUST use Electron Menu API (not custom HTML menus)

### Section 7.2: Accessibility {#ux-a11y}

- Keyboard navigation REQUIRED for all features
- Focus indicators MUST be visible
- Color MUST NOT be sole indicator of state
- Minimum contrast ratio: 4.5:1 (WCAG AA)

### Section 7.3: Error Handling {#ux-errors}

- User-facing errors MUST be actionable and clear (no stack traces, no jargon)
- Technical errors MUST be logged, not displayed
- Graceful degradation over hard failures
- Auto-save MUST prevent data loss (minimum every 30 seconds if dirty)

## Article VIII: Development Workflow {#workflow}

### Section 8.1: Git Conventions {#workflow-git}

- `main` branch MUST always be deployable
- Feature branches: `feat/NNN-description` (NNN = spec number)
- Conventional commits REQUIRED: `type(scope): description`
- Squash merge to main

### Section 8.2: Task-Based Commits {#workflow-commits}

Each task (T001, T002, etc.) MUST get its own commit.

Format: `type(scope): description [TNNN]`

Example: `feat(editor): add MDX syntax highlighting [T003]`

### Section 8.3: Code Review {#workflow-review}

- All changes MUST go through PR
- CI MUST pass before merge
- Self-review checklist MUST be completed

## Article IX: Constitution Compliance {#compliance}

### Section 9.1: Plan Verification {#compliance-plan}

Every `/speckit.plan` output MUST include a "Constitution Compliance" section:

```markdown
## Constitution Compliance

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| III | contextIsolation: true | PASS | |
| V | Cold start < 2s | TBD | Will validate in T001 |
| ... | ... | ... | ... |
```

### Section 9.2: Implementation Checkpoints {#compliance-impl}

Before any `/speckit.implement`, agent MUST verify:

1. Does the plan reference specific constitutional articles?
2. Are all MUST requirements addressed?
3. Are any SHOULD requirements being skipped? If so, is justification documented?
4. Does implementation stay within Deferred Decisions boundaries?

If ANY answer is NO, halt and surface to user.

### Section 9.3: Conflict Resolution {#compliance-conflicts}

When implementation cannot meet a constitutional requirement:

1. STOP implementation immediately
2. Surface the specific conflict to user
3. Wait for user decision: amend constitution OR change approach
4. MUST NOT proceed with known violation

## Article X: Deferred Decisions {#deferred}

The following are EXPLICITLY OUT OF SCOPE. Do not design for them. Do not add abstractions to
support them. They are intentionally deferred.

| Feature | Deferred Until | Rationale |
|---------|---------------|-----------|
| Auto-update mechanism | v1.5+ | Ship manually first |
| Cross-platform (Windows/Linux) | v3.0+ | macOS-first, validate market |
| Tier 2/3 plugin system | v2.0+ | Validate Tier 1 demand first |
| Cloud sync | v2.0+ | Local-first MVP |
| Collaborative editing | v3.0+ | Complexity too high for v1 |
| Mobile/tablet support | Never (separate product) | Different UX paradigm |
| Plugin monetization | v3.0+ | Build ecosystem first |

If a `/speckit.specify` requests a deferred feature, respond: "This feature is constitutionally
deferred to [version]. Proceeding requires constitution amendment."

## Article XI: Bootstrapping {#bootstrap}

Every project MUST begin with Feature 000 (Foundational Setup) before any product features.

**Feature 000 MUST establish**:
- Project scaffolding per Article II technology stack
- Build pipeline (dev, build, test, lint commands)
- Electron security configuration per Section 3.2
- IPC bridge pattern per Section 3.3
- Performance benchmark harness per Article V
- CI pipeline with lint, test, build, benchmark stages
- Basic window rendering "mdxpad" title with blank React app

**Feature 000 is COMPLETE when**:
- `pnpm dev` launches Electron window with React app
- `pnpm test` passes (with at least one placeholder test)
- `pnpm build` produces working .app bundle
- `pnpm bench` runs performance baseline
- All Article III security requirements verified

## Article XII: Amendment Process {#amendments}

The constitution MAY be amended when:

1. Requirements genuinely change (not just inconvenient)
2. Technical landscape shifts (dependency deprecation, security advisory)
3. User feedback reveals invalid assumptions

**Amendment procedure**:

1. Written proposal with rationale
2. Impact analysis on existing specs/code
3. Migration plan if breaking
4. Log in `.specify/memory/constitution-changelog.md`

**Format for changelog**:

```markdown
## [1.0.1] - 2025-01-15
### Changed
- Article V: Relaxed cold start budget from 2s to 2.5s
### Rationale
- Electron 28 + React 19 baseline measured at 2.3s; optimization deferred to v1.1
### Impact
- No code changes required
```

## Governance {#governance}

- Constitution SUPERSEDES all other project documentation
- If specification conflicts with constitution, constitution wins
- If plan conflicts with constitution, constitution wins
- Agents MUST cite constitutional articles when making architectural decisions
- Deviations MUST be documented with rationale and user approval

**Version**: 1.1.0 | **Ratified**: 2025-12-30 | **Last Amended**: 2025-12-30

## Glossary {#glossary}

| Term | Definition |
|------|------------|
| **Tier 1 Plugin** | Sandboxed extension running in renderer with no Node.js access |
| **Tier 2 Plugin** | Permissioned extension with capability-gated IPC access |
| **Tier 3 Plugin** | Trusted extension with full Node.js access (first-party only) |
| **contextIsolation** | Electron security feature separating preload from renderer |
| **IPC** | Inter-Process Communication between Electron main and renderer |
| **MDX** | Markdown + JSX, allowing React components in Markdown documents |
