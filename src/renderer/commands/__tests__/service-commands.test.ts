import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CommandContext } from '@shared/types/commands';
import { useDocumentStore } from '@renderer/stores/document-store';
import { SERVICE_COMMANDS } from '../service-commands';

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
