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
    expect(splitDocxPieces('`$x$`')).toEqual([{ kind: 'text', text: '`$x$`' }]);
  });
});

function runText(components: readonly object[]): string {
  return components
    .filter((component) => component instanceof MathRun)
    .map((component) => {
      const run = component as MathRun & { root: { root: unknown[] }[] };
      const text = run.root[0]?.root[0];
      return typeof text === 'string' ? text : '';
    })
    .join('');
}

describe('mathComponents', () => {
  it('keeps an escaped brace, bar, and hash', () => {
    expect(runText(mathComponents('\\{x\\}'))).toBe('{x}');
    expect(runText(mathComponents('a\\|b'))).toBe('a‖b');
    expect(runText(mathComponents('\\#'))).toBe('#');
    expect(runText(mathComponents('\\alpha'))).toBe('α');
  });

  it('builds a superscript and a fraction', () => {
    const power = mathComponents('x^2');
    expect(power[0]).toBeInstanceOf(MathSuperScript);

    const fraction = mathComponents('\\frac{a}{b}');
    expect(fraction[0]).toBeInstanceOf(MathFraction);

    const sum = mathComponents('a + b');
    expect(sum[0]).toBeInstanceOf(MathRun);
  });
});
