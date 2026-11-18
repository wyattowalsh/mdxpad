import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import type { DroppedFileResponse } from '@shared/contracts/file-schemas';
import { useStatusMessageStore } from '@renderer/stores/status-message-store';

import { useDragDrop } from './useDragDrop';

describe('useDragDrop', () => {
  let deliver: (event: DroppedFileResponse) => void;

  beforeEach(() => {
    useStatusMessageStore.setState({ message: '' });
    deliver = () => undefined;
    vi.stubGlobal('mdxpad', {
      onDroppedFile: (callback: (event: DroppedFileResponse) => void) => {
        deliver = callback;
        return () => undefined;
      },
    });
  });

  it('opens the document from a preload drop', () => {
    const onFileDrop = vi.fn();
    renderHook(() => useDragDrop(onFileDrop));

    deliver({ ok: true, path: '/docs/note.mdx', content: '# Note' });

    expect(onFileDrop).toHaveBeenCalledWith('/docs/note.mdx');
    expect(useStatusMessageStore.getState().message).toBe('');
  });

  it('shows a message when the drop is refused', () => {
    const onFileDrop = vi.fn();
    renderHook(() => useDragDrop(onFileDrop));

    deliver({ ok: false, message: 'Drop a Markdown or MDX file' });

    expect(onFileDrop).not.toHaveBeenCalled();
    expect(useStatusMessageStore.getState().message).toBe('Drop a Markdown or MDX file');
  });
});
