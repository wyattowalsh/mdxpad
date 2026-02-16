# Wave 5 Execution Runbook

This runbook operationalizes the Wave 5 model:

- one integration branch: `codex/wave5-integration`
- five isolated session branches/worktrees
- deterministic merge-captain reconciliation with rollback on failed gates

## Setup

```bash
pnpm wave5:bootstrap
```

Bootstrap sequence:

1. `git fetch origin`
2. `git switch main`
3. `git pull --ff-only origin main` (if `origin/main` exists)
4. create/switch `codex/wave5-integration`
5. create tag `wave5-freeze-2026-02-16` (if missing)
6. create/switch session worktrees under `/Users/ww/dev/worktrees`

Session branches/worktrees:

1. `/Users/ww/dev/worktrees/mdxpad-wave5-s1` -> `codex/wave5-s1-foundation`
2. `/Users/ww/dev/worktrees/mdxpad-wave5-s2` -> `codex/wave5-s2-reliability`
3. `/Users/ww/dev/worktrees/mdxpad-wave5-s3` -> `codex/wave5-s3-ai`
4. `/Users/ww/dev/worktrees/mdxpad-wave5-s4` -> `codex/wave5-s4-templates`
5. `/Users/ww/dev/worktrees/mdxpad-wave5-s5` -> `codex/wave5-s5-ux-extensibility`

## Ownership Map

Ownership is enforced by `pnpm wave5:ownership <session>` via `scripts/wave5/common.sh`.

- `s1`: wave orchestration/config shell, app shell, CI/test tooling, `docs/wave5`, `scripts/wave5`
- `s2`: autosave/recovery/settings reliability lane
- `s3`: AI services and renderer AI provider lane
- `s4`: template service/browser lane
- `s5`: file explorer/outline/plugin extension lane
- tests (`tests/*`, `*.test.ts`, `*.test.tsx`, `__tests__`) are globally editable

## Daily Session Cycle

Each session runs:

```bash
pnpm wave5:rebase sN
pnpm wave5:ownership sN
pnpm wave5:session-gates sN
```

Where `sN` is one of `s1..s5`.

## Gates

Session fast gates:

1. ownership scope validation
2. `pnpm typecheck`
3. ownership-scoped lint
4. targeted unit/integration tests
5. targeted e2e (if mapped test file exists)

Integration full gates:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm test:e2e`
5. `pnpm build`
6. `pnpm verify-security`
7. `pnpm bench`

## Merge Order

Default merge order (enforced by `scripts/wave5/common.sh` and used by `pnpm wave5:reconcile`):

1. `codex/wave5-s1-foundation`
2. `codex/wave5-s2-reliability`
3. `codex/wave5-s4-templates`
4. `codex/wave5-s3-ai`
5. `codex/wave5-s5-ux-extensibility`

For each branch:

1. merge with `--no-ff --no-edit`
2. run full integration gates
3. if gates fail, revert merge commit immediately with `git revert -m 1`

## Rollback

If a reconciliation merge fails gates:

1. `pnpm wave5:reconcile` auto-reverts the failed merge commit.
2. Keep the integration branch as the source of truth.
3. Push fixbacks to the owning session branch, rerun session gates, then retry reconciliation.

For manual branch/worktree teardown after completion:

```bash
pnpm wave5:cleanup
```

Force mode (only when needed and safe):

```bash
bash scripts/wave5/cleanup.sh --force
```
