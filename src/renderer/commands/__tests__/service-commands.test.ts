import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CommandContext } from '@shared/types/commands';
import type { DocumentId } from '@shared/types/document';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';
import { useWorkspaceStore } from '@renderer/stores/workspace-store';
import type { WorkspaceModel } from '@shared/types/workspace';
import {
  noteInactiveExternalChange,
  resetPendingExternalChanges,
} from '@renderer/components/tabs/external-tab-change';
import {
  SERVICE_COMMANDS,
  searchDirectoryForFile,
  summarizeGitDiff,
  summarizeGitLog,
  summarizeGitStatus,
  summarizeSearchResults,
} from '../service-commands';

describe('summarizeGitStatus', () => {
  it('names the changed files and a clean branch', () => {
    expect(
      summarizeGitStatus({
        current: 'main',
        staged: ['a.md'],
        modified: ['b.md'],
        notAdded: [],
        created: [],
        deleted: [],
        conflicted: [],
      })
    ).toBe('Git status on main: 2 changed files (a.md, b.md)');
    expect(
      summarizeGitStatus({
        current: 'main',
        staged: [],
        modified: [],
        notAdded: [],
        created: [],
        deleted: [],
        conflicted: [],
      })
    ).toBe('Git status: clean on main');
  });
});

describe('git status', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useTabStore.getState().reset();
  });

  it('warns when the folder is not a git repository', async () => {
    const status = vi.fn();
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: 'draft', isDirty: false },
      api: {
        git: {
          isRepo: vi.fn().mockResolvedValue({ ok: true, value: { isRepo: false } }),
          status,
        },
      },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.status');
    await expect(command?.execute(context)).resolves.toEqual({
      ok: false,
      error: 'No git repository',
    });
    expect(status).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith({
      type: 'warning',
      message: 'This folder is not a git repository',
    });
  });

  it('mentions unsaved editor files when the disk is clean', async () => {
    useDocumentStore.setState({
      filePath: '/notes/readme.md',
      content: 'draft',
      isDirty: true,
    });
    useTabStore.getState().addTab({
      filePath: '/notes/other.md',
      fileName: 'other.md',
      isDirty: true,
      content: 'other',
      savedContent: '',
    });
    const status = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        current: 'main',
        staged: [],
        modified: [],
        notAdded: [],
        created: [],
        deleted: [],
        conflicted: [],
      },
    });
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: 'draft', isDirty: true },
      api: {
        git: { isRepo: vi.fn().mockResolvedValue({ ok: true, value: { isRepo: true } }), status },
      },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.status');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(notify).toHaveBeenCalledWith({
      type: 'info',
      message: 'Git status: clean on main. Unsaved in the editor: readme.md, other.md',
    });
  });

  it('mentions keystrokes that have not been stored yet', async () => {
    useDocumentStore.getState().openDocument(
      {
        fileId: 'file-1' as DocumentId,
        filePath: '/notes/readme.md',
        mtime: 1,
      },
      'saved'
    );
    const status = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        current: 'main',
        staged: [],
        modified: [],
        notAdded: [],
        created: [],
        deleted: [],
        conflicted: [],
      },
    });
    const notify = vi.fn();
    const context = {
      document: {
        filePath: '/notes/readme.md',
        content: 'saved',
        isDirty: false,
        fileId: 'file-1',
      },
      editor: { state: { doc: { toString: () => 'saved!' } }, isDestroyed: false },
      api: {
        git: { isRepo: vi.fn().mockResolvedValue({ ok: true, value: { isRepo: true } }), status },
      },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.status');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(notify).toHaveBeenCalledWith({
      type: 'info',
      message: 'Git status: clean on main. Unsaved in the editor: readme.md',
    });
  });

  it('does not report git status after the open file leaves that folder', async () => {
    useDocumentStore.setState({ filePath: '/notes/readme.md', content: 'draft' });
    let finishStatus: (value: {
      ok: true;
      value: {
        current: string;
        staged: string[];
        modified: string[];
        notAdded: string[];
        created: string[];
        deleted: string[];
        conflicted: string[];
      };
    }) => void = () => undefined;
    const status = vi.fn(
      () =>
        new Promise((resolve) => {
          finishStatus = resolve;
        })
    );
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: 'draft', isDirty: false },
      api: {
        git: { isRepo: vi.fn().mockResolvedValue({ ok: true, value: { isRepo: true } }), status },
      },
      notify,
    } as unknown as CommandContext;
    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.status');
    const pending = command?.execute(context);
    await vi.waitFor(() => {
      expect(status).toHaveBeenCalled();
    });
    useDocumentStore.setState({ filePath: '/other/b.md', content: 'other' });
    finishStatus({
      ok: true,
      value: {
        current: 'main',
        staged: [],
        modified: [],
        notAdded: [],
        created: [],
        deleted: [],
        conflicted: [],
      },
    });
    await pending;

    expect(notify).toHaveBeenCalledWith({
      type: 'info',
      message: 'The open file changed before that folder finished.',
    });
  });
});

