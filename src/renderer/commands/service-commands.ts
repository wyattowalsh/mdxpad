import type { CitationEntry } from '@shared/contracts/citation-schemas';
import type { Command, CommandId, CommandResult, CommandContext } from '@shared/types/commands';
import type { DocumentId } from '@shared/types/document';
import type { FileHandle, FileId } from '@shared/types/file';
import {
  fileIsMissing,
  hasPendingExternalChange,
} from '@renderer/components/tabs/external-tab-change';
import { saveInactiveDocuments } from './file-commands';
import { readExcludesForDirectory } from '@renderer/components/workspace/workspace-folders';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';
import { useWorkspaceStore } from '@renderer/stores/workspace-store';
import { useCommandRegistry } from '../stores/command-registry-store';
import { GIT_BRANCH_COMMANDS, requireGitRepository } from './git-branch-commands';
import { IMPORT_COMMANDS } from './import-commands';
import {
  documentStillMatches,
  editorHasUnsavedText,
  liveDocumentContent,
  syncSavedText,
} from './live-document';

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

function withOpenDocuments(
  results: readonly { readonly filePath?: string; readonly fileName?: string }[],
  ctx: CommandContext,
  query: string
): readonly { readonly filePath?: string; readonly fileName?: string }[] {
  const state = useDocumentStore.getState();
  const sameFile = state.filePath !== null && state.filePath === ctx.document.filePath;
  const withActive = includeOpenEditor(
    results,
    sameFile ? state.filePath : null,
    sameFile ? liveDocumentContent(ctx) : '',
    query
  );
  return useTabStore.getState().tabs.reduce((current, tab) => {
    if (tab.filePath === null || tab.filePath === state.filePath) {
      return current;
    }
    return includeOpenEditor(current, tab.filePath, tab.content, query);
  }, withActive);
}

function unsavedEditorFiles(directory: string, ctx: CommandContext): readonly string[] {
  const root = directory.endsWith('/') ? directory.slice(0, -1) : directory;
  const inside = (filePath: string | null): filePath is string =>
    filePath !== null && (filePath === root || filePath.startsWith(`${root}/`));
  const names = new Set<string>();
  const add = (filePath: string): void => {
    names.add(filePath.slice(filePath.lastIndexOf('/') + 1));
  };
  const state = useDocumentStore.getState();
  if (inside(state.filePath) && (state.isDirty || state.fileMissing || editorHasUnsavedText(ctx))) {
    add(state.filePath);
  }
  for (const tab of useTabStore.getState().tabs) {
    if (!inside(tab.filePath) || tab.filePath === state.filePath) {
      continue;
    }
    if (tab.isDirty || fileIsMissing(tab.filePath)) {
      add(tab.filePath);
    }
  }
  return [...names];
}

function gitDiffMessage(
  directory: string,
  diff: Parameters<typeof summarizeGitDiff>[0],
  ctx: CommandContext
): string {
  const unsaved = unsavedEditorFiles(directory, ctx);
  const disk = summarizeGitDiff(diff);
  if (unsaved.length === 0) {
    return disk;
  }
  return `${disk}. Unsaved in the editor: ${unsaved.join(', ')}`;
}

function gitStatusMessage(
  directory: string,
  status: Parameters<typeof summarizeGitStatus>[0],
  ctx: CommandContext
): string {
  const unsaved = unsavedEditorFiles(directory, ctx);
  const disk = summarizeGitStatus(status);
  if (unsaved.length === 0) {
    return disk;
  }
  return `${disk}. Unsaved in the editor: ${unsaved.join(', ')}`;
}

function notifyFolderResult(
  ctx: CommandContext,
  directory: string,
  message: string,
  directoryOf: (filePath: string) => string | null
): void {
  const openPath = useDocumentStore.getState().filePath;
  if (openPath !== null && directoryOf(openPath) !== directory) {
    ctx.notify({
      type: 'info',
      message: 'The open file changed before that folder finished.',
    });
    return;
  }
  ctx.notify({ type: 'info', message });
}

const gitStatusCommand: Command = {
  id: 'git.status' as CommandId,
  name: 'Git Status',
  description: 'Show git status for the current file directory',
  category: 'file',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const dir = await requireGitRepository(ctx);
    if (!dir || !ctx.api.git) {
      return { ok: false, error: 'No git repository' };
    }
    const result = await ctx.api.git.status(dir);
    if (!result.ok) {
      ctx.notify({ type: 'error', message: result.error.message });
      return { ok: false, error: result.error.message };
    }
    notifyFolderResult(ctx, dir, gitStatusMessage(dir, result.value, ctx), workspaceDir);
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
  const results = withOpenDocuments(result.value.results, ctx, queryText);
  notifyFolderResult(ctx, dir, summarizeSearchResults(queryText, results), (filePath) =>
    searchDirectoryForFile(filePath, useWorkspaceStore.getState().model?.workspace.rootPath ?? null)
  );
  return { ok: true };
}

const gitLogCommand: Command = {
  id: 'git.log' as CommandId,
  name: 'Git Log',
  description: 'Show the latest commits for the current file directory',
  category: 'file',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const dir = await requireGitRepository(ctx);
    if (!dir || !ctx.api.git) {
      return { ok: false, error: 'No git repository' };
    }
    const result = await ctx.api.git.log(dir, 5);
    if (!result.ok) {
      ctx.notify({ type: 'error', message: result.error.message });
      return { ok: false, error: result.error.message };
    }
    notifyFolderResult(ctx, dir, summarizeGitLog(result.value.entries), workspaceDir);
    return { ok: true };
  },
};

