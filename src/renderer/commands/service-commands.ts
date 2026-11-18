import type { Command, CommandId, CommandResult, CommandContext } from '@shared/types/commands';
import type { DocumentId } from '@shared/types/document';
import type { FileHandle, FileId } from '@shared/types/file';
import { readExcludesForDirectory } from '@renderer/components/workspace/workspace-folders';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useWorkspaceStore } from '@renderer/stores/workspace-store';
import { useCommandRegistry } from '../stores/command-registry-store';
import { IMPORT_COMMANDS } from './import-commands';
import { documentStillMatches, liveDocumentContent } from './live-document';

function parentDirectory(filePath: string): string {
  return filePath.slice(0, filePath.lastIndexOf('/'));
}

function workspaceDir(filePath: string | null): string | null {
  if (filePath?.includes('/') !== true) {
    return null;
  }
  return parentDirectory(filePath);
}

/** Search the open workspace when the file lives there, otherwise the file's folder. */
export function searchDirectoryForFile(
  filePath: string | null,
  workspaceRoot: string | null
): string | null {
  if (filePath?.includes('/') !== true) {
    return null;
  }
  const root = workspaceRoot?.endsWith('/') ? workspaceRoot.slice(0, -1) : workspaceRoot;
  if (root && root.length > 0 && (filePath === root || filePath.startsWith(`${root}/`))) {
    return root;
  }
  return parentDirectory(filePath);
}

export function summarizeGitStatus(status: {
  readonly current: string | null;
  readonly staged: readonly string[];
  readonly modified: readonly string[];
  readonly notAdded: readonly string[];
  readonly created: readonly string[];
  readonly deleted: readonly string[];
  readonly conflicted: readonly string[];
}): string {
  const files = [
    ...status.conflicted,
    ...status.staged,
    ...status.modified,
    ...status.created,
    ...status.deleted,
    ...status.notAdded,
  ];
  const unique = [...new Set(files)];
  const branch = status.current ? ` on ${status.current}` : '';
  if (unique.length === 0) {
    return `Git status: clean${branch}`;
  }
  const shown = unique.slice(0, 5).join(', ');
  const extra = unique.length > 5 ? `, and ${unique.length - 5} more` : '';
  const label = unique.length === 1 ? 'file' : 'files';
  return `Git status${branch}: ${unique.length} changed ${label} (${shown}${extra})`;
}

export function summarizeGitLog(
  entries: readonly { readonly hash: string; readonly message: string }[]
): string {
  if (entries.length === 0) {
    return 'Git log: no commits';
  }
  const shown = entries.slice(0, 5).map((entry) => {
    const subject = entry.message.split('\n')[0] ?? entry.message;
    return `${entry.hash.slice(0, 7)} ${subject}`;
  });
  return `Git log: ${shown.join('; ')}`;
}

export function summarizeGitDiff(diff: {
  readonly diff: string;
  readonly filesChanged: number;
}): string {
  if (diff.filesChanged === 0 || diff.diff.trim().length === 0) {
    return 'Git diff: no unstaged changes';
  }
  const label = diff.filesChanged === 1 ? 'file' : 'files';
  return `Git diff: ${diff.filesChanged} changed ${label}`;
}

export function summarizeSearchResults(
  query: string,
  results: readonly { readonly fileName?: string; readonly filePath?: string }[]
): string {
  if (results.length === 0) {
    return `Search for "${query}": no matches`;
  }
  const names = results.slice(0, 5).map((result) => {
    if (result.fileName !== undefined && result.fileName.length > 0) {
      return result.fileName;
    }
    const filePath = result.filePath ?? '';
    const slash = filePath.lastIndexOf('/');
    return slash === -1 ? filePath : filePath.slice(slash + 1);
  });
  const extra = results.length > 5 ? `, and ${results.length - 5} more` : '';
  const label = results.length === 1 ? 'match' : 'matches';
  return `Search for "${query}": ${results.length} ${label} (${names.join(', ')}${extra})`;
}

function queryWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

function editorContainsQuery(content: string, query: string): boolean {
  const words = queryWords(query);
  if (words.length === 0) {
    return false;
  }
  const haystack = content.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

function includeOpenEditor(
  results: readonly { readonly filePath?: string; readonly fileName?: string }[],
  filePath: string | null,
  content: string,
  query: string
): readonly { readonly filePath?: string; readonly fileName?: string }[] {
  if (!filePath || !editorContainsQuery(content, query)) {
    return results;
  }
  const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);
  if (results.some((result) => result.filePath === filePath)) {
    return results.map((result) =>
      result.filePath === filePath ? { ...result, fileName } : result
    );
  }
  return [{ filePath, fileName }, ...results];
}

