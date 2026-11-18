import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';
import { registerLiveSourceText } from '@renderer/components/tabs/live-source-text';

import { ShareUtilityPanel } from './ShareUtilityPanel';

function untitledTab(fileName: string): string {
  return useTabStore.getState().addTab({
    filePath: null,
    fileName,
    isDirty: false,
    content: '',
    savedContent: '',
  });
}

describe('ShareUtilityPanel', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useTabStore.getState().reset();
    registerLiveSourceText(null);
  });

  it('shows why share links did not load', async () => {
    useDocumentStore.setState({ filePath: '/tmp/note.mdx' });
    vi.stubGlobal('mdxpad', {
      share: {
        getLinks: vi.fn().mockRejectedValue(new Error('Open this file before sharing it')),
        createLink: vi.fn(),
        revokeLink: vi.fn(),
      },
    });

    render(<ShareUtilityPanel />);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Open this file before sharing it');
    });
  });

  it('hides links from the previous file', async () => {
    const otherLink = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      token: 'tokentokentoken1',
      docId: '/tmp/other.md',
      url: 'https://share.example/other',
      accessMode: 'read-only' as const,
      createdAt: 1,
      expiresAt: null,
      isActive: true,
    };
    const getLinks = vi
      .fn()
      .mockResolvedValueOnce({ links: [otherLink] })
      .mockReturnValueOnce(new Promise(() => undefined));
    vi.stubGlobal('mdxpad', {
      share: { getLinks, createLink: vi.fn(), revokeLink: vi.fn(), moveUntitled: vi.fn() },
    });
    useDocumentStore.setState({ filePath: '/tmp/other.md' });

    render(<ShareUtilityPanel />);
    expect(await screen.findByText('https://share.example/other')).toBeTruthy();

    act(() => {
      useDocumentStore.setState({ filePath: '/tmp/note.mdx' });
    });

    expect(screen.queryByText('https://share.example/other')).toBeNull();
  });

  it('loads a different list for each untitled tab', async () => {
    const getLinks = vi.fn().mockResolvedValue({ links: [] });
    vi.stubGlobal('mdxpad', {
      share: { getLinks, createLink: vi.fn(), revokeLink: vi.fn(), moveUntitled: vi.fn() },
    });
    const first = untitledTab('Untitled');
    useDocumentStore.setState({ filePath: null });

    render(<ShareUtilityPanel />);

    await waitFor(() => {
      expect(getLinks).toHaveBeenCalledWith({ docId: `untitled:${first}` });
    });

    act(() => {
      untitledTab('Untitled 2');
    });

    await waitFor(() => {
      expect(getLinks).toHaveBeenCalledWith({
        docId: `untitled:${useTabStore.getState().activeTabId}`,
      });
    });
  });

  it('moves untitled links onto the file when that tab is saved', async () => {
    const getLinks = vi.fn().mockResolvedValue({ links: [] });
    const moveUntitled = vi.fn().mockResolvedValue({ links: [] });
    vi.stubGlobal('mdxpad', {
      share: { getLinks, createLink: vi.fn(), revokeLink: vi.fn(), moveUntitled },
    });
    const tabId = untitledTab('Untitled');
    useDocumentStore.setState({ filePath: null });

    render(<ShareUtilityPanel />);
    await waitFor(() => {
      expect(getLinks).toHaveBeenCalledWith({ docId: `untitled:${tabId}` });
    });

    act(() => {
      useDocumentStore.setState({ filePath: '/tmp/saved.md' });
    });

    await waitFor(() => {
      expect(moveUntitled).toHaveBeenCalledWith({
        fromDocId: `untitled:${tabId}`,
        toDocId: '/tmp/saved.md',
      });
    });
  });

  it('does not show a share error from the previous file', async () => {
    let rejectCreate: (error: Error) => void = () => undefined;
    const createLink = vi.fn().mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectCreate = reject;
        })
    );
    const getLinks = vi.fn().mockResolvedValue({ links: [] });
    vi.stubGlobal('mdxpad', {
      share: { getLinks, createLink, revokeLink: vi.fn(), moveUntitled: vi.fn() },
    });
    useDocumentStore.setState({ filePath: '/tmp/a.md' });

    render(<ShareUtilityPanel />);
    await waitFor(() => {
      expect(getLinks).toHaveBeenCalledWith({ docId: '/tmp/a.md' });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Link' }));
    act(() => {
      useDocumentStore.setState({ filePath: '/tmp/b.md' });
    });
    await waitFor(() => {
      expect(getLinks).toHaveBeenCalledWith({ docId: '/tmp/b.md' });
    });
    await act(async () => {
      rejectCreate(new Error('Could not save the share link'));
    });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shares the keystrokes that are still only in the editor', async () => {
    const createLink = vi.fn().mockResolvedValue({
      link: {
        id: '11111111-1111-4111-8111-111111111111',
        token: 'tokentokentoken1',
        docId: '/tmp/note.mdx',
        url: 'https://example.com/s/tokentokentoken1',
        accessMode: 'read-only',
        createdAt: 1,
        expiresAt: null,
        isActive: true,
      },
    });
    const getLinks = vi.fn().mockResolvedValue({ links: [] });
    vi.stubGlobal('mdxpad', {
      share: { getLinks, createLink, revokeLink: vi.fn(), moveUntitled: vi.fn() },
    });
    useDocumentStore.setState({ filePath: '/tmp/note.mdx', content: 'Hello' });
    registerLiveSourceText(() => 'Hello!');

    render(<ShareUtilityPanel />);
    await waitFor(() => {
      expect(getLinks).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Link' }));

    await waitFor(() => {
      expect(createLink).toHaveBeenCalledWith(
        expect.objectContaining({ docId: '/tmp/note.mdx', content: 'Hello!' })
      );
    });
  });
});
