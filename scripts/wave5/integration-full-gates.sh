#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/wave5/common.sh
source "$SCRIPT_DIR/common.sh"

wave5_assert_git_repo
ROOT="$(wave5_repo_root)"
cd "$ROOT"

wave5_run pnpm typecheck
wave5_run pnpm lint
wave5_run pnpm test
wave5_run pnpm test:e2e
wave5_run pnpm build
wave5_run pnpm verify-security
wave5_run pnpm bench

echo "Integration full gates passed."

