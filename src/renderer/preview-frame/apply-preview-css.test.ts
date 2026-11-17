import { describe, expect, it } from 'vitest';

import { applyPreviewCss } from './apply-preview-css';

describe('applyPreviewCss', () => {
  it('puts the CSS in the preview document and clears it', () => {
    applyPreviewCss('p { color: red; }');
    const style = document.getElementById('mdxpad-preview-css');
    expect(style?.textContent).toBe('p { color: red; }');

    applyPreviewCss('   ');
    expect(document.getElementById('mdxpad-preview-css')).toBeNull();
  });
});
