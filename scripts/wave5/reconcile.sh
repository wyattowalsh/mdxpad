#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/wave5/common.sh
source "$SCRIPT_DIR/common.sh"

wave5_assert_git_repo
ROOT="$(wave5_repo_root)"
cd "$ROOT"

INTEGRATION_BRANCH="$(wave5_default_integration_branch)"
RUN_GATES=1

declare -a BRANCHES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      shift
      ;;
    --no-gates)
      RUN_GATES=0
      shift
      ;;
    --integration-branch)
      INTEGRATION_BRANCH="$2"
      shift 2
      ;;
    *)
      BRANCHES+=("$1")
      shift
      ;;
  esac
done

if [[ "${#BRANCHES[@]}" -eq 0 ]]; then
  while IFS= read -r line; do
    BRANCHES+=("$line")
  done < <(wave5_merge_order)
fi

wave5_run git switch "$INTEGRATION_BRANCH"

for branch in "${BRANCHES[@]}"; do
  if ! git rev-parse --verify --quiet "$branch" >/dev/null; then
    echo "skip: branch does not exist: $branch"
    continue
  fi

  if git merge-base --is-ancestor "$branch" HEAD; then
    echo "skip: already merged: $branch"
    continue
  fi

  echo
  echo "=== Merging ${branch} into ${INTEGRATION_BRANCH} ==="
  wave5_run git merge --no-ff --no-edit "$branch"
  merge_sha="$(git rev-parse HEAD)"

  if [[ "$RUN_GATES" -eq 1 ]]; then
    set +e
    bash "$SCRIPT_DIR/integration-full-gates.sh"
    status=$?
    set -e

    if [[ $status -ne 0 ]]; then
      echo "gates failed after merge ${merge_sha}; reverting merge commit"
      wave5_run git revert -m 1 --no-edit "$merge_sha"
      echo "reverted ${merge_sha}; return fixback to owning session branch"
      exit 1
    fi
  fi
done

echo
echo "Wave 5 reconciliation completed."
