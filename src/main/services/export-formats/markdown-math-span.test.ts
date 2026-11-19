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

  it('keeps a percent inside display math', () => {
    expect(splitDocxPieces('$$50% off$$')).toEqual([{ kind: 'math', tex: '50% off' }]);
    expect(splitDocxPieces('Price is $5 and $10')).toEqual([
      { kind: 'text', text: 'Price is $5 and $10' },
    ]);
  });

  it('does not treat a price and an ampersand as a formula', () => {
    expect(splitDocxPieces('Price is $5 & $6$')).toEqual([
      { kind: 'text', text: 'Price is $5 & $6$' },
    ]);
    expect(splitDocxPieces('Keep $a \\& b$')).toEqual([
      { kind: 'text', text: 'Keep ' },
      { kind: 'math', tex: 'a \\& b' },
    ]);
  });

  it('keeps a display formula closed after a coded delimiter', () => {
    expect(splitDocxPieces('$$ use `$$` here $$\n\nNext words')).toEqual([
      { kind: 'math', tex: ' use `$$` here ' },
      { kind: 'text', text: '\n\nNext words' },
    ]);
  });

  it('opens a formula after a literal backslash', () => {
    expect(splitDocxPieces('The value is \\\\$x^2$.')).toEqual([
      { kind: 'text', text: 'The value is \\\\' },
      { kind: 'math', tex: 'x^2' },
      { kind: 'text', text: '.' },
    ]);
  });
});
