#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/wave5/common.sh
source "$SCRIPT_DIR/common.sh"

wave5_assert_git_repo
ROOT="$(wave5_repo_root)"
cd "$ROOT"

INTEGRATION_BRANCH="${1:-$(wave5_default_integration_branch)}"
FREEZE_TAG="${2:-wave5-freeze-2026-02-16}"

if git remote get-url origin >/dev/null 2>&1; then
  wave5_run git fetch origin
fi

wave5_run git switch main
if git rev-parse --verify --quiet origin/main >/dev/null; then
  wave5_run git pull --ff-only origin main
fi

if git rev-parse --verify --quiet "$INTEGRATION_BRANCH" >/dev/null; then
  wave5_run git switch "$INTEGRATION_BRANCH"
else
  wave5_run git switch -c "$INTEGRATION_BRANCH"
fi

if git rev-parse --verify --quiet "refs/tags/$FREEZE_TAG" >/dev/null; then
  echo "tag exists: $FREEZE_TAG"
else
  wave5_run git tag "$FREEZE_TAG"
fi

mkdir -p /Users/ww/dev/worktrees

while read -r wt_dir wt_branch; do
  [[ -z "$wt_dir" ]] && continue
  if [[ -e "$wt_dir/.git" ]]; then
    echo "worktree exists: $wt_dir"
    continue
  fi
  if git rev-parse --verify --quiet "$wt_branch" >/dev/null; then
    wave5_run git worktree add "$wt_dir" "$wt_branch"
  else
    wave5_run git worktree add "$wt_dir" -b "$wt_branch" "$INTEGRATION_BRANCH"
  fi
done < <(wave5_worktree_rows)

echo
echo "Wave 5 bootstrap complete."
wave5_run git worktree list
wave5_run git branch --list 'codex/wave5-*'
