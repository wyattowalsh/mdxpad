# Quickstart Guide: mdxpad Development

**Feature**: 000-foundational-setup | **Date**: 2025-12-30

## Prerequisites

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| macOS | 13+ (Ventura) | `sw_vers` |
| Node.js | 22.x LTS | `node --version` |
| pnpm | 10.x | `pnpm --version` |
| Git | 2.x | `git --version` |

### Installing Prerequisites

```bash
# Install Node.js 22 via nvm (recommended)
nvm install 22
nvm use 22

# Install pnpm
corepack enable
corepack prepare pnpm@latest --activate

# Verify
node --version   # v22.x.x
pnpm --version   # 10.x.x
```

## Getting Started

### 1. Clone and Install

```bash
git clone <repository-url> mdxpad
cd mdxpad
pnpm install
```

### 2. Development Mode

```bash
pnpm dev
```

This launches:
- Vite dev server with HMR for renderer
- Electron main process with hot reload
- TypeScript type checking in watch mode

**Expected**: Electron window opens with "mdxpad" title and React shell.

### 3. Verify Setup

```bash
# Run all quality gates
pnpm typecheck    # TypeScript strict mode
pnpm lint         # ESLint + Prettier
pnpm test         # Vitest unit tests
pnpm build        # Production build
pnpm verify-security  # Security settings check
```

All commands should pass with zero errors.

## Project Structure

```
mdxpad/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # App entry, lifecycle
│   │   ├── window.ts   # BrowserWindow factory
│   │   └── ipc/        # IPC handlers
│   │
│   ├── renderer/       # React UI (sandboxed)
│   │   ├── index.html  # HTML entry
│   │   ├── main.tsx    # React entry
│   │   ├── App.tsx     # Root component
│   │   └── styles/     # Tailwind + tokens
│   │
│   ├── preload/        # contextBridge scripts
│   │   ├── index.ts    # Bridge setup
│   │   └── api.ts      # MdxpadAPI interface
│   │
│   └── shared/         # Cross-process utilities
│       ├── lib/        # Result, events, ipc
│       └── types/      # Shared type definitions
│
├── scripts/            # Build and CI scripts
│   ├── bench.ts        # Performance benchmarks
│   └── verify-security.ts
│
└── tests/              # E2E tests (Playwright)
    └── app.spec.ts
```

## Key Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development mode |
| `pnpm build` | Build production .app |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run E2E tests |
| `pnpm typecheck` | TypeScript validation |
| `pnpm lint` | ESLint + Prettier |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm bench` | Run performance benchmarks |
| `pnpm verify-security` | Validate Electron security |

## Development Workflow

### Making Changes

1. **Renderer changes** (React, styles): Auto-reload via HMR
2. **Main process changes**: Requires restart (Ctrl+C, `pnpm dev`)
3. **Preload changes**: Requires restart
4. **Shared changes**: May require restart depending on usage

### Before Committing

```bash
# Run all checks
pnpm typecheck && pnpm lint && pnpm test

# Or use the combined check
pnpm check
```

### Commit Message Format

Per constitution §8.1, use conventional commits:

```
type(scope): description [TNNN]

# Examples:
feat(editor): add MDX syntax highlighting [T003]
fix(ipc): validate response schemas [T005]
docs(readme): update installation steps
```

## Debugging

### Main Process

```bash
# Launch with DevTools for main process
ELECTRON_ENABLE_LOGGING=1 pnpm dev
```

### Renderer Process

- DevTools opens automatically in dev mode
- Or press `Cmd+Option+I` in the app window

### IPC Communication

```typescript
// Add to main/ipc/index.ts for debugging
ipcMain.handle('*', (event, channel, ...args) => {
  console.log(`IPC: ${channel}`, args);
});
```

## Common Issues

### "Cannot find module 'electron'"

```bash
# Rebuild native modules
pnpm rebuild
```

### Hot reload not working

```bash
# Clear Vite cache
rm -rf node_modules/.vite
pnpm dev
```

### TypeScript errors after dependency update

```bash
# Regenerate types
pnpm typecheck --build --force
```

### E2E tests failing to launch

```bash
# Install Playwright browsers
pnpm exec playwright install
```

## Performance Targets

Per constitution Article V:

| Metric | Budget | Measurement |
|--------|--------|-------------|
| Cold start | < 2s | `pnpm bench` |
| Memory (idle) | < 200MB | `pnpm bench` |

Run `pnpm bench` to verify. Results saved to `.specify/baselines/bench.json`.

## Security Requirements

Per constitution Article III, these settings are **non-negotiable**:

```javascript
// In src/main/window.ts - DO NOT MODIFY
webPreferences: {
  contextIsolation: true,   // REQUIRED
  sandbox: true,            // REQUIRED
  nodeIntegration: false,   // REQUIRED
  webSecurity: true,        // REQUIRED
}
```

Run `pnpm verify-security` to validate. This runs in CI and blocks merge if violated.

## Next Steps

After Spec 000 is complete:

1. **Spec 001**: CodeMirror 6 editor integration
2. **Spec 002**: MDX compilation and preview
3. **Spec 003**: File system operations

See `.specify/specs/` for detailed specifications.

## Getting Help

- **Constitution**: `.specify/memory/constitution.md`
- **This Spec**: `.specify/specs/000-foundational-setup/spec.md`
- **Plan**: `.specify/specs/000-foundational-setup/plan.md`
