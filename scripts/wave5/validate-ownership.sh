#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/wave5/common.sh
source "$SCRIPT_DIR/common.sh"

wave5_assert_git_repo
ROOT="$(wave5_repo_root)"
cd "$ROOT"

SESSION="${1:-}"
BASE_BRANCH="${2:-$(wave5_default_integration_branch)}"

if [[ -z "$SESSION" ]]; then
  echo "usage: $0 <session: s1|s2|s3|s4|s5> [base-branch]" >&2
  exit 2
fi

ALLOWED=()
while IFS= read -r line; do
  ALLOWED+=("$line")
done < <(wave5_session_prefixes "$SESSION")

tmp_file="$(mktemp)"
git diff --name-only "${BASE_BRANCH}...HEAD" >>"$tmp_file"
git diff --name-only >>"$tmp_file"
git diff --name-only --cached >>"$tmp_file"
git ls-files --others --exclude-standard >>"$tmp_file"

CHANGED=()
while IFS= read -r line; do
  [[ -n "$line" ]] && CHANGED+=("$line")
done < <(sort -u "$tmp_file")
rm -f "$tmp_file"

if [[ "${#CHANGED[@]}" -eq 0 ]]; then
  echo "No changes against ${BASE_BRANCH}; ownership check passed."
  exit 0
fi

violations=()

for file in "${CHANGED[@]}"; do
  allowed=false

  # Test files are globally editable to avoid blocking coverage updates.
  if [[ "$file" == tests/* ]] || [[ "$file" == *".test.ts" ]] || [[ "$file" == *".test.tsx" ]] || [[ "$file" == *"/__tests__/"* ]]; then
    allowed=true
  fi

  for prefix in "${ALLOWED[@]}"; do
    if [[ "$file" == "$prefix" ]] || [[ "$file" == "$prefix/"* ]]; then
      allowed=true
      break
    fi
  done
  if [[ "$allowed" == false ]]; then
    violations+=("$file")
  fi
done

if [[ "${#violations[@]}" -gt 0 ]]; then
  echo "Ownership violations for session ${SESSION}:"
  printf ' - %s\n' "${violations[@]}"
  exit 1
fi

echo "Ownership check passed for ${SESSION}."
printf ' - %s\n' "${CHANGED[@]}"
