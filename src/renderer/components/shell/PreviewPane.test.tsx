import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';
import { usePreviewStore } from '@renderer/stores/preview-store';

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

  it('gives a new document its own compile clock when the text matches', () => {
    vi.useFakeTimers();
    const onErrorsChange = vi.fn();
    usePreviewStore.getState().reset();
    useDocumentStore.setState({ filePath: '/notes/a.md', content: '' });
    render(<PreviewPane onErrorsChange={onErrorsChange} />);

    act(() => {
      useDocumentStore.setState({ content: '# Same' });
      usePreviewStore.getState().startCompiling();
    });
    act(() => {
      vi.advanceTimersByTime(2900);
    });
    act(() => {
      useDocumentStore.setState({ filePath: '/notes/b.md', content: '# Same' });
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onErrorsChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onErrorsChange).toHaveBeenCalledWith([
      expect.objectContaining({ message: 'Preview compilation timed out after 3 seconds' }),
    ]);
    vi.useRealTimers();
  });
});
