# Wave 4 Execution Runbook

This runbook operationalizes the Wave 4 model:

- one integration branch: `codex/wave4-integration`
- five isolated session branches/worktrees
- deterministic merge-captain reconciliation with rollback on failed gates

## Bootstrap

```bash
pnpm wave4:bootstrap
```

This command:

1. syncs `codex/wave3-integration` (if remote exists)
2. creates/switches `codex/wave4-integration`
3. creates tag `wave4-freeze-2026-02-15` (if missing)
4. creates the five worktrees and session branches if missing

## Daily Session Cycle

Each session runs:

```bash
pnpm wave4:rebase sN
pnpm wave4:ownership sN
pnpm wave4:session-gates sN
```

Where `sN` is one of `s1..s5`.

## Reconciliation (S1 Merge Captain)

```bash
pnpm wave4:reconcile
```

Default merge order:

1. `codex/wave4-s1-foundation`
2. `codex/wave4-s2-reliability`
3. `codex/wave4-s4-templates`
4. `codex/wave4-s3-ai`
5. `codex/wave4-s5-ux-extensibility`

For each merged branch:

1. merge commit via `--no-ff`
2. full integration gates run
3. on failure, merge commit is immediately reverted with `git revert -m 1`

## Gates

Session fast gates:

1. `pnpm typecheck`
2. ownership-scoped lint
3. targeted tests
4. targeted e2e where mapped

Integration full gates:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm test:e2e`
5. `pnpm build`
6. `pnpm verify-security`
7. `pnpm bench`

## Cleanup

After wave completion:

```bash
pnpm wave4:cleanup
```

Use force mode only if needed:

```bash
bash scripts/wave4/cleanup.sh --force
```

## Notes

- The ownership map is embedded in `scripts/wave4/common.sh`.
- The reliability lane includes preload settings API ownership because it is required for settings canonicalization.
- `docs/wave4` and `scripts/wave4` are intentionally mapped to S1.

