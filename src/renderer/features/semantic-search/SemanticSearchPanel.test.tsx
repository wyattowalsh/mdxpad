import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { SemanticSearchPanel } from './SemanticSearchPanel';
import { useSemanticSearchStore } from './semantic-search-store';

describe('SemanticSearchPanel', () => {
  beforeEach(() => {
    useSemanticSearchStore.getState().reset();
  });

  it('drops results from the previous workspace', async () => {
    useSemanticSearchStore.setState({
      query: 'brand',
      results: [
        {
          filePath: '/notes/readme.md',
          content: 'brand new phrase',
          score: 0.9,
          chunkIndex: 0,
        },
      ],
    });

    const view = render(<SemanticSearchPanel workspacePath="/notes" />);
    expect(screen.getByText('/notes/readme.md')).toBeTruthy();

    view.rerender(<SemanticSearchPanel workspacePath="/other" />);

    await waitFor(() => {
      expect(screen.queryByText('/notes/readme.md')).toBeNull();
    });
  });
});
