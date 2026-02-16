#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/wave5/common.sh
source "$SCRIPT_DIR/common.sh"

wave5_assert_git_repo
ROOT="$(wave5_repo_root)"
cd "$ROOT"

SESSION="${1:-}"
INTEGRATION_BRANCH="${2:-$(wave5_default_integration_branch)}"

if [[ -z "$SESSION" ]]; then
  echo "usage: $0 <session: s1|s2|s3|s4|s5|branch> [integration-branch]" >&2
  exit 2
fi

case "$SESSION" in
  s1 | S1) target_branch="codex/wave5-s1-foundation" ;;
  s2 | S2) target_branch="codex/wave5-s2-reliability" ;;
  s3 | S3) target_branch="codex/wave5-s3-ai" ;;
  s4 | S4) target_branch="codex/wave5-s4-templates" ;;
  s5 | S5) target_branch="codex/wave5-s5-ux-extensibility" ;;
  *) target_branch="$SESSION" ;;
esac

wave5_run git fetch origin || true
wave5_run git switch "$target_branch"
wave5_run git rebase "$INTEGRATION_BRANCH"

echo "Rebase completed for ${target_branch} onto ${INTEGRATION_BRANCH}."

