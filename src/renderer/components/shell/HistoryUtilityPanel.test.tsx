import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';
import { useVersionHistoryStore } from '@renderer/stores/version-history-store';

import { HistoryUtilityPanel } from './HistoryUtilityPanel';

describe('HistoryUtilityPanel', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useVersionHistoryStore.getState().reset();
  });

  it('shows saved versions for the open file', async () => {
    useDocumentStore.setState({ filePath: '/tmp/note.mdx' });
    vi.stubGlobal('mdxpad', {
      history: {
        getHistory: vi.fn().mockResolvedValue({
          entries: [
            {
              id: 'snapshot-1',
              timestamp: Date.now(),
              source: 'manual',
              label: 'Saved copy',
            },
          ],
        }),
        getVersion: vi.fn(),
      },
    });

    render(<HistoryUtilityPanel />);

    await waitFor(() => {
      expect(screen.getByText('Saved copy')).toBeTruthy();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('hides versions that belong to another file', () => {
    useVersionHistoryStore
      .getState()
      .loadHistory(
        [{ id: 'snapshot-old', timestamp: 1, source: 'manual', label: 'Other file' }],
        '/tmp/other.mdx'
      );
    useDocumentStore.setState({ filePath: '/tmp/note.mdx' });
    vi.stubGlobal('mdxpad', {
      history: {
        getHistory: vi.fn().mockReturnValue(new Promise(() => undefined)),
        getVersion: vi.fn(),
      },
    });

    render(<HistoryUtilityPanel />);

    expect(screen.queryByText('Other file')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save a snapshot of the editor' })).toBeTruthy();
  });

  it('shows why version history did not load', async () => {
    useDocumentStore.setState({ filePath: '/tmp/note.mdx' });
    vi.stubGlobal('mdxpad', {
      history: {
        getHistory: vi
          .fn()
          .mockRejectedValue(new Error('Open this file before reading its history')),
        getVersion: vi.fn(),
      },
    });

    render(<HistoryUtilityPanel />);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Open this file before reading its history'
      );
    });
  });

  it('does not replace the open file history with a snapshot from the previous file', async () => {
    useDocumentStore.setState({ filePath: '/tmp/a.md', content: 'A' });
    let finishSnapshot: (value: { ok: boolean }) => void = () => undefined;
    const createSnapshot = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSnapshot = resolve;
        })
    );
    const getHistory = vi.fn().mockImplementation((filePath: string) =>
      Promise.resolve({
        entries: [
          {
            id: filePath,
            timestamp: 1,
            source: 'manual',
            label: filePath.endsWith('b.md') ? 'File B' : 'File A',
          },
        ],
      })
    );
    vi.stubGlobal('mdxpad', {
      history: { getHistory, getVersion: vi.fn(), createSnapshot },
    });

    render(<HistoryUtilityPanel />);
    await waitFor(() => {
      expect(screen.getByText('File A')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save a snapshot of the editor' }));
    act(() => {
      useDocumentStore.setState({ filePath: '/tmp/b.md', content: 'B' });
    });
    await waitFor(() => {
      expect(screen.getByText('File B')).toBeTruthy();
    });
    await act(async () => {
      finishSnapshot({ ok: true });
    });

    await waitFor(() => {
      expect(useVersionHistoryStore.getState().currentFilePath).toBe('/tmp/b.md');
    });
    expect(screen.getByText('File B')).toBeTruthy();
    expect(screen.queryByText('File A')).toBeNull();
  });

  it('saves a snapshot of the editor text', async () => {
    useDocumentStore.setState({ filePath: '/tmp/note.mdx', content: '# Live' });
    const createSnapshot = vi.fn().mockResolvedValue({
      ok: true,
      entry: { id: 'snapshot-1', timestamp: 1, source: 'manual', label: 'Editor snapshot' },
    });
    const getHistory = vi.fn().mockResolvedValue({ entries: [] });
    vi.stubGlobal('mdxpad', {
      history: { getHistory, getVersion: vi.fn(), createSnapshot },
    });

    render(<HistoryUtilityPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Save a snapshot of the editor' }));

    await waitFor(() => {
      expect(createSnapshot).toHaveBeenCalledWith('/tmp/note.mdx', 'Editor snapshot', '# Live');
    });
  });
});
