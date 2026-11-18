import { describe, expect, it } from 'vitest';

import { sourcePosition } from './comment-position';

describe('sourcePosition', () => {
  it('counts lines instead of treating the character offset as a line', () => {
    expect(sourcePosition('Hello\nWorld', 7)).toEqual({ line: 2, column: 2 });
    expect(sourcePosition('abcdefghij', 10)).toEqual({ line: 1, column: 11 });
  });
});
