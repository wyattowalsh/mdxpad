#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/wave4/common.sh
source "$SCRIPT_DIR/common.sh"

wave4_assert_git_repo
ROOT="$(wave4_repo_root)"
cd "$ROOT"

INTEGRATION_BRANCH="${1:-$(wave4_default_integration_branch)}"
FREEZE_TAG="${2:-wave4-freeze-2026-02-15}"

if git remote get-url origin >/dev/null 2>&1; then
  wave4_run git fetch origin
fi

wave4_run git switch codex/wave3-integration
if git rev-parse --verify --quiet origin/codex/wave3-integration >/dev/null; then
  wave4_run git pull --ff-only origin codex/wave3-integration
fi

if git rev-parse --verify --quiet "$INTEGRATION_BRANCH" >/dev/null; then
  wave4_run git switch "$INTEGRATION_BRANCH"
else
  wave4_run git switch -c "$INTEGRATION_BRANCH"
fi

if git rev-parse --verify --quiet "refs/tags/$FREEZE_TAG" >/dev/null; then
  echo "tag exists: $FREEZE_TAG"
else
  wave4_run git tag "$FREEZE_TAG"
fi

mkdir -p /Users/ww/dev/worktrees

while read -r wt_dir wt_branch; do
  [[ -z "$wt_dir" ]] && continue
  if [[ -e "$wt_dir/.git" ]]; then
    echo "worktree exists: $wt_dir"
    continue
  fi
  if git rev-parse --verify --quiet "$wt_branch" >/dev/null; then
    wave4_run git worktree add "$wt_dir" "$wt_branch"
  else
    wave4_run git worktree add "$wt_dir" -b "$wt_branch" "$INTEGRATION_BRANCH"
  fi
done < <(wave4_worktree_rows)

echo
echo "Wave 4 bootstrap complete."
wave4_run git worktree list
wave4_run git branch --list 'codex/wave4-*'