const gitDiffCommand: Command = {
  id: 'git.diff' as CommandId,
  name: 'Git Diff',
  description: 'Show how many files differ in the current file directory',
  category: 'file',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const dir = await requireGitRepository(ctx);
    if (!dir || !ctx.api.git) {
      return { ok: false, error: 'No git repository' };
    }
    const result = await ctx.api.git.diff(dir);
    if (!result.ok) {
      ctx.notify({ type: 'error', message: result.error.message });
      return { ok: false, error: result.error.message };
    }
    notifyFolderResult(ctx, dir, gitDiffMessage(dir, result.value, ctx), workspaceDir);
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
    const content = ctx.document.filePath === filePath ? liveDocumentContent(ctx) : state.content;
    return {
      content,
      isDirty: state.isDirty || state.fileMissing || content !== state.content,
      fileId: state.fileId,
      changedOnDisk: state.externalChangeDetected,
    };
  }
  return {
    content: ctx.document.content,
    isDirty: ctx.document.isDirty,
    fileId: ctx.document.fileId,
    changedOnDisk: hasPendingExternalChange(filePath),
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
  if (syncSavedText(filePath, buffer.content, ctx)) {
    const openFile = useDocumentStore.getState();
    openFile.markSaved({
      fileId: openFile.fileId ?? (handle.id as unknown as DocumentId),
      filePath,
      mtime: Date.now(),
    });
  }
  return null;
}

function notifyForCommittedFile(
  ctx: CommandContext,
  filePath: string,
  notification: { type: 'success' | 'error'; message: string }
): void {
  const openPath = useDocumentStore.getState().filePath;
  if (openPath !== null && openPath !== filePath) {
    ctx.notify({
      type: 'info',
      message: 'The open file changed before that folder finished.',
    });
    return;
  }
  ctx.notify(notification);
}

async function saveOpenFilesBeforeCommit(
  ctx: CommandContext,
  filePath: string
): Promise<CommandResult | null> {
  const othersSaved = await saveInactiveDocuments(ctx.api);
  if (!othersSaved) {
    ctx.notify({ type: 'error', message: 'Could not save another open file before commit' });
    return { ok: false, error: 'Could not save another open file' };
  }
  return saveBeforeGitCommit(ctx, filePath);
}

const gitCommitCommand: Command = {
  id: 'git.commit' as CommandId,
  name: 'Git Commit',
  description: 'Commit the open file in its folder',
  category: 'file',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const dir = await requireGitRepository(ctx);
    const filePath = ctx.document.filePath;
    if (!dir || !filePath || !ctx.api.git) {
      return { ok: false, error: 'Nothing to commit' };
    }
    const message = window.prompt('Commit message');
    if (message === null || message.trim().length === 0) {
      ctx.notify({ type: 'info', message: 'Commit cancelled' });
      return { ok: false, error: 'Commit cancelled' };
    }
    const saved = await saveOpenFilesBeforeCommit(ctx, filePath);
    if (saved) {
      return saved;
    }
    const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);
    const added = await ctx.api.git.add(dir, [fileName]);
    if (!added.ok) {
      notifyForCommittedFile(ctx, filePath, { type: 'error', message: added.error.message });
      return { ok: false, error: added.error.message };
    }
    const result = await ctx.api.git.commit(dir, message.trim(), [fileName]);
    if (!result.ok) {
      notifyForCommittedFile(ctx, filePath, { type: 'error', message: result.error.message });
      return { ok: false, error: result.error.message };
    }
    notifyForCommittedFile(ctx, filePath, {
      type: 'success',
      message: `Committed ${result.value.hash.slice(0, 7)}`,
    });
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
  if (!documentStillMatches(ctx, snapshot)) {
    return citationChanged(ctx);
  }
  if (!parsed.ok) {
    ctx.notify({ type: 'error', message: parsed.error.message });
    return { ok: false, error: parsed.error.message };
  }
  if (parsed.value.entries.length === 0) {
    ctx.notify({ type: 'info', message: 'Parsed 0 citations' });
    return { ok: true };
  }
  const inline = await citationInlineRefs(citation, parsed.value.entries);
  if (!documentStillMatches(ctx, snapshot)) {
    return citationChanged(ctx);
  }
  if (!inline.ok) {
    ctx.notify({ type: 'error', message: inline.error });
    return { ok: false, error: inline.error };
  }
  const generated = await citation.generateBibliography(parsed.value.entries, 'apa');
  if (!documentStillMatches(ctx, snapshot)) {
    return citationChanged(ctx);
  }
  if (!generated.ok) {
    ctx.notify({ type: 'error', message: generated.error.message });
    return { ok: false, error: generated.error.message };
  }
  return writeBibliography(
    ctx,
    snapshot,
    generated.value.bibliography,
    generated.value.entryCount,
    inline.refs
  );
}

async function citationInlineRefs(
  citation: NonNullable<CommandContext['api']['citation']>,
  entries: readonly CitationEntry[]
): Promise<{ ok: true; refs: string } | { ok: false; error: string }> {
  const refs: string[] = [];
  for (const entry of entries) {
    const formatted = await citation.formatCitation(entry, 'apa');
    if (!formatted.ok) {
      return { ok: false, error: formatted.error.message };
    }
    refs.push(formatted.value.inlineRef);
  }
  return { ok: true, refs: refs.join(', ') };
}

function citationChanged(ctx: CommandContext): CommandResult {
  ctx.notify({
    type: 'warning',
    message: 'The document changed while citations were parsed. It was not changed.',
  });
  return { ok: false, error: 'Document changed during citation parse' };
}

function writeBibliography(
  ctx: CommandContext,
  snapshot: string,
  bibliography: string,
  entryCount: number,
  inlineRefs: string
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
    message: `Added a bibliography for ${entryCount} citation${entryCount === 1 ? '' : 's'}. In text: ${inlineRefs}.`,
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
  ...GIT_BRANCH_COMMANDS,
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
