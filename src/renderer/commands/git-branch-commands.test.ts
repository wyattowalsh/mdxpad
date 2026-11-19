import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CommandContext } from '@shared/types/commands';
import { useDocumentStore } from '@renderer/stores/document-store';

import { SERVICE_COMMANDS } from './service-commands';

function command(id: string) {
  return SERVICE_COMMANDS.find((item) => item.id === id);
}

describe('git branches and checkout', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    vi.unstubAllGlobals();
  });

  it('lists branches after confirming the folder is a repository', async () => {
    const isRepo = vi.fn().mockResolvedValue({ ok: true, value: { isRepo: true } });
    const branches = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        current: 'main',
        branches: [
          { name: 'main', current: true },
          { name: 'draft', current: false },
        ],
      },
    });
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: '' },
      api: { git: { isRepo, branches } },
      notify,
    } as unknown as CommandContext;

    await expect(command('git.branches')?.execute(context)).resolves.toEqual({ ok: true });
    expect(isRepo).toHaveBeenCalledWith('/notes');
    expect(branches).toHaveBeenCalledWith('/notes');
    expect(notify).toHaveBeenCalledWith({
      type: 'info',
      message: 'Git branches: main (current), draft',
    });
  });

  it('does not list branches for a folder that is not a repository', async () => {
    const isRepo = vi.fn().mockResolvedValue({ ok: true, value: { isRepo: false } });
    const branches = vi.fn();
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: '' },
      api: { git: { isRepo, branches } },
      notify,
    } as unknown as CommandContext;

    await expect(command('git.branches')?.execute(context)).resolves.toEqual({
      ok: false,
      error: 'No git repository',
    });
    expect(branches).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith({
      type: 'warning',
      message: 'This folder is not a git repository',
    });
  });

  it('checks out the branch the user names', async () => {
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'draft')
    );
    const isRepo = vi.fn().mockResolvedValue({ ok: true, value: { isRepo: true } });
    const checkout = vi.fn().mockResolvedValue({
      ok: true,
      value: { success: true, branch: 'draft' },
    });
    const notify = vi.fn();
    const context = {
      document: { filePath: '/notes/readme.md', content: '' },
      api: { git: { isRepo, checkout } },
      notify,
    } as unknown as CommandContext;

    await expect(command('git.checkout')?.execute(context)).resolves.toEqual({ ok: true });
    expect(checkout).toHaveBeenCalledWith('/notes', 'draft');
    expect(notify).toHaveBeenCalledWith({ type: 'success', message: 'Checked out draft' });
  });
});
