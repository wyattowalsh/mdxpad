import { beforeEach, describe, expect, it } from 'vitest';

import { removeAllCss } from './css-injector';
import {
  applySavedCustomCss,
  CUSTOM_CSS_STORAGE_KEY,
  parseSavedCustomCss,
} from './custom-css-storage';
import { getPreviewCss } from './preview-css';

describe('applySavedCustomCss', () => {
  beforeEach(() => {
    localStorage.clear();
    removeAllCss();
  });

  it('applies a saved preview stylesheet on startup', () => {
    localStorage.setItem(
      CUSTOM_CSS_STORAGE_KEY,
      JSON.stringify({ css: 'p { color: teal; }', scope: 'preview' })
    );
    applySavedCustomCss();
    expect(getPreviewCss()).toBe('p { color: teal; }');
  });
});

describe('parseSavedCustomCss', () => {
  it('reads a saved scope and an older plain stylesheet', () => {
    expect(parseSavedCustomCss('{"css":"p{}","scope":"app"}')).toEqual({
      css: 'p{}',
      scope: 'app',
    });
    expect(parseSavedCustomCss('p { color: red; }')).toEqual({
      css: 'p { color: red; }',
      scope: 'preview',
    });
  });
});
