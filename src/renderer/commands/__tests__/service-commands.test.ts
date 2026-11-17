import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CommandContext } from '@shared/types/commands';
import { useDocumentStore } from '@renderer/stores/document-store';
import {
  SERVICE_COMMANDS,
  summarizeGitDiff,
  summarizeGitLog,
  summarizeGitStatus,
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

describe('search.workspace', () => {
  it('indexes an unindexed folder before searching and passes exclude patterns', async () => {
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
    expect(notify).toHaveBeenCalledWith({ type: 'info', message: 'Search found 1 match' });
  });
});
