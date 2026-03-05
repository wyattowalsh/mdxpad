# Hardening & Rehearsal

This runbook adds opt-in rehearsal checks for Wave 3 hardening work without changing default push/PR CI behavior.

## Local Rehearsal Commands

### 0) CI-aligned quality/security preflight

```bash
pnpm verify-lockfiles
pnpm verify-actions-pinning
pnpm verify-audit-baseline
pnpm check:quality-gates
```

`pnpm check:quality-gates` runs policy checks + typecheck/lint/tests in one pass and is the preferred release gate command.

### 1) Fault-injection and hardening checks

```bash
pnpm rehearse:hardening
```

This runs:

- recovery integrity rehearsal (`src/main/services/__tests__/recovery-service.test.ts`) including checksum/corruption flows
- message validation rehearsal (`src/shared/security/__tests__/message-validator.test.ts`)
- static security verification (`pnpm verify-security -- --static-only`)

To include runtime Electron security probing (requires `dist/main/index.js`):

```bash
pnpm build
pnpm rehearse:hardening -- --runtime-security
```

### 2) Release path rehearsal (arch + signing/notarization readiness)

```bash
pnpm rehearse:release -- --arch arm64
pnpm rehearse:release -- --arch x64
```

By default this validates architecture artifacts and reports missing signing/notarization secrets as warnings.
Use `--require-secrets` when rehearsing full signed/notarized release readiness.

## CI Rehearsal Workflow (Manual / Opt-in)

Use `.github/workflows/rehearsals.yml` via **workflow_dispatch**:

- `run_hardening_rehearsal` (default `true`)
- `run_runtime_security_probe` (default `false`)
- `run_release_rehearsal` (default `true`)
- `require_release_secrets` (default `false`)

This keeps default CI runs stable while allowing on-demand drills.

## Rollback Drill (Workflow-aligned)

Use this when a rehearsal uncovers a release-blocking regression:

1. Create a rollback candidate branch and revert target commits (`git revert --no-commit <sha...>`).
2. Run gates + rehearsal checks locally:
   - `pnpm check:quality-gates`
   - `pnpm rehearse:hardening`
3. If results are clean, finalize the revert commit and push through normal CI/merge gates.
4. If results are not clean, reset (`git reset --hard HEAD`) and adjust rollback scope before retrying.
