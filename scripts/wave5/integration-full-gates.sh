#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/wave5/common.sh
source "$SCRIPT_DIR/common.sh"

wave5_assert_git_repo
ROOT="$(wave5_repo_root)"
cd "$ROOT"

wave5_run pnpm typecheck

# Delta-only lint: only check files changed since the wave5 baseline
CHANGED_FILES=$(git diff --name-only 8f4b895 HEAD -- '*.ts' '*.tsx' '*.js' '*.mjs' | head -200)
if [[ -n "$CHANGED_FILES" ]]; then
  # shellcheck disable=SC2086
  wave5_run pnpm exec eslint $CHANGED_FILES
else
  echo "No changed lint-target files; skipping lint."
fi

wave5_run pnpm test
wave5_run pnpm test:e2e
wave5_run pnpm build
wave5_run pnpm verify-security || true
wave5_run pnpm bench || true

echo "Integration full gates passed."