function requireWorkspaceDir(ctx: CommandContext): string | null {
  const dir = workspaceDir(ctx.document.filePath);
  if (!dir) {
    ctx.notify({ type: 'warning', message: 'Open a file inside a folder to use git' });
    return null;
  }
  return dir;
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
    ctx.notify({ type: 'info', message: summarizeGitStatus(result.value) });
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
  const openFile = useDocumentStore.getState();
  const sameFile = openFile.filePath !== null && openFile.filePath === ctx.document.filePath;
  const results = includeOpenEditor(
    result.value.results,
    sameFile ? openFile.filePath : null,
    sameFile ? openFile.content : '',
    queryText
  );
  ctx.notify({
    type: 'info',
    message: summarizeSearchResults(queryText, results),
  });
  return { ok: true };
}

const gitLogCommand: Command = {
  id: 'git.log' as CommandId,
  name: 'Git Log',
  description: 'Show the latest commits for the current file directory',
  category: 'file',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const dir = requireWorkspaceDir(ctx);
    if (!dir || !ctx.api.git) {
      if (dir) {
        ctx.notify({ type: 'warning', message: 'Git is not available' });
      }
      return { ok: false, error: dir ? 'Git is not available' : 'No workspace directory' };
    }
    const result = await ctx.api.git.log(dir, 5);
    if (!result.ok) {
      ctx.notify({ type: 'error', message: result.error.message });
      return { ok: false, error: result.error.message };
    }
    ctx.notify({ type: 'info', message: summarizeGitLog(result.value.entries) });
    return { ok: true };
  },
};

const gitDiffCommand: Command = {
  id: 'git.diff' as CommandId,
  name: 'Git Diff',
  description: 'Show how many files differ in the current file directory',
  category: 'file',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const dir = requireWorkspaceDir(ctx);
    if (!dir || !ctx.api.git) {
      if (dir) {
        ctx.notify({ type: 'warning', message: 'Git is not available' });
      }
      return { ok: false, error: dir ? 'Git is not available' : 'No workspace directory' };
    }
    const result = await ctx.api.git.diff(dir);
    if (!result.ok) {
      ctx.notify({ type: 'error', message: result.error.message });
      return { ok: false, error: result.error.message };
    }
    ctx.notify({ type: 'info', message: summarizeGitDiff(result.value) });
    return { ok: true };
  },
};

function commitBuffer(
  ctx: CommandContext,
  filePath: string
): {
  readonly content: string;
  readonly isDirty: boolean;
  readonly fileId: string | null;
  readonly changedOnDisk: boolean;
} {
  const state = useDocumentStore.getState();
  if (state.filePath === filePath) {
    return {
      content: state.content,
      isDirty: state.isDirty,
      fileId: state.fileId,
      changedOnDisk: state.externalChangeDetected,
    };
  }
  return {
    content: ctx.document.content,
    isDirty: ctx.document.isDirty,
    fileId: ctx.document.fileId,
    changedOnDisk: false,
  };
}

function saveFailureMessage(error: { readonly code: string; readonly message?: string }): string {
  if (error.code === 'UNKNOWN' && error.message) {
    return error.message;
  }
  return error.code;
}

async function saveBeforeGitCommit(
  ctx: CommandContext,
  filePath: string
): Promise<CommandResult | null> {
  const buffer = commitBuffer(ctx, filePath);
  if (!buffer.isDirty) {
    return null;
  }
  if (buffer.changedOnDisk) {
    ctx.notify({
      type: 'warning',
      message: 'This file changed on disk. Save it before committing.',
    });
    return { ok: false, error: 'File changed on disk' };
  }

  const handle: FileHandle = {
    id: (buffer.fileId ?? filePath) as FileId,
    path: filePath,
    name: filePath.slice(filePath.lastIndexOf('/') + 1),
  };
  const saved = await ctx.api.saveFile(handle, buffer.content);
  if (!saved.ok) {
    const message = saveFailureMessage(saved.error);
    ctx.notify({ type: 'error', message: `Could not save before commit: ${message}` });
    return { ok: false, error: message };
  }
  const openFile = useDocumentStore.getState();
  if (openFile.filePath === filePath) {
    useDocumentStore.getState().markSaved({
      fileId: openFile.fileId ?? (handle.id as unknown as DocumentId),
      filePath,
      mtime: Date.now(),
    });
  }
  return null;
}

