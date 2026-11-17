import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';

import { ShareUtilityPanel } from './ShareUtilityPanel';

describe('ShareUtilityPanel', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
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
});
