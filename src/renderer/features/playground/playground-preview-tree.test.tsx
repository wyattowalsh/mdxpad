import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildPlaygroundPreview } from './playground-preview-tree';

describe('buildPlaygroundPreview', () => {
  it('renders an allowlisted element without its attributes', () => {
    const preview = buildPlaygroundPreview('<h1 onclick="alert(1)">Hi</h1>');
    expect(preview.ok).toBe(true);
    if (!preview.ok) {
      return;
    }
    const { container } = render(<div>{preview.element}</div>);
    const heading = container.querySelector('h1');
    expect(heading?.textContent).toBe('Hi');
    expect(heading?.getAttribute('onclick')).toBeNull();
  });

  it('rejects script and unknown elements', () => {
    expect(buildPlaygroundPreview('<script>alert(1)</script>').ok).toBe(false);
    expect(buildPlaygroundPreview('<img src="x" />').ok).toBe(false);
  });
});
