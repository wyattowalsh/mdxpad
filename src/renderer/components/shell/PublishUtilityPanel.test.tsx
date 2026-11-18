import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';

import { PublishUtilityPanel } from './PublishUtilityPanel';

describe('PublishUtilityPanel', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    vi.unstubAllGlobals();
  });

  it('publishes the open file with the selected options', async () => {
    useDocumentStore.setState({
      filePath: '/docs/note.mdx',
      fileName: 'note.mdx',
      content: '# Edited',
    });
    const publish = vi.fn().mockResolvedValue({ success: true, filesGenerated: 1, errors: [] });
    vi.stubGlobal('mdxpad', {
      share: {
        onPublishProgress: () => () => undefined,
        chooseDirectory: vi.fn().mockResolvedValue({ canceled: false, path: '/tmp/site' }),
        openDirectory: vi.fn(),
        publish,
      },
    });

    render(<PublishUtilityPanel />);
    fireEvent.click(screen.getByText('Browse'));
    await waitFor(() => {
      expect(screen.getByText('/tmp/site')).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText('Generate index page'));
    fireEvent.click(screen.getByText('Publish 1 file'));

    await waitFor(() => {
      expect(publish).toHaveBeenCalledWith({
        files: [{ path: '/docs/note.mdx', title: 'note.mdx', content: '# Edited' }],
        outputDir: '/tmp/site',
        includeStyles: true,
        includeHighlighting: true,
        generateIndex: false,
      });
    });
    expect(await screen.findByText('Generated 1 file(s)')).toBeTruthy();
  });

  it('publishes an untitled document from the editor', async () => {
    useDocumentStore.setState({ filePath: null, fileName: 'Untitled', content: '# Draft' });
    const publish = vi.fn().mockResolvedValue({ success: true, filesGenerated: 1, errors: [] });
    vi.stubGlobal('mdxpad', {
      share: {
        onPublishProgress: () => () => undefined,
        chooseDirectory: vi.fn().mockResolvedValue({ canceled: false, path: '/tmp/site' }),
        openDirectory: vi.fn(),
        publish,
      },
    });

    render(<PublishUtilityPanel />);
    fireEvent.click(screen.getByText('Browse'));
    await screen.findByText('/tmp/site');
    fireEvent.click(screen.getByText('Publish 1 file'));

    await waitFor(() => {
      expect(publish).toHaveBeenCalledWith({
        files: [{ path: 'Untitled.md', title: 'Untitled', content: '# Draft' }],
        outputDir: '/tmp/site',
        includeStyles: true,
        includeHighlighting: true,
        generateIndex: true,
      });
    });
  });

  it('shows why publishing failed', async () => {
    useDocumentStore.setState({ filePath: '/docs/note.mdx', fileName: 'note.mdx' });
    vi.stubGlobal('mdxpad', {
      share: {
        onPublishProgress: () => () => undefined,
        chooseDirectory: vi.fn().mockResolvedValue({ canceled: false, path: '/tmp/site' }),
        openDirectory: vi.fn(),
        publish: vi.fn().mockRejectedValue(new Error('Open this file before publishing it')),
      },
    });

    render(<PublishUtilityPanel />);
    fireEvent.click(screen.getByText('Browse'));
    await screen.findByText('/tmp/site');
    fireEvent.click(screen.getByText('Publish 1 file'));

    expect(await screen.findByText('Open this file before publishing it')).toBeTruthy();
  });
});
