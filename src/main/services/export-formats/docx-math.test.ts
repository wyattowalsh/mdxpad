import { MathFraction, MathRadical, MathRoundBrackets, MathRun, MathSuperScript } from 'docx';
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
  const parts: string[] = [];
  const visit = (component: object): void => {
    if (component instanceof MathRun) {
      const run = component as MathRun & { root: { root: unknown[] }[] };
      const text = run.root[0]?.root[0];
      if (typeof text === 'string') {
        parts.push(text);
      }
      return;
    }
    const children = (component as { root?: unknown }).root;
    if (!Array.isArray(children)) {
      return;
    }
    for (const child of children) {
      if (typeof child === 'object' && child !== null) {
        visit(child);
      }
    }
  };
  for (const component of components) {
    visit(component);
  }
  return parts.join('');
}

describe('mathComponents', () => {
  it('keeps an escaped brace, bar, and hash', () => {
    expect(runText(mathComponents('\\{x\\}'))).toBe('{x}');
    expect(runText(mathComponents('a\\|b'))).toBe('a‖b');
    expect(runText(mathComponents('\\#'))).toBe('#');
    expect(runText(mathComponents('\\alpha'))).toBe('α');
  });

  it('hides a delimiter command and keeps the words in text', () => {
    expect(runText(mathComponents('\\left\\{x\\right\\}'))).toBe('{x}');
    expect(runText(mathComponents('\\bigl(x\\bigr)'))).toBe('(x)');
    expect(runText(mathComponents('\\text{hello}'))).toBe('hello');
    expect(runText(mathComponents('\\sum'))).toBe('∑');
    expect(runText(mathComponents('\\left. x \\right|'))).toBe(' x |');
  });

  it('draws a Greek letter', () => {
    expect(runText(mathComponents('\\delta'))).toBe('δ');
    expect(runText(mathComponents('\\pi'))).toBe('π');
    expect(runText(mathComponents('\\omega'))).toBe('ω');
    expect(runText(mathComponents('\\Delta'))).toBe('Δ');
    expect(runText(mathComponents('\\phi'))).toBe('φ');
  });

  it('draws a negated relation as one symbol', () => {
    expect(runText(mathComponents('\\in'))).toBe('∈');
    expect(runText(mathComponents('\\notin'))).toBe('∉');
    expect(runText(mathComponents('\\not\\in'))).toBe('∉');
    expect(runText(mathComponents('\\not='))).toBe('≠');
    expect(runText(mathComponents('\\forall x \\in A'))).toBe('∀ x ∈ A');
  });

  it('keeps the entries of a matrix', () => {
    expect(runText(mathComponents('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'))).toBe(
      ' a & b \n c & d '
    );
  });

  it('keeps an accent on its symbol', () => {
    expect(runText(mathComponents('\\hat{x}'))).toBe('x\u0302');
    expect(runText(mathComponents('\\overline{ab}'))).toBe('ab\u0305');
    expect(runText(mathComponents('\\vec{v}'))).toBe('v\u20D7');
    expect(runText(mathComponents('\\mathbb{R}'))).toBe('R');
  });

  it('keeps both parts of a binomial', () => {
    const binom = mathComponents('\\binom{n}{k+1}');
    expect(binom).toHaveLength(1);
    expect(binom[0]).toBeInstanceOf(MathRoundBrackets);
    expect(runText(binom)).toBe('nk+1');
    expect(runText(mathComponents('\\dbinom{a}{b}'))).toBe('ab');
  });

  it('keeps the radicand of a root with an index', () => {
    const indexed = mathComponents('\\sqrt[3]{a+b}');
    expect(indexed).toHaveLength(1);
    expect(indexed[0]).toBeInstanceOf(MathRadical);
    expect(runText(indexed)).toBe('3a+b');
    expect(runText(mathComponents('\\sqrt{8}'))).toBe('8');
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