describe('git diff', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useTabStore.getState().reset();
  });

  it('mentions unsaved editor files when the disk diff is empty', async () => {
    useDocumentStore.setState({
      filePath: '/notes/readme.md',
      content: 'draft',
      isDirty: true,
    });
    const diff = vi.fn().mockResolvedValue({
      ok: true,
      value: { diff: '', filesChanged: 0 },
    });
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: 'draft', isDirty: true },
      api: {
        git: { isRepo: vi.fn().mockResolvedValue({ ok: true, value: { isRepo: true } }), diff },
      },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.diff');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(diff).toHaveBeenCalledWith('/notes');
    expect(notify).toHaveBeenCalledWith({
      type: 'info',
      message: 'Git diff: no unstaged changes. Unsaved in the editor: readme.md',
    });
  });
});

describe('git log and diff', () => {
  it('summarizes the latest commits and an empty diff', () => {
    expect(
      summarizeGitLog([
        { hash: 'abcdef123456', message: 'Add notes\n\nbody' },
        { hash: '1234567890ab', message: 'Fix title' },
      ])
    ).toBe('Git log: abcdef1 Add notes; 1234567 Fix title');
    expect(summarizeGitLog([])).toBe('Git log: no commits');
    expect(summarizeGitDiff({ diff: '', filesChanged: 0 })).toBe('Git diff: no unstaged changes');
    expect(summarizeGitDiff({ diff: '@@', filesChanged: 2 })).toBe('Git diff: 2 changed files');
  });

  it('asks git for the latest commits in the open file folder', async () => {
    const log = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        entries: [{ hash: 'abcdef123456', message: 'Add notes', author: 'A', date: 't' }],
        total: 1,
      },
    });
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: '' },
      api: {
        git: { isRepo: vi.fn().mockResolvedValue({ ok: true, value: { isRepo: true } }), log },
      },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.log');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(log).toHaveBeenCalledWith('/notes', 5);
    expect(notify).toHaveBeenCalledWith({ type: 'info', message: 'Git log: abcdef1 Add notes' });
  });
});

