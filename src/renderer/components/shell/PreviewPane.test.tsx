import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';

import { PreviewPane } from './PreviewPane';

const { usePreviewMock } = vi.hoisted(() => ({
  usePreviewMock: vi.fn(() => ({
    state: { status: 'idle' as const },
    lastSuccessfulRender: null,
    lastSuccessfulDocumentKey: null,
    scrollRatio: 0,
    setScrollRatio: vi.fn(),
  })),
}));

vi.mock('@renderer/hooks/usePreview', () => ({
  usePreview: usePreviewMock,
}));

describe('shell preview', () => {
  beforeEach(() => {
    usePreviewMock.mockClear();
    useDocumentStore.getState().reset();
  });

  it('compiles the open document while image inlining is still running', async () => {
    let resolveInline: (value: string) => void = () => undefined;
    const inline = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveInline = resolve;
        })
    );
    vi.stubGlobal('mdxpad', { inlinePreviewImages: inline });
    useDocumentStore.setState({ filePath: '/notes/a.md', content: '# A' });

    render(<PreviewPane />);
    expect(usePreviewMock).toHaveBeenCalledWith('# A', { documentKey: '/notes/a.md' });

    act(() => {
      resolveInline('INLINED A');
    });
    await waitFor(() => {
      expect(usePreviewMock).toHaveBeenCalledWith('INLINED A', { documentKey: '/notes/a.md' });
    });

    act(() => {
      useDocumentStore.setState({ filePath: '/notes/b.md', content: '# B' });
    });

    expect(usePreviewMock).toHaveBeenLastCalledWith('# B', { documentKey: '/notes/b.md' });
  });
});
