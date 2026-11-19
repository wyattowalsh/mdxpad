import { describe, expect, it } from 'vitest';

import { applyPreviewCss } from './apply-preview-css';

describe('applyPreviewCss', () => {
  it('puts the CSS in the preview document and clears it', () => {
    applyPreviewCss('p { color: red; }');
    const style = document.getElementById('mdxpad-preview-css');
    expect(style?.textContent).toBe('p { color: red; }');

    applyPreviewCss('body{background:\\75rl(file:///etc/passwd);color:red}');
    expect(document.getElementById('mdxpad-preview-css')?.textContent).not.toContain('file:');
    expect(document.getElementById('mdxpad-preview-css')?.textContent).toContain('color:red');

    applyPreviewCss('   ');
    expect(document.getElementById('mdxpad-preview-css')).toBeNull();
  });
});
