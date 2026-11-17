import { describe, expect, it } from 'vitest';

import { darkTheme } from './theme-definitions';
import { extensionForTheme } from './editor-theme';

describe('extensionForTheme', () => {
  it('returns editor chrome and syntax highlighting for a theme', () => {
    const extension = extensionForTheme(darkTheme);
    expect(Array.isArray(extension)).toBe(true);
    expect(extension).toHaveLength(2);
  });
});
