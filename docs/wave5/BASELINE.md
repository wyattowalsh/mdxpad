# Wave 5 Baseline Evidence (2026-02-16)

This file captures Wave 5 setup evidence and baseline gate results for the integration branch.

## Topology Evidence

Repository state during setup:

```bash
$ git rev-parse --abbrev-ref HEAD
codex/wave5-integration

$ git rev-parse --short HEAD
e417f59

$ git show-ref --tags wave5-freeze-2026-02-16
e417f5953f6d6b3d0877e20a8149a2d2fde43e95 refs/tags/wave5-freeze-2026-02-16
```

Wave 5 branch and worktree topology:

```bash
$ git branch --list 'codex/wave5-*'
* codex/wave5-integration
+ codex/wave5-s1-foundation
+ codex/wave5-s2-reliability
+ codex/wave5-s3-ai
+ codex/wave5-s4-templates
+ codex/wave5-s5-ux-extensibility

$ git worktree list
/Users/ww/dev/projects/mdxpad            e417f59 [codex/wave5-integration]
/Users/ww/dev/worktrees/mdxpad-wave5-s1  e417f59 [codex/wave5-s1-foundation]
/Users/ww/dev/worktrees/mdxpad-wave5-s2  e417f59 [codex/wave5-s2-reliability]
/Users/ww/dev/worktrees/mdxpad-wave5-s3  e417f59 [codex/wave5-s3-ai]
/Users/ww/dev/worktrees/mdxpad-wave5-s4  e417f59 [codex/wave5-s4-templates]
/Users/ww/dev/worktrees/mdxpad-wave5-s5  e417f59 [codex/wave5-s5-ux-extensibility]
```

## Baseline Gate Matrix

All command logs are stored in `/Users/ww/dev/projects/mdxpad/docs/wave5/baseline/`.

| Command | Exit Code | Result |
| --- | ---: | --- |
| `pnpm typecheck` | `0` | PASS |
| `pnpm lint` | `1` | FAIL (continued by design) |
| `pnpm test` | `0` | PASS |
| `pnpm test:e2e` | `0` | PASS |
| `gtimeout 90s pnpm verify-security` | `124` | TIMEBOXED (continued by design) |
| `gtimeout 90s pnpm bench` | `124` | TIMEBOXED (continued by design) |

## Command Output Excerpts

### 1) `pnpm typecheck` (`docs/wave5/baseline/01-typecheck.log`)

```text
$ pnpm typecheck
> mdxpad@0.1.0 typecheck /Users/ww/dev/projects/mdxpad
> tsc --noEmit
exit_code: 0
```

### 2) `pnpm lint || true` (`docs/wave5/baseline/02-lint.log`)

```text
✖ 683 problems (679 errors, 4 warnings)
84 errors and 2 warnings potentially fixable with the --fix option.
ELIFECYCLE Command failed with exit code 1.
exit_code: 1
```

### 3) `pnpm test` (`docs/wave5/baseline/03-test.log`)

```text
Test Files  66 passed (66)
Tests  2506 passed | 12 skipped (2518)
Duration  12.17s
exit_code: 0
```

### 4) `pnpm test:e2e` (`docs/wave5/baseline/04-test-e2e.log`)

```text
5 skipped
79 passed (2.5m)
exit_code: 0
```

### 5) `gtimeout 90s pnpm verify-security || true` (`docs/wave5/baseline/05-verify-security-timeboxed.log`)

```text
Security Settings:
  contextIsolation: ✓ (true)
  sandbox:          ✓ (true)
  nodeIntegration:  ✓ (false)
  webSecurity:      ✓ (true)
✓ All security settings verified successfully!
Security verification complete.
exit_code: 124
```

### 6) `gtimeout 90s pnpm bench || true` (`docs/wave5/baseline/06-bench-timeboxed.log`)

```text
exit_code: 124
Benchmark failed with error: page.waitForSelector: Timeout 30000ms exceeded.
waiting for locator('text=Version') to be visible
```

## Known Blockers

1. Baseline lint is red with `683` findings (`679` errors, `4` warnings), so `pnpm lint` currently fails without changes.
2. Security verification reached a successful settings check but still returned `124` under 90s timeout, indicating the process does not exit quickly enough for the timebox.
3. Bench failed under timebox (`124`) with `TimeoutError` waiting for `text=Version` in `scripts/bench.ts`.
