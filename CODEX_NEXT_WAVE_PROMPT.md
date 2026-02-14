# Codex Prompt: Next Iterative Improvement Wave for mdxpad

You are Codex working in `/Users/ww/dev/projects/mdxpad`.

## Current Context
- Repository: `mdxpad` (Electron + React + TypeScript, strict mode).
- Primary workflow: spec-driven development with `.specify/specs`.
- Recently consolidated feature branches are already integrated into `main` at commit `14144e7f8f032662d64f8a48b54d8b305ddd81d3`:
  - `009-expression-tooltips`
  - `012-document-history`
  - `017-customizable-shortcuts`
  - `018-git-integration`
  - `021-grammar-assistant`
  - `022-ai-completion`
- External worktree directories for five feature branches have been cleaned up from `../`:
  - `../mdxpad-completion`
  - `../mdxpad-git`
  - `../mdxpad-grammar`
  - `../mdxpad-shortcuts`
  - `../mdxpad-tooltips`
- One sibling worktree may still exist and must be reconciled during preflight cleanup:
  - `../mdxpad-history`

## Mission
Start a new wave of iterative improvements with high rigor, measurable outcomes, and minimal regressions.

## Preflight: Worktree Consolidation (Mandatory)
1. Discover sibling directories that match `../mdx-*/` and `../mdxpad-*/` (excluding `../mdxpad` itself).
2. For each discovered directory:
   - Confirm whether it is a git worktree of this repository.
   - If it has unique commits, integrate to `main` first (merge or equivalent, with conflict resolution and tests).
   - Remove it using `git worktree remove <path>` after integration (or immediately if already fully merged).
3. Verify cleanup:
   - `git worktree list --porcelain`
   - confirm no stale sibling `mdx-*` / `mdxpad-*` dirs remain except the primary repo.
4. Record exactly what was integrated and removed in the final report.

## Required Process
1. Baseline assessment:
   - Inspect `AGENTS.md` and relevant `.specify/specs/*` artifacts.
   - Run baseline checks and capture results:
     - `pnpm typecheck`
     - `pnpm lint`
     - `pnpm test`
     - `pnpm test:e2e` (or targeted subset if full suite is too slow; explain scope).
2. Review and analysis:
   - Audit architecture and implementation quality in:
     - Editor core + preview sync
     - Command palette + smart filtering
     - Frontmatter editor
     - AI provider abstraction + completion/grammar surfaces
     - Git integration and document history
   - Identify technical debt, inconsistency, dead code, fragile tests, and UX friction.
3. Prioritization:
   - Produce a ranked improvement backlog with impact, effort, and risk.
   - Select the top 2-3 improvements with highest ROI.
4. Implementation wave:
   - Implement selected improvements end-to-end.
   - Reuse existing utilities and patterns before creating new abstractions.
   - Add/adjust tests for each behavior change.
5. Validation:
   - Re-run relevant checks (`typecheck`, `lint`, `test`, and e2e for UI changes).
   - For frontend/UI changes, verify behavior with Playwright and document what was validated.
6. Cleanup + documentation:
   - Remove stale code and redundant branches/paths if discovered.
   - Update or add concise docs where behavior changed.

## Constraints
- Preserve strict TypeScript quality.
- Prefer latest stable dependency versions when introducing/updating packages.
- Avoid destructive git operations.
- Keep changes incremental and reviewable; explain tradeoffs briefly and concretely.
- If uncertain about fast-moving APIs/packages, verify with authoritative docs first.

## Deliverables
1. `Wave Review` summary:
   - Baseline findings
   - Prioritized backlog
   - Chosen implementation scope
2. Code changes with tests.
3. `Verification Report`:
   - Commands run
   - Results
   - Remaining known risks/gaps
4. Clear `Next Iteration` recommendations (max 5 items).

## Output Format
Respond in this exact section order:
1. `Baseline Status`
2. `Findings`
3. `Planned Improvements`
4. `Implemented Changes`
5. `Verification`
6. `Next Iteration`
