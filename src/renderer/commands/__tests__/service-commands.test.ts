import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CommandContext } from '@shared/types/commands';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useWorkspaceStore } from '@renderer/stores/workspace-store';
import type { WorkspaceModel } from '@shared/types/workspace';
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
      api: { git: { log } },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.log');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(log).toHaveBeenCalledWith('/notes', 5);
    expect(notify).toHaveBeenCalledWith({ type: 'info', message: 'Git log: abcdef1 Add notes' });
  });
});

describe('git.commit', () => {
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
      api: { git: { add, commit } },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'git.commit');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(add).toHaveBeenCalledWith('/notes', ['readme.md']);
    expect(commit).toHaveBeenCalledWith('/notes', 'Save notes', ['readme.md']);
    expect(notify).toHaveBeenCalledWith({ type: 'success', message: 'Committed abcdef1' });
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
    const notify = vi.fn();
    const context = {
      document: { filePath: null, content: '@article{a, title={One}}' },
      api: { citation: { parseBibtex, generateBibliography } },
      notify,
    } as unknown as CommandContext;

    const command = SERVICE_COMMANDS.find((item) => item.id === 'citation.parse');
    await expect(command?.execute(context)).resolves.toEqual({ ok: true });
    expect(useDocumentStore.getState().content).toBe('@article{a, title={One}}\n\nOne. (n.d.).');
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
