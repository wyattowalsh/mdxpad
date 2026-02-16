#!/usr/bin/env bash
set -euo pipefail

wave5_repo_root() {
  git rev-parse --show-toplevel
}

wave5_assert_git_repo() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
    echo "error: this command must run inside a git repository" >&2
    exit 1
  }
}

wave5_default_integration_branch() {
  echo "codex/wave5-integration"
}

wave5_merge_order() {
  cat <<'EOF'
codex/wave5-s1-foundation
codex/wave5-s2-reliability
codex/wave5-s4-templates
codex/wave5-s3-ai
codex/wave5-s5-ux-extensibility
EOF
}

wave5_worktree_rows() {
  cat <<'EOF'
/Users/ww/dev/worktrees/mdxpad-wave5-s1 codex/wave5-s1-foundation
/Users/ww/dev/worktrees/mdxpad-wave5-s2 codex/wave5-s2-reliability
/Users/ww/dev/worktrees/mdxpad-wave5-s3 codex/wave5-s3-ai
/Users/ww/dev/worktrees/mdxpad-wave5-s4 codex/wave5-s4-templates
/Users/ww/dev/worktrees/mdxpad-wave5-s5 codex/wave5-s5-ux-extensibility
EOF
}

wave5_session_prefixes() {
  local session="$1"
  case "$session" in
    s1 | S1 | codex/wave5-s1-foundation)
      cat <<'EOF'
package.json
pnpm-lock.yaml
eslint.config.js
vitest.config.ts
playwright.config.ts
electron.vite.config.ts
.github/workflows/ci.yml
scripts/bench.ts
src/renderer/App.tsx
docs/wave5
scripts/wave5
EOF
      ;;
    s2 | S2 | codex/wave5-s2-reliability)
      cat <<'EOF'
src/renderer/hooks/use-autosave.ts
src/renderer/hooks/use-recovery-check.ts
src/renderer/hooks/use-recovery-cleanup.ts
src/renderer/components/recovery-dialog.tsx
src/renderer/components/conflict-dialog.tsx
src/renderer/components/settings-panel.tsx
src/main/window.ts
src/main/ipc/window-handlers.ts
src/renderer/commands/file-commands.ts
src/preload/api.ts
src/preload/index.ts
EOF
      ;;
    s3 | S3 | codex/wave5-s3-ai)
      cat <<'EOF'
src/main/services/ai
src/main/ipc/ai-handlers.ts
src/shared/ai
src/renderer/features/ai-provider
EOF
      ;;
    s4 | S4 | codex/wave5-s4-templates)
      cat <<'EOF'
src/main/services/template-service.ts
src/main/ipc/template-handlers.ts
src/renderer/components/template-browser
src/renderer/stores/template-store.ts
src/renderer/lib/template-variables.ts
EOF
      ;;
    s5 | S5 | codex/wave5-s5-ux-extensibility)
      cat <<'EOF'
src/renderer/components/file-explorer
src/renderer/components/outline
src/renderer/hooks/useScrollSync.ts
src/renderer/stores/outline-store.ts
src/shared/types/outline.ts
.specify/specs/029-plugin-extension-system
src/shared/contracts/extension-manifest.ts
EOF
      ;;
    *)
      echo "error: unknown session '$session'. expected: s1|s2|s3|s4|s5" >&2
      return 1
      ;;
  esac
}

wave5_run() {
  echo "+ $*"
  "$@"
}
