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

wave5_run bash "$SCRIPT_DIR/validate-ownership.sh" "$SESSION" "$BASE_BRANCH"
wave5_run pnpm typecheck

PREFIXES=()
while IFS= read -r line; do
  PREFIXES+=("$line")
done < <(wave5_session_prefixes "$SESSION")
lint_targets=()
for p in "${PREFIXES[@]}"; do
  [[ -e "$p" ]] && lint_targets+=("$p")
done

if [[ "${#lint_targets[@]}" -gt 0 ]]; then
  wave5_run pnpm exec eslint "${lint_targets[@]}"
else
  echo "No existing lint targets for session ${SESSION}; skipping lint step."
fi

test_targets=()
e2e_targets=()

case "$SESSION" in
  s1 | S1 | codex/wave5-s1-foundation)
    test_targets+=(
      "src/renderer/__tests__/App.test.tsx"
      "tests/integration/ipc/window-handlers.test.ts"
    )
    ;;
  s2 | S2 | codex/wave5-s2-reliability)
    test_targets+=(
      "src/renderer/hooks/use-autosave.test.ts"
      "src/renderer/hooks/use-recovery-check.test.ts"
      "src/renderer/components/recovery-dialog.test.tsx"
      "src/renderer/components/conflict-dialog.test.tsx"
      "src/renderer/components/settings-panel.test.tsx"
      "tests/integration/autosave-ipc.test.ts"
      "tests/integration/ipc/window-handlers.test.ts"
    )
    e2e_targets+=(
      "tests/e2e/autosave-recovery.spec.ts"
    )
    ;;
  s3 | S3 | codex/wave5-s3-ai)
    test_targets+=(
      "tests/unit/services/ai/credential-service.test.ts"
      "tests/unit/services/ai/provider-service.test.ts"
      "src/renderer/features/ai-provider/__tests__/store.test.ts"
      "src/renderer/features/ai-provider/__tests__/hooks.test.ts"
    )
    ;;
  s4 | S4 | codex/wave5-s4-templates)
    test_targets+=(
      "tests/integration/ipc/template-handlers.test.ts"
      "src/renderer/components/template-browser/TemplateBrowser.test.tsx"
      "src/renderer/stores/template-store.test.ts"
    )
    e2e_targets+=(
      "tests/e2e/template-browser.spec.ts"
    )
    ;;
  s5 | S5 | codex/wave5-s5-ux-extensibility)
    test_targets+=(
      "src/renderer/hooks/useScrollSync.test.ts"
      "src/renderer/components/file-explorer/FileTreeFilter.test.tsx"
      "src/renderer/components/outline/OutlinePanel.test.tsx"
    )
    e2e_targets+=(
      "tests/e2e/file-operations.spec.ts"
    )
    ;;
esac

existing_unit_targets=()
for t in "${test_targets[@]}"; do
  [[ -f "$t" ]] && existing_unit_targets+=("$t")
done

if [[ "${#existing_unit_targets[@]}" -gt 0 ]]; then
  wave5_run pnpm test "${existing_unit_targets[@]}"
else
  echo "No mapped unit/integration tests exist for session ${SESSION}; running full test suite fallback."
  wave5_run pnpm test
fi

existing_e2e_targets=()
for t in "${e2e_targets[@]}"; do
  [[ -f "$t" ]] && existing_e2e_targets+=("$t")
done

if [[ "${#existing_e2e_targets[@]}" -gt 0 ]]; then
  wave5_run pnpm test:e2e "${existing_e2e_targets[@]}"
else
  echo "No mapped e2e targets for session ${SESSION}; skipping targeted e2e."
fi

echo "Session fast gates passed for ${SESSION}."
