import type { Command, CommandId, CommandResult, CommandContext } from '@shared/types/commands';
import { readExcludesForDirectory } from '@renderer/components/workspace/workspace-folders';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useCommandRegistry } from '../stores/command-registry-store';

function workspaceDir(filePath: string | null): string | null {
  if (filePath?.includes('/') !== true) {
    return null;
  }
  return filePath.slice(0, filePath.lastIndexOf('/'));
}

const gitStatusCommand: Command = {
  id: 'git.status' as CommandId,
  name: 'Git Status',
  description: 'Show git status for the current file directory',
  category: 'file',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const dir = workspaceDir(ctx.document.filePath);
    if (!dir || !ctx.api.git) {
      ctx.notify({ type: 'warning', message: 'Open a file inside a folder to check git status' });
      return { ok: false, error: 'No workspace directory' };
    }
    const result = await ctx.api.git.status(dir);
    if (!result.ok) {
      ctx.notify({ type: 'error', message: result.error.message });
      return { ok: false, error: result.error.message };
    }
    const count =
      result.value.staged.length +
      result.value.modified.length +
      result.value.notAdded.length +
      result.value.created.length +
      result.value.deleted.length +
      result.value.conflicted.length;
    ctx.notify({
      type: 'info',
      message: `Git status: ${count} changed file${count === 1 ? '' : 's'}`,
    });
    return { ok: true };
  },
};

async function searchWorkspaceFolder(
  ctx: CommandContext,
  dir: string,
  queryText: string
): Promise<CommandResult> {
  const searchApi = ctx.api.search;
  if (!searchApi) {
    ctx.notify({ type: 'warning', message: 'Search is not available' });
    return { ok: false, error: 'Search is not available' };
  }
  const excludes = readExcludesForDirectory(dir);
  const status = await searchApi.status(dir);
  if (!status.ok) {
    ctx.notify({ type: 'error', message: status.error.message });
    return { ok: false, error: status.error.message };
  }
  if (!status.value.indexed) {
    const indexed = await searchApi.index(dir, undefined, excludes);
    if (!indexed.ok) {
      ctx.notify({ type: 'error', message: indexed.error.message });
      return { ok: false, error: indexed.error.message };
    }
  }
  const result = await searchApi.search(dir, queryText, 10, undefined, excludes);
  if (!result.ok) {
    ctx.notify({ type: 'error', message: result.error.message });
    return { ok: false, error: result.error.message };
  }
  const count = result.value.results.length;
  ctx.notify({ type: 'info', message: `Search found ${count} match${count === 1 ? '' : 'es'}` });
  return { ok: true };
}

const searchWorkspaceCommand: Command = {
  id: 'search.workspace' as CommandId,
  name: 'Search Workspace',
  description: 'Search the current folder for the first heading in the document',
  category: 'file',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const dir = workspaceDir(ctx.document.filePath);
    const query = ctx.document.content.split('\n').find((line) => line.trim().length > 0) ?? '';
    const queryText = query.trim().replace(/^#+\s*/, '');
    if (!dir || queryText.length === 0) {
      ctx.notify({ type: 'warning', message: 'Open a file with text to search its folder' });
      return { ok: false, error: 'Nothing to search' };
    }
    return searchWorkspaceFolder(ctx, dir, queryText);
  },
};

const importHtmlCommand: Command = {
  id: 'import.html' as CommandId,
  name: 'Import HTML from Document',
  description: 'Convert the current document as HTML into Markdown',
  category: 'file',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    if (!ctx.api.import) {
      ctx.notify({ type: 'warning', message: 'Import is not available' });
      return { ok: false, error: 'Import is not available' };
    }
    if (ctx.document.content.trim().length === 0) {
      ctx.notify({ type: 'warning', message: 'The document is empty' });
      return { ok: false, error: 'The document is empty' };
    }
    const result = await ctx.api.import.fromHtml(ctx.document.content);
    if (!result.ok) {
      ctx.notify({ type: 'error', message: result.error.message });
      return { ok: false, error: result.error.message };
    }
    const document = useDocumentStore.getState();
    if (document.content !== ctx.document.content) {
      ctx.notify({
        type: 'warning',
        message: 'The document changed during import. It was not replaced.',
      });
      return { ok: false, error: 'Document changed during import' };
    }
    document.setContent(result.value.content);
    const warningCount = result.value.warnings.length;
    const warningText =
      warningCount === 0 ? '' : ` ${warningCount} warning${warningCount === 1 ? '' : 's'}.`;
    ctx.notify({
      type: 'success',
      message: `Imported HTML (${result.value.content.length} characters).${warningText}`,
    });
    return { ok: true };
  },
};

const parseCitationsCommand: Command = {
  id: 'citation.parse' as CommandId,
  name: 'Parse Citations',
  description: 'Parse BibTeX in the current document',
  category: 'file',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    if (!ctx.api.citation) {
      ctx.notify({ type: 'warning', message: 'Citations are not available' });
      return { ok: false, error: 'Citations are not available' };
    }
    const result = await ctx.api.citation.parseBibtex(ctx.document.content);
    if (!result.ok) {
      ctx.notify({ type: 'error', message: result.error.message });
      return { ok: false, error: result.error.message };
    }
    const count = result.value.entries.length;
    ctx.notify({ type: 'info', message: `Parsed ${count} citation${count === 1 ? '' : 's'}` });
    return { ok: true };
  },
};

export const SERVICE_COMMANDS: readonly Command[] = [
  gitStatusCommand,
  searchWorkspaceCommand,
  importHtmlCommand,
  parseCitationsCommand,
];

export function registerServiceCommands(): () => void {
  const { register, unregister } = useCommandRegistry.getState();
  const registeredIds: CommandId[] = [];

  for (const command of SERVICE_COMMANDS) {
    const result = register(command);
    if (result.ok) {
      registeredIds.push(command.id);
    }
  }

  return () => {
    for (const id of registeredIds) {
      unregister(id);
    }
  };
}
