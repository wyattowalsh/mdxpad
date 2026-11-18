import { MathFraction, MathRun, MathSuperScript } from 'docx';
import { describe, expect, it } from 'vitest';

import { mathComponents, splitDocxPieces } from './docx-math';

describe('splitDocxPieces', () => {
  it('keeps a price as text and separates a formula', () => {
    expect(splitDocxPieces('See $x^2$ and $5 and $10')).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'math', tex: 'x^2' },
      { kind: 'text', text: ' and $5 and $10' },
    ]);
    expect(splitDocxPieces('Compare $n and m$')).toEqual([
      { kind: 'text', text: 'Compare ' },
      { kind: 'math', tex: 'n and m' },
    ]);
  });
});

describe('mathComponents', () => {
  it('builds a superscript and a fraction', () => {
    const power = mathComponents('x^2');
    expect(power[0]).toBeInstanceOf(MathSuperScript);

    const fraction = mathComponents('\\frac{a}{b}');
    expect(fraction[0]).toBeInstanceOf(MathFraction);

    const sum = mathComponents('a + b');
    expect(sum[0]).toBeInstanceOf(MathRun);
  });
});
