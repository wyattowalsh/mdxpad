import { describe, expect, it } from 'vitest';

import { splitDocxPieces } from './docx-math';

describe('mathSpanEnd', () => {
  it('keeps an escaped dollar inside the formula', () => {
    const source = 'Price $\\$5$ and $a\\$b$.';
    expect(splitDocxPieces(source)).toEqual([
      { kind: 'text', text: 'Price ' },
      { kind: 'math', tex: '\\$5' },
      { kind: 'text', text: ' and ' },
      { kind: 'math', tex: 'a\\$b' },
      { kind: 'text', text: '.' },
    ]);
  });
});
