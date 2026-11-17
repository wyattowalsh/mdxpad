import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { removeAllCss } from './css-injector';
import { CUSTOM_CSS_STORAGE_KEY } from './custom-css-storage';
import { getPreviewCss } from './preview-css';
import { CssEditorDialog } from './CssEditorDialog';

describe('CssEditorDialog', () => {
  beforeEach(() => {
    localStorage.clear();
    removeAllCss();
  });

  it('restores the saved preview CSS when live preview is turned off', () => {
    localStorage.setItem(
      CUSTOM_CSS_STORAGE_KEY,
      JSON.stringify({ css: 'p { color: blue; }', scope: 'preview' })
    );
    render(<CssEditorDialog isOpen onClose={() => undefined} />);

    expect(getPreviewCss()).toBe('p { color: blue; }');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'p { color: red; }' } });
    expect(getPreviewCss()).toBe('p { color: red; }');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Live preview' }));
    expect(getPreviewCss()).toBe('p { color: blue; }');
  });

  it('saves the chosen scope with the stylesheet', () => {
    const onClose = () => undefined;
    render(<CssEditorDialog isOpen onClose={onClose} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'app' } });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'body { color: black; }' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(localStorage.getItem(CUSTOM_CSS_STORAGE_KEY)).toBe(
      JSON.stringify({ css: 'body { color: black; }', scope: 'app' })
    );
    expect(getPreviewCss()).toBe('');
    expect(document.querySelector('[data-mdxpad-injected="user-custom-css"]')?.textContent).toBe(
      'body { color: black; }'
    );
  });
});