describe('git.commit', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useTabStore.getState().reset();
    resetPendingExternalChanges();
  });

  it('stages the open file and commits the entered message', async () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'Save notes')
    );
    const add = vi.fn().mockResolvedValue({ ok: true, value: { success: true } });
    const commit = vi.fn().mockResolvedValue({
      ok: true,
      value: { hash: 'abcdef123456', message: 'Save notes' },
    });
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: '# Notes' },
      api: {
        git: {
          isRepo: vi.fn().mockResolvedValue({ ok: true, value: { isRepo: true } }),
          add,
          commit,
        },
      },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.commit');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(add).toHaveBeenCalledWith('/notes', ['readme.md']);
    expect(commit).toHaveBeenCalledWith('/notes', 'Save notes', ['readme.md']);
    expect(notify).toHaveBeenCalledWith({ type: 'success', message: 'Committed abcdef1' });
  });

  it('does not say the commit finished on a different open file', async () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'Save notes')
    );
    useDocumentStore.setState({ filePath: '/notes/readme.md', content: '# Notes' });
    let finishCommit: (value: {
      ok: true;
      value: { hash: string; message: string };
    }) => void = () => undefined;
    const add = vi.fn().mockResolvedValue({ ok: true, value: { success: true } });
    const commit = vi.fn(
      () =>
        new Promise((resolve) => {
          finishCommit = resolve;
        })
    );
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: '# Notes' },
      api: {
        git: {
          isRepo: vi.fn().mockResolvedValue({ ok: true, value: { isRepo: true } }),
          add,
          commit,
        },
      },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.commit');
    const pending = command?.execute(context);
    await vi.waitFor(() => {
      expect(commit).toHaveBeenCalled();
    });
    useDocumentStore.setState({ filePath: '/other/b.md', content: 'other' });
    finishCommit({ ok: true, value: { hash: 'abcdef123456', message: 'Save notes' } });
    await pending;

    expect(notify).toHaveBeenCalledWith({
      type: 'info',
      message: 'The open file changed before that folder finished.',
    });
    expect(notify).not.toHaveBeenCalledWith({
      type: 'success',
      message: 'Committed abcdef1',
    });
  });

  it('leaves keystrokes typed during the commit save unsaved', async () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'Save edits')
    );
    useDocumentStore.getState().openDocument(
      {
        fileId: 'file-1' as DocumentId,
        filePath: '/notes/readme.md',
        mtime: 1,
      },
      'old'
    );
    useDocumentStore.getState().setContent('# edited');
    const saveFile = vi.fn().mockImplementation(async () => {
      useDocumentStore.getState().setContent('# edited more');
      return { ok: true, value: undefined };
    });
    const add = vi.fn().mockResolvedValue({ ok: true, value: { success: true } });
    const commit = vi.fn().mockResolvedValue({
      ok: true,
      value: { hash: 'abcdef123456', message: 'Save edits' },
    });
    const context = {
      document: { filePath: '/notes/readme.md', content: 'old', isDirty: false, fileId: 'file-1' },
      api: {
        git: {
          isRepo: vi.fn().mockResolvedValue({ ok: true, value: { isRepo: true } }),
          add,
          commit,
        },
        saveFile,
      },
      notify: vi.fn(),
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.commit');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(saveFile).toHaveBeenCalledWith(
      { id: 'file-1', path: '/notes/readme.md', name: 'readme.md' },
      '# edited'
    );
    expect(useDocumentStore.getState().isDirty).toBe(true);
    expect(useDocumentStore.getState().content).toBe('# edited more');
  });

  it('commits keystrokes that have not reached the document store', async () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'Save notes')
    );
    useDocumentStore.getState().openDocument(
      {
        fileId: 'file-1' as DocumentId,
        filePath: '/notes/readme.md',
        mtime: 1,
      },
      'Hello'
    );
    const saveFile = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const add = vi.fn().mockResolvedValue({ ok: true, value: { success: true } });
    const commit = vi.fn().mockResolvedValue({
      ok: true,
      value: { hash: 'abcdef123456', message: 'Save notes' },
    });
    const context = {
      document: {
        filePath: '/notes/readme.md',
        content: 'Hello',
        isDirty: false,
        fileId: 'file-1',
      },
      editor: { state: { doc: { toString: () => 'Hello!' } }, isDestroyed: false },
      api: {
        git: {
          isRepo: vi.fn().mockResolvedValue({ ok: true, value: { isRepo: true } }),
          add,
          commit,
        },
        saveFile,
      },
      notify: vi.fn(),
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.commit');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(saveFile).toHaveBeenCalledWith(
      { id: 'file-1', path: '/notes/readme.md', name: 'readme.md' },
      'Hello!'
    );
    expect(useDocumentStore.getState().content).toBe('Hello!');
    expect(useDocumentStore.getState().isDirty).toBe(false);
  });

  it('saves other open files before committing the open file', async () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'Save notes')
    );
    const activeId = useTabStore.getState().addTab({
      filePath: '/notes/readme.md',
      fileName: 'readme.md',
      isDirty: true,
      content: '# Notes',
      savedContent: '',
    });
    useTabStore.getState().addTab({
      filePath: '/notes/other.md',
      fileName: 'other.md',
      isDirty: true,
      content: 'other draft',
      savedContent: '',
    });
    useTabStore.getState().setActiveTab(activeId);
    const writeFile = vi.fn().mockResolvedValue({ ok: true });
    const add = vi.fn().mockResolvedValue({ ok: true, value: { success: true } });
    const commit = vi.fn().mockResolvedValue({
      ok: true,
      value: { hash: 'abcdef123456', message: 'Save notes' },
    });
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: '# Notes', isDirty: false },
      api: {
        git: {
          isRepo: vi.fn().mockResolvedValue({ ok: true, value: { isRepo: true } }),
          add,
          commit,
        },
        writeFile,
      },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.commit');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(writeFile).toHaveBeenCalledWith('/notes/other.md', 'other draft');
    expect(add).toHaveBeenCalledWith('/notes', ['readme.md']);
    expect(commit).toHaveBeenCalledWith('/notes', 'Save notes', ['readme.md']);
  });

  it('does not commit a file that changed on disk in another tab', async () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'Save notes')
    );
    const otherId = useTabStore.getState().addTab({
      filePath: '/other/b.md',
      fileName: 'b.md',
      isDirty: false,
      content: 'other',
      savedContent: 'other',
    });
    useTabStore.getState().addTab({
      filePath: '/notes/readme.md',
      fileName: 'readme.md',
      isDirty: true,
      content: 'editor text',
      savedContent: 'old',
    });
    useTabStore.getState().setActiveTab(otherId);
    useDocumentStore.setState({ filePath: '/other/b.md', content: 'other', isDirty: false });
    noteInactiveExternalChange('/notes/readme.md', 'disk text', 10);
    const saveFile = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const writeFile = vi.fn().mockResolvedValue({ ok: true });
    const add = vi.fn().mockResolvedValue({ ok: true, value: { success: true } });
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: 'Hello', isDirty: true },
      api: {
        git: { isRepo: vi.fn().mockResolvedValue({ ok: true, value: { isRepo: true } }), add },
        saveFile,
        writeFile,
      },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.commit');
    await expect(command?.execute(context)).resolves.toEqual({
      ok: false,
      error: 'File changed on disk',
    });
    expect(saveFile).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith({
      type: 'warning',
      message: 'This file changed on disk. Save it before committing.',
    });
  });

  it('writes a deleted open file back before committing it', async () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'Restore notes')
    );
    useDocumentStore.getState().openDocument(
      {
        fileId: 'file-1' as DocumentId,
        filePath: '/notes/readme.md',
        mtime: 1,
      },
      'saved text'
    );
    useDocumentStore.getState().markFileMissing();
    const saveFile = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const add = vi.fn().mockResolvedValue({ ok: true, value: { success: true } });
    const commit = vi.fn().mockResolvedValue({
      ok: true,
      value: { hash: 'abcdef123456', message: 'Restore notes' },
    });
    const context = {
      document: {
        filePath: '/notes/readme.md',
        content: 'saved text',
        isDirty: false,
        fileId: 'file-1',
      },
      api: {
        git: {
          isRepo: vi.fn().mockResolvedValue({ ok: true, value: { isRepo: true } }),
          add,
          commit,
        },
        saveFile,
      },
      notify: vi.fn(),
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.commit');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(saveFile).toHaveBeenCalledWith(
      { id: 'file-1', path: '/notes/readme.md', name: 'readme.md' },
      'saved text'
    );
    expect(useDocumentStore.getState().fileMissing).toBe(false);
    expect(commit).toHaveBeenCalled();
  });

  it('saves unsaved edits before committing them', async () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'Save edits')
    );
    useDocumentStore.getState().openDocument(
      {
        fileId: 'file-1' as DocumentId,
        filePath: '/notes/readme.md',
        mtime: 1,
      },
      'old'
    );
    useDocumentStore.getState().setContent('# edited');
    const saveFile = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const add = vi.fn().mockResolvedValue({ ok: true, value: { success: true } });
    const commit = vi.fn().mockResolvedValue({
      ok: true,
      value: { hash: 'abcdef123456', message: 'Save edits' },
    });
    const context = {
      document: { filePath: '/notes/readme.md', content: 'old', isDirty: false, fileId: 'file-1' },
      api: {
        git: {
          isRepo: vi.fn().mockResolvedValue({ ok: true, value: { isRepo: true } }),
          add,
          commit,
        },
        saveFile,
      },
      notify: vi.fn(),
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.commit');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(saveFile).toHaveBeenCalledWith(
      { id: 'file-1', path: '/notes/readme.md', name: 'readme.md' },
      '# edited'
    );
    expect(add).toHaveBeenCalled();
    expect(commit).toHaveBeenCalled();
    expect(useDocumentStore.getState().isDirty).toBe(false);
  });

  it('does not commit when the save fails', async () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'Save edits')
    );
    const saveFile = vi.fn().mockResolvedValue({ ok: false, error: { code: 'EACCES' } });
    const add = vi.fn();
    const context = {
      document: {
        filePath: '/notes/readme.md',
        content: '# edited',
        isDirty: true,
        fileId: 'file-1',
      },
      api: {
        git: { isRepo: vi.fn().mockResolvedValue({ ok: true, value: { isRepo: true } }), add },
        saveFile,
      },
      notify: vi.fn(),
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.commit');
    await expect(command?.execute(context)).resolves.toEqual({ ok: false, error: 'EACCES' });
    expect(add).not.toHaveBeenCalled();
  });

  it('does not overwrite a file that changed on disk', async () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'Save edits')
    );
    useDocumentStore.getState().openDocument(
      {
        fileId: 'file-1' as DocumentId,
        filePath: '/notes/readme.md',
        mtime: 1,
      },
      'old'
    );
    useDocumentStore.getState().setContent('# edited');
    useDocumentStore.getState().handleExternalChange('disk', 2);
    const saveFile = vi.fn();
    const add = vi.fn();
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: 'old', isDirty: false, fileId: 'file-1' },
      api: {
        git: { isRepo: vi.fn().mockResolvedValue({ ok: true, value: { isRepo: true } }), add },
        saveFile,
      },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.commit');
    await expect(command?.execute(context)).resolves.toEqual({
      ok: false,
      error: 'File changed on disk',
    });
    expect(saveFile).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith({
      type: 'warning',
      message: 'This file changed on disk. Save it before committing.',
    });
  });
});

