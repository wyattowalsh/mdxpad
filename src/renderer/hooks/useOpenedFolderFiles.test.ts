import { renderHook, waitFor } from '@testing-library/react';
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
});
