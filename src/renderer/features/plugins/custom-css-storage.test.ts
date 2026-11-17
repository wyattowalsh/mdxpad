import { describe, expect, it } from 'vitest';

import { parseSavedCustomCss } from './custom-css-storage';

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
