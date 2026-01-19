# Parallel Session Launch Guide

## Quick Start

Open 6 terminal tabs and run each command in a separate tab:

```bash
# Tab 1: Sync (008)
cd /Users/ww/dev/projects/mdxpad-sync && claude

# Tab 2: Persist (011)
cd /Users/ww/dev/projects/mdxpad-persist && claude

# Tab 3: Filter (014)
cd /Users/ww/dev/projects/mdxpad-filter && claude

# Tab 4: Template (016)
cd /Users/ww/dev/projects/mdxpad-template && claude

# Tab 5: Frontmatter (020)
cd /Users/ww/dev/projects/mdxpad-front && claude

# Tab 6: AI (028)
cd /Users/ww/dev/projects/mdxpad-ai && claude
```

---

## Session Initialization Prompts

Copy-paste these prompts into each Claude Code session after launching:

### 008-bidirectional-sync (mdxpad-sync)

```
/speckit.specify "Bidirectional Preview Sync - Scroll position syncing between editor and preview. Editor scroll position reflected in preview panel and vice versa. Configurable sync behavior (disabled, editor-to-preview, preview-to-editor, bidirectional). Smooth scroll with position caching."
```

### 011-autosave-recovery (mdxpad-persist)

```
/speckit.specify "Autosave & Crash Recovery - Automatic saving of document changes at configurable intervals. Crash recovery that restores unsaved work on application restart. Recovery dialog showing recoverable documents with preview. Integration with document store for dirty state tracking."
```

### 014-smart-filtering (mdxpad-filter)

```
/speckit.specify "Smart Filtering for File Tree - Quick filter/search in file explorer sidebar. Fuzzy matching for file and folder names. Filter persistence across sessions. Visual highlighting of matched portions. Keyboard shortcut to focus filter input."
```

### 016-template-library (mdxpad-template)

```
/speckit.specify "Template Library - Collection of MDX document templates (blog post, documentation, presentation, etc). Template browser with preview. Custom template creation and management. Template metadata (description, tags, author). Integration with new file creation flow."
```

### 020-frontmatter-editor (mdxpad-front)

```
/speckit.specify "Frontmatter Visual Editor - Form-based editing of YAML frontmatter. Schema detection and validation. Common field suggestions (title, date, tags, categories). Toggle between visual and raw YAML editing. Real-time sync with document content."
```

### 028-ai-provider-abstraction (mdxpad-ai)

```
/speckit.specify "AI Provider Abstraction Layer - BYOK (Bring Your Own Key) architecture for AI features. Support for multiple providers (OpenAI, Anthropic, local models). Provider configuration UI with API key management. Usage tracking and cost estimation. Secure credential storage using system keychain."
```

---

## Session Bootstrap Sequence

After running `/speckit.specify`, each session follows this workflow:

1. `/speckit.clarify` - Clarify any ambiguities
2. `/speckit.plan` - Generate implementation plan
3. `/speckit.tasks` - Generate task list
4. Update status.yaml to `phase: implementing`
5. Begin implementation with wave-based subagent orchestration

---

## Monitoring Sessions

### Check all session statuses

```bash
cat /Users/ww/dev/projects/mdxpad/.claude/workspace/sessions/*/status.yaml
```

### Check worktree states

```bash
cd /Users/ww/dev/projects/mdxpad && git worktree list
```

---

## Merge Order (Dependency-Based)

| Priority | Spec | Description |
|----------|------|-------------|
| 1 | 014-smart-filtering | No dependencies |
| 1 | 016-template-library | No dependencies |
| 2 | 008-bidirectional-sync | Shared types only |
| 2 | 011-autosave-recovery | Shared types only |
| 3 | 020-frontmatter-editor | Depends on Preview/Editor |
| 4 | 028-ai-provider-abstraction | Cross-cutting |

---

## Pre-Merge Checklist

Before merging any spec to main:

- [ ] All tasks marked complete in tasks.md
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (≥80% coverage on new code)
- [ ] `npm run build` succeeds
- [ ] No console errors in dev mode
- [ ] Manual smoke test of feature
- [ ] Spec requirements validated against implementation
- [ ] Constitution compliance verified
- [ ] No conflicts with main branch
- [ ] Exported types documented in status.yaml

---

## Merge Procedure

```bash
# From feature worktree (e.g., mdxpad-sync)
git fetch origin main
git rebase origin/main
npm run typecheck && npm run lint && npm run test && npm run build

# Merge to main
git checkout main
git merge --ff-only 008-bidirectional-sync
git push origin main

# Update other worktrees
cd ../mdxpad-persist && git fetch origin main && git rebase origin/main
cd ../mdxpad-filter && git fetch origin main && git rebase origin/main
# ... repeat for all active worktrees
```

---

## Cleanup After Completion

```bash
cd /Users/ww/dev/projects/mdxpad
git worktree remove ../mdxpad-sync
git worktree remove ../mdxpad-persist
git worktree remove ../mdxpad-filter
git worktree remove ../mdxpad-template
git worktree remove ../mdxpad-front
git worktree remove ../mdxpad-ai
git worktree prune
```
