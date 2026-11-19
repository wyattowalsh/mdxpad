/**
 * Git branch commands. Each one checks that the open file's folder is a repository.
 */

import type { Command, CommandId, CommandResult, CommandContext } from '@shared/types/commands';

function folderForGit(filePath: string | null): string | null {
  if (filePath?.includes('/') !== true) {
    return null;
  }
  return filePath.slice(0, filePath.lastIndexOf('/'));
}

async function readyRepository(ctx: CommandContext): Promise<string | null> {
  const dir = folderForGit(ctx.document.filePath);
  const git = ctx.api.git;
  if (!dir) {
    ctx.notify({ type: 'warning', message: 'Open a file inside a folder to use git' });
    return null;
  }
  if (!git) {
    ctx.notify({ type: 'warning', message: 'Git is not available' });
    return null;
  }
  const repo = await git.isRepo(dir);
  if (!repo.ok) {
    ctx.notify({ type: 'error', message: repo.error.message });
    return null;
  }
  if (!repo.value.isRepo) {
    ctx.notify({ type: 'warning', message: 'This folder is not a git repository' });
    return null;
  }
  return dir;
}

function branchSummary(branches: readonly { name: string; current: boolean }[]): string {
  if (branches.length === 0) {
    return 'Git branches: none';
  }
  const names = branches.map((branch) =>
    branch.current ? `${branch.name} (current)` : branch.name
  );
  return `Git branches: ${names.join(', ')}`;
}

const gitBranchesCommand: Command = {
  id: 'git.branches' as CommandId,
  name: 'Git Branches',
  description: 'List branches for the current file directory',
  category: 'file',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const dir = await readyRepository(ctx);
    if (!dir || !ctx.api.git) {
      return { ok: false, error: 'No git repository' };
    }
    const result = await ctx.api.git.branches(dir);
    if (!result.ok) {
      ctx.notify({ type: 'error', message: result.error.message });
      return { ok: false, error: result.error.message };
    }
    ctx.notify({ type: 'info', message: branchSummary(result.value.branches) });
    return { ok: true };
  },
};

const gitCheckoutCommand: Command = {
  id: 'git.checkout' as CommandId,
  name: 'Git Checkout',
  description: 'Check out a branch in the current file directory',
  category: 'file',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const dir = await readyRepository(ctx);
    if (!dir || !ctx.api.git) {
      return { ok: false, error: 'No git repository' };
    }
    const branch = window.prompt('Branch name')?.trim() ?? '';
    if (branch.length === 0) {
      ctx.notify({ type: 'info', message: 'Checkout cancelled' });
      return { ok: false, error: 'Checkout cancelled' };
    }
    const result = await ctx.api.git.checkout(dir, branch);
    if (!result.ok) {
      ctx.notify({ type: 'error', message: result.error.message });
      return { ok: false, error: result.error.message };
    }
    ctx.notify({ type: 'success', message: `Checked out ${result.value.branch}` });
    return { ok: true };
  },
};

export const GIT_BRANCH_COMMANDS: readonly Command[] = [gitBranchesCommand, gitCheckoutCommand];