describe('import.html', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
  });

  it('replaces the open document with the converted markdown', async () => {
    useDocumentStore.getState().setContent('<p>Hi</p>');
    const fromHtml = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: 'Hi', warnings: [] },
    });
    const notify = vi.fn();
    const context = {
      document: { filePath: null, content: '<p>Hi</p>' },
      api: { import: { fromHtml } },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'import.html');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(useDocumentStore.getState().content).toBe('Hi');
  });

  it('converts the editor text when the command snapshot is older', async () => {
    useDocumentStore.getState().openDocument(
      {
        fileId: 'file-1' as DocumentId,
        filePath: '/notes/readme.md',
        mtime: 1,
      },
      'old'
    );
    useDocumentStore.getState().setContent('<p>Live</p>');
    const fromHtml = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: 'Live', warnings: [] },
    });
    const context = {
      document: { filePath: '/notes/readme.md', content: 'old', isDirty: false, fileId: 'file-1' },
      api: { import: { fromHtml } },
      notify: vi.fn(),
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'import.html');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(fromHtml).toHaveBeenCalledWith('<p>Live</p>');
    expect(useDocumentStore.getState().content).toBe('Live');
  });

  it('does not report an import error after the document changes', async () => {
    useDocumentStore.getState().setContent('<p>Hi</p>');
    let finishImport: (value: { ok: false; error: { message: string } }) => void = () => undefined;
    const fromHtml = vi.fn(
      () =>
        new Promise((resolve) => {
          finishImport = resolve;
        })
    );
    const notify = vi.fn();
    const context = {
      document: { filePath: null, content: '<p>Hi</p>' },
      api: { import: { fromHtml } },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'import.html');
    const pending = command?.execute(context);
    useDocumentStore.getState().setContent('kept');
    finishImport({ ok: false, error: { message: 'Could not convert HTML' } });
    await expect(pending).resolves.toEqual({
      ok: false,
      error: 'Document changed during import',
    });
    expect(useDocumentStore.getState().content).toBe('kept');
    expect(notify).toHaveBeenCalledWith({
      type: 'warning',
      message: 'The document changed during import. It was not replaced.',
    });
    expect(notify).not.toHaveBeenCalledWith({
      type: 'error',
      message: 'Could not convert HTML',
    });
  });

  it('imports a Notion page into the document', async () => {
    useDocumentStore.getState().setContent('keep');
    const fromNotion = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: '# Page', warnings: [] },
    });
    const prompt = vi.spyOn(window, 'prompt').mockImplementation((message) => {
      return String(message).includes('API') ? 'secret-token' : 'page-1';
    });
    const notify = vi.fn();
    const context = {
      document: { filePath: null, content: 'keep' },
      api: { import: { fromNotion } },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'import.notion');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(fromNotion).toHaveBeenCalledWith('page-1', 'secret-token');
    expect(useDocumentStore.getState().content).toBe('# Page');
    prompt.mockRestore();
  });
});

