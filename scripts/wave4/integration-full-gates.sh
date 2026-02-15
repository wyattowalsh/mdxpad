#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/wave4/common.sh
source "$SCRIPT_DIR/common.sh"

wave4_assert_git_repo
ROOT="$(wave4_repo_root)"
cd "$ROOT"

wave4_run pnpm typecheck
wave4_run pnpm lint
wave4_run pnpm test
wave4_run pnpm test:e2e
wave4_run pnpm build
wave4_run pnpm verify-security
wave4_run pnpm bench

echo "Integration full gates passed."

