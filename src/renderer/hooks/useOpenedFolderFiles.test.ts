import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpenedFolderFiles } from './useOpenedFolderFiles';

describe('useOpenedFolderFiles', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists the other documents in the open file folder', async () => {
    vi.stubGlobal('mdxpad', {
      listDirectory: vi.fn().mockResolvedValue({
        ok: true,
        files: [{ name: 'other.md', path: '/docs/other.md' }],
      }),
    });

    const { result } = renderHook(() => useOpenedFolderFiles('/docs/note.md'));

    await waitFor(() => {
      expect(result.current.files).toEqual([{ name: 'other.md', path: '/docs/other.md' }]);
    });
    expect(result.current.error).toBeNull();
  });

  it('reports why the folder could not be listed', async () => {
    vi.stubGlobal('mdxpad', {
      listDirectory: vi.fn().mockRejectedValue(new Error('Open this folder from the file dialog')),
    });

    const { result } = renderHook(() => useOpenedFolderFiles('/docs/note.md'));

    await waitFor(() => {
      expect(result.current.error).toBe('Open this folder from the file dialog');
    });
    expect(result.current.files).toEqual([]);
  });

  it('opens a folder inside the opened directory and ignores a path outside it', async () => {
    const listDirectory = vi.fn(async (directory: string) => {
      if (directory === '/docs/notes') {
        return {
          ok: true,
          files: [{ name: 'a.md', path: '/docs/notes/a.md', kind: 'file' as const }],
        };
      }
      return {
        ok: true,
        files: [{ name: 'notes', path: '/docs/notes', kind: 'directory' as const }],
      };
    });
    vi.stubGlobal('mdxpad', { listDirectory });

    const { result } = renderHook(() => useOpenedFolderFiles('/docs/note.md'));
    await waitFor(() => {
      expect(result.current.files[0]?.name).toBe('notes');
    });
    expect(result.current.canGoUp).toBe(false);

    act(() => {
      result.current.openDirectory('/docs/notes');
    });
    await waitFor(() => {
      expect(result.current.files[0]?.path).toBe('/docs/notes/a.md');
    });
    expect(result.current.canGoUp).toBe(true);
    expect(listDirectory).toHaveBeenCalledWith('/docs/notes');

    act(() => {
      result.current.openDirectory('/docs/../secret');
      result.current.openDirectory('/other');
    });
    expect(result.current.files[0]?.path).toBe('/docs/notes/a.md');

    act(() => {
      result.current.goUp();
    });
    await waitFor(() => {
      expect(result.current.canGoUp).toBe(false);
      expect(result.current.files[0]?.name).toBe('notes');
    });
  });
});