describe('citation.parse', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
  });

  it('appends a bibliography for parsed entries', async () => {
    useDocumentStore.getState().setContent('@article{a, title={One}}');
    const parseBibtex = vi.fn().mockResolvedValue({
      ok: true,
      value: { entries: [{ id: 'a', type: 'article', title: 'One' }], warnings: [] },
    });
    const generateBibliography = vi.fn().mockResolvedValue({
      ok: true,
      value: { bibliography: 'One. (n.d.).', entryCount: 1 },
    });
    const formatCitation = vi.fn().mockResolvedValue({
      ok: true,
      value: { formatted: 'One. (n.d.).', inlineRef: '(Unknown, n.d.)' },
    });
    const notify = vi.fn();
    const context = {
      document: { filePath: null, content: '@article{a, title={One}}' },
      api: { citation: { parseBibtex, generateBibliography, formatCitation } },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'citation.parse');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(formatCitation).toHaveBeenCalledWith({ id: 'a', type: 'article', title: 'One' }, 'apa');
    expect(useDocumentStore.getState().content).toBe('@article{a, title={One}}\n\nOne. (n.d.).');
  });

  it('parses the editor text when the command snapshot is older', async () => {
    useDocumentStore.getState().openDocument(
      {
        fileId: 'file-1' as DocumentId,
        filePath: '/notes/readme.md',
        mtime: 1,
      },
      'old'
    );
    useDocumentStore.getState().setContent('@article{a, title={Live}}');
    const parseBibtex = vi.fn().mockResolvedValue({
      ok: true,
      value: { entries: [{ id: 'a', type: 'article', title: 'Live' }], warnings: [] },
    });
    const generateBibliography = vi.fn().mockResolvedValue({
      ok: true,
      value: { bibliography: 'Live. (n.d.).', entryCount: 1 },
    });
    const formatCitation = vi.fn().mockResolvedValue({
      ok: true,
      value: { formatted: 'Live. (n.d.).', inlineRef: '(Unknown, n.d.)' },
    });
    const context = {
      document: { filePath: '/notes/readme.md', content: 'old', isDirty: false, fileId: 'file-1' },
      api: { citation: { parseBibtex, generateBibliography, formatCitation } },
      notify: vi.fn(),
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'citation.parse');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(parseBibtex).toHaveBeenCalledWith('@article{a, title={Live}}');
    expect(useDocumentStore.getState().content).toBe('@article{a, title={Live}}\n\nLive. (n.d.).');
  });

  it('does not report a citation error after the document changes', async () => {
    useDocumentStore.getState().setContent('@article{a, title={One}}');
    let finishParse: (value: { ok: false; error: { message: string } }) => void = () => undefined;
    const parseBibtex = vi.fn(
      () =>
        new Promise((resolve) => {
          finishParse = resolve;
        })
    );
    const notify = vi.fn();
    const context = {
      document: { filePath: null, content: '@article{a, title={One}}' },
      api: { citation: { parseBibtex, generateBibliography: vi.fn() } },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'citation.parse');
    const pending = command?.execute(context);
    useDocumentStore.getState().setContent('other');
    finishParse({ ok: false, error: { message: 'Bad BibTeX' } });
    await expect(pending).resolves.toEqual({
      ok: false,
      error: 'Document changed during citation parse',
    });
    expect(useDocumentStore.getState().content).toBe('other');
    expect(notify).toHaveBeenCalledWith({
      type: 'warning',
      message: 'The document changed while citations were parsed. It was not changed.',
    });
    expect(notify).not.toHaveBeenCalledWith({ type: 'error', message: 'Bad BibTeX' });
  });
});