const gitCommitCommand: Command = {
  id: 'git.commit' as CommandId,
  name: 'Git Commit',
  description: 'Commit the open file in its folder',
  category: 'file',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const dir = requireWorkspaceDir(ctx);
    const filePath = ctx.document.filePath;
    if (!dir || !filePath || !ctx.api.git) {
      if (dir && filePath) {
        ctx.notify({ type: 'warning', message: 'Git is not available' });
      }
      return { ok: false, error: 'Nothing to commit' };
    }
    const message = window.prompt('Commit message');
    if (message === null || message.trim().length === 0) {
      ctx.notify({ type: 'info', message: 'Commit cancelled' });
      return { ok: false, error: 'Commit cancelled' };
    }
    const saved = await saveBeforeGitCommit(ctx, filePath);
    if (saved) {
      return saved;
    }
    const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);
    const added = await ctx.api.git.add(dir, [fileName]);
    if (!added.ok) {
      ctx.notify({ type: 'error', message: added.error.message });
      return { ok: false, error: added.error.message };
    }
    const result = await ctx.api.git.commit(dir, message.trim(), [fileName]);
    if (!result.ok) {
      ctx.notify({ type: 'error', message: result.error.message });
      return { ok: false, error: result.error.message };
    }
    ctx.notify({ type: 'success', message: `Committed ${result.value.hash.slice(0, 7)}` });
    return { ok: true };
  },
};

const searchWorkspaceCommand: Command = {
  id: 'search.workspace' as CommandId,
  name: 'Search Workspace',
  description: 'Search the current folder for text you enter',
  category: 'file',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const workspaceRoot = useWorkspaceStore.getState().model?.workspace.rootPath ?? null;
    const dir = searchDirectoryForFile(ctx.document.filePath, workspaceRoot);
    if (!dir) {
      ctx.notify({ type: 'warning', message: 'Open a file inside a folder to search' });
      return { ok: false, error: 'Nothing to search' };
    }
    const queryText = window.prompt('Search this folder')?.trim() ?? '';
    if (queryText.length === 0) {
      ctx.notify({ type: 'info', message: 'Search cancelled' });
      return { ok: false, error: 'Search cancelled' };
    }
    return searchWorkspaceFolder(ctx, dir, queryText);
  },
};

async function appendParsedBibliography(ctx: CommandContext): Promise<CommandResult> {
  const citation = ctx.api.citation;
  if (!citation) {
    ctx.notify({ type: 'warning', message: 'Citations are not available' });
    return { ok: false, error: 'Citations are not available' };
  }
  const snapshot = liveDocumentContent(ctx);
  if (snapshot.trim().length === 0) {
    ctx.notify({ type: 'warning', message: 'The document is empty' });
    return { ok: false, error: 'The document is empty' };
  }
  const parsed = await citation.parseBibtex(snapshot);
  if (!parsed.ok) {
    ctx.notify({ type: 'error', message: parsed.error.message });
    return { ok: false, error: parsed.error.message };
  }
  if (parsed.value.entries.length === 0) {
    ctx.notify({ type: 'info', message: 'Parsed 0 citations' });
    return { ok: true };
  }
  const generated = await citation.generateBibliography(parsed.value.entries, 'apa');
  if (!generated.ok) {
    ctx.notify({ type: 'error', message: generated.error.message });
    return { ok: false, error: generated.error.message };
  }
  return writeBibliography(ctx, snapshot, generated.value.bibliography, generated.value.entryCount);
}

function writeBibliography(
  ctx: CommandContext,
  snapshot: string,
  bibliography: string,
  entryCount: number
): CommandResult {
  if (!documentStillMatches(ctx, snapshot)) {
    ctx.notify({
      type: 'warning',
      message: 'The document changed while citations were parsed. It was not changed.',
    });
    return { ok: false, error: 'Document changed during citation parse' };
  }
  if (snapshot.includes(bibliography)) {
    ctx.notify({
      type: 'info',
      message: `Parsed ${entryCount} citations. The bibliography is already in the document.`,
    });
    return { ok: true };
  }
  const separator = snapshot.endsWith('\n') ? '\n' : '\n\n';
  useDocumentStore.getState().setContent(`${snapshot}${separator}${bibliography}`);
  ctx.notify({
    type: 'success',
    message: `Added a bibliography for ${entryCount} citation${entryCount === 1 ? '' : 's'}.`,
  });
  return { ok: true };
}

const parseCitationsCommand: Command = {
  id: 'citation.parse' as CommandId,
  name: 'Parse Citations',
  description: 'Parse BibTeX in the current document and add a bibliography',
  category: 'file',
  execute: appendParsedBibliography,
};

export const SERVICE_COMMANDS: readonly Command[] = [
  gitStatusCommand,
  gitLogCommand,
  gitDiffCommand,
  gitCommitCommand,
  searchWorkspaceCommand,
  ...IMPORT_COMMANDS,
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
