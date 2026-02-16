#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/wave5/common.sh
source "$SCRIPT_DIR/common.sh"

wave5_assert_git_repo
ROOT="$(wave5_repo_root)"
cd "$ROOT"

FORCE=0
if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
fi

while read -r wt_dir wt_branch; do
  [[ -z "$wt_dir" ]] && continue
  if [[ ! -e "$wt_dir/.git" ]]; then
    echo "skip missing worktree: $wt_dir"
    continue
  fi

  if [[ "$FORCE" -eq 0 ]]; then
    dirty="$(git -C "$wt_dir" status --porcelain)"
    if [[ -n "$dirty" ]]; then
      echo "error: worktree has uncommitted changes: $wt_dir" >&2
      echo "$dirty" >&2
      exit 1
    fi
    wave5_run git worktree remove "$wt_dir"
  else
    wave5_run git worktree remove --force "$wt_dir"
  fi
done < <(wave5_worktree_rows)

while read -r _wt_dir wt_branch; do
  [[ -z "$wt_branch" ]] && continue
  if git rev-parse --verify --quiet "$wt_branch" >/dev/null; then
    if [[ "$FORCE" -eq 0 ]]; then
      wave5_run git branch -d "$wt_branch"
    else
      wave5_run git branch -D "$wt_branch"
    fi
  fi
done < <(wave5_worktree_rows)

echo "Wave 5 cleanup completed."