describe('summarizeSearchResults', () => {
  it('names the matching files', () => {
    expect(summarizeSearchResults('Title', [])).toBe('Search for "Title": no matches');
    expect(
      summarizeSearchResults('Title', [{ fileName: 'a.md' }, { filePath: '/notes/b.md' }])
    ).toBe('Search for "Title": 2 matches (a.md, b.md)');
  });
});

function workspaceModel(rootPath: string): WorkspaceModel {
  return {
    version: 1,
    workspace: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Project',
      rootPath,
      documents: [],
      activeDocumentId: null,
      createdAt: '2026-11-18T08:00:00.000Z',
      updatedAt: '2026-11-18T08:00:00.000Z',
    },
    projects: [],
    linkIndex: {},
  };
}

describe('searchDirectoryForFile', () => {
  it('uses the workspace root when the open file is inside it', () => {
    expect(searchDirectoryForFile('/project/docs/readme.md', '/project')).toBe('/project');
    expect(searchDirectoryForFile('/project/docs/readme.md', '/project/')).toBe('/project');
  });

  it('keeps the file folder when it is outside the workspace', () => {
    expect(searchDirectoryForFile('/project-other/readme.md', '/project')).toBe('/project-other');
    expect(searchDirectoryForFile('/project/docs/readme.md', null)).toBe('/project/docs');
  });
});

