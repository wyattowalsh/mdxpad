#!/usr/bin/env bash
set -euo pipefail

wave4_repo_root() {
  git rev-parse --show-toplevel
}

wave4_assert_git_repo() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
    echo "error: this command must run inside a git repository" >&2
    exit 1
  }
}

wave4_default_integration_branch() {
  echo "codex/wave4-integration"
}

wave4_merge_order() {
  cat <<'EOF'
codex/wave4-s1-foundation
codex/wave4-s2-reliability
codex/wave4-s4-templates
codex/wave4-s3-ai
codex/wave4-s5-ux-extensibility
EOF
}

wave4_worktree_rows() {
  cat <<'EOF'
/Users/ww/dev/worktrees/mdxpad-s1 codex/wave4-s1-foundation
/Users/ww/dev/worktrees/mdxpad-s2 codex/wave4-s2-reliability
/Users/ww/dev/worktrees/mdxpad-s3 codex/wave4-s3-ai
/Users/ww/dev/worktrees/mdxpad-s4 codex/wave4-s4-templates
/Users/ww/dev/worktrees/mdxpad-s5 codex/wave4-s5-ux-extensibility
EOF
}

wave4_session_prefixes() {
  local session="$1"
  case "$session" in
    s1 | S1 | codex/wave4-s1-foundation)
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
docs/wave4
scripts/wave4
EOF
      ;;
    s2 | S2 | codex/wave4-s2-reliability)
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
    s3 | S3 | codex/wave4-s3-ai)
      cat <<'EOF'
src/main/services/ai
src/main/ipc/ai-handlers.ts
src/shared/ai
src/renderer/features/ai-provider
EOF
      ;;
    s4 | S4 | codex/wave4-s4-templates)
      cat <<'EOF'
src/main/services/template-service.ts
src/main/ipc/template-handlers.ts
src/renderer/components/template-browser
src/renderer/stores/template-store.ts
src/renderer/lib/template-variables.ts
EOF
      ;;
    s5 | S5 | codex/wave4-s5-ux-extensibility)
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

wave4_run() {
  echo "+ $*"
  "$@"
}