describe('search.workspace', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
    useDocumentStore.getState().reset();
    useTabStore.getState().reset();
  });

  it('indexes an unindexed folder before searching and passes exclude patterns', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Title');
    localStorage.clear();
    localStorage.setItem(
      'mdxpad:workspace-folder-excludes',
      JSON.stringify({ 'ws\n/notes': ['dist'] })
    );
    const status = vi.fn().mockResolvedValue({
      ok: true,
      value: { indexed: false, fileCount: 0, lastIndexedAt: null },
    });
    const index = vi
      .fn()
      .mockResolvedValue({ ok: true, value: { indexedFiles: 2, indexTimeMs: 1 } });
    const search = vi.fn().mockResolvedValue({
      ok: true,
      value: { results: [{ filePath: '/notes/a.md' }], totalResults: 1, queryTimeMs: 1 },
    });
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: '# Title\n' },
      api: { search: { status, index, search } },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'search.workspace');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(index).toHaveBeenCalledWith('/notes', undefined, ['dist']);
    expect(search).toHaveBeenCalledWith('/notes', 'Title', 10, undefined, ['dist']);
    expect(notify).toHaveBeenCalledWith({
      type: 'info',
      message: 'Search for "Title": 1 match (a.md)',
    });
  });

  it('does not report search results after the open file leaves that folder', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Title');
    useDocumentStore.setState({ filePath: '/notes/readme.md', content: '# Title\n' });
    let finishSearch: (value: {
      ok: true;
      value: { results: { filePath: string }[]; totalResults: number; queryTimeMs: number };
    }) => void = () => undefined;
    const status = vi.fn().mockResolvedValue({
      ok: true,
      value: { indexed: true, fileCount: 1, lastIndexedAt: null },
    });
    const search = vi.fn(
      () =>
        new Promise((resolve) => {
          finishSearch = resolve;
        })
    );
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: '# Title\n' },
      api: { search: { status, index: vi.fn(), search } },
      notify,
    } as unknown as CommandContext;
    const command = SERVICE_COMMANDS.find((item) => item.id === 'search.workspace');
    const pending = command?.execute(context);
    await vi.waitFor(() => expect(search).toHaveBeenCalled());
    useDocumentStore.setState({ filePath: '/elsewhere/a.md', content: 'other' });
    finishSearch({
      ok: true,
      value: { results: [{ filePath: '/notes/a.md' }], totalResults: 1, queryTimeMs: 1 },
    });
    await pending;

    expect(notify).toHaveBeenCalledWith({
      type: 'info',
      message: 'The open file changed before that folder finished.',
    });
  });

  it('includes unsaved editor text the index has not seen', async () => {
    useDocumentStore.getState().openDocument(
      {
        fileId: 'file-1' as DocumentId,
        filePath: '/notes/readme.md',
        mtime: 1,
      },
      'old'
    );
    useDocumentStore.getState().setContent('brand new phrase');
    vi.spyOn(window, 'prompt').mockReturnValue('brand new');
    const status = vi.fn().mockResolvedValue({
      ok: true,
      value: { indexed: true, fileCount: 1, lastIndexedAt: null },
    });
    const search = vi.fn().mockResolvedValue({
      ok: true,
      value: { results: [], totalResults: 0, queryTimeMs: 1 },
    });
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: 'old', isDirty: true, fileId: 'file-1' },
      api: { search: { status, search } },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'search.workspace');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(notify).toHaveBeenCalledWith({
      type: 'info',
      message: 'Search for "brand new": 1 match (readme.md)',
    });
  });

  it('includes keystrokes the document store has not stored', async () => {
    useDocumentStore.getState().openDocument(
      {
        fileId: 'file-1' as DocumentId,
        filePath: '/notes/readme.md',
        mtime: 1,
      },
      'old'
    );
    vi.spyOn(window, 'prompt').mockReturnValue('fresh phrase');
    const status = vi.fn().mockResolvedValue({
      ok: true,
      value: { indexed: true, fileCount: 1, lastIndexedAt: null },
    });
    const search = vi.fn().mockResolvedValue({
      ok: true,
      value: { results: [], totalResults: 0, queryTimeMs: 1 },
    });
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: 'old', isDirty: false, fileId: 'file-1' },
      editor: { state: { doc: { toString: () => 'fresh phrase' } }, isDestroyed: false },
      api: { search: { status, search } },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'search.workspace');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(notify).toHaveBeenCalledWith({
      type: 'info',
      message: 'Search for "fresh phrase": 1 match (readme.md)',
    });
  });

  it('includes an unsaved tab that is not the active file', async () => {
    useDocumentStore.getState().openDocument(
      {
        fileId: 'file-1' as DocumentId,
        filePath: '/notes/readme.md',
        mtime: 1,
      },
      'readme'
    );
    useTabStore.getState().addTab({
      filePath: '/notes/other.md',
      fileName: 'other.md',
      isDirty: true,
      content: 'hidden phrase',
      savedContent: '',
    });
    vi.spyOn(window, 'prompt').mockReturnValue('hidden phrase');
    const status = vi.fn().mockResolvedValue({
      ok: true,
      value: { indexed: true, fileCount: 1, lastIndexedAt: null },
    });
    const search = vi.fn().mockResolvedValue({
      ok: true,
      value: { results: [], totalResults: 0, queryTimeMs: 1 },
    });
    const notify = vi.fn();
    const context = {
      document: {
        filePath: '/notes/readme.md',
        content: 'readme',
        isDirty: false,
        fileId: 'file-1',
      },
      api: { search: { status, search } },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'search.workspace');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(notify).toHaveBeenCalledWith({
      type: 'info',
      message: 'Search for "hidden phrase": 1 match (other.md)',
    });
  });

  it('cancels when the query is empty', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('   ');
    const search = vi.fn();
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: '# Title\n' },
      api: { search: { search } },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'search.workspace');
    await expect(command?.execute(context)).resolves.toEqual({
      ok: false,
      error: 'Search cancelled',
    });
    expect(search).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith({ type: 'info', message: 'Search cancelled' });
  });

  it('searches the open workspace instead of only the file folder', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Title');
    localStorage.clear();
    localStorage.setItem(
      'mdxpad:workspace-folder-excludes',
      JSON.stringify({ 'ws\n/project': ['dist'] })
    );
    useWorkspaceStore.setState({ model: workspaceModel('/project') });
    const status = vi.fn().mockResolvedValue({
      ok: true,
      value: { indexed: true, fileCount: 2, lastIndexedAt: '2026-11-18T08:00:00.000Z' },
    });
    const search = vi.fn().mockResolvedValue({
      ok: true,
      value: { results: [{ filePath: '/project/other.md' }], totalResults: 1, queryTimeMs: 1 },
    });
    const context = {
      document: { filePath: '/project/docs/readme.md', content: '# Title\n' },
      api: { search: { status, search } },
      notify: vi.fn(),
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'search.workspace');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(search).toHaveBeenCalledWith('/project', 'Title', 10, undefined, ['dist']);
  });
});
