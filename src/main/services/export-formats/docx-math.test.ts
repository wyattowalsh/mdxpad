import {
  MathCurlyBrackets,
  MathFraction,
  MathLimitLower,
  MathLimitUpper,
  MathRadical,
  MathSubSuperScript,
  MathRoundBrackets,
  MathSquareBrackets,
  MathRun,
  MathSuperScript,
} from 'docx';
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

  it('underlines a Word expression and stacks a subscript column', () => {
    expect(runText(mathComponents('\\underline{ab}'))).toBe('a\u0332b\u0332');
    expect(runText(mathComponents('\\substack{a\\\\b}'))).toBe('a\nb');
  });

  it('strikes a cancelled Word expression', () => {
    expect(runText(mathComponents('\\cancel{ab}'))).toBe('a\u0336b\u0336');
    expect(runText(mathComponents('\\bcancel{x}'))).toBe('x\u0336');
    expect(runText(mathComponents('\\xcancel{y}'))).toBe('y\u0336');
  });

  it('keeps the label of a Word link', () => {
    expect(runText(mathComponents('\\href{https://example.com}{docs}'))).toBe('docs');
    expect(runText(mathComponents('\\url{https://example.com}'))).toBe('https://example.com');
  });

  it('keeps the words of a colored Word expression', () => {
    expect(runText(mathComponents('\\textcolor{red}{hello}'))).toBe('hello');
    expect(runText(mathComponents('\\colorbox{blue}{sky}'))).toBe('sky');
  });

  it('draws a box around a Word expression', () => {
    const boxed = mathComponents('\\boxed{x+y}');
    expect(boxed).toHaveLength(1);
    expect(boxed[0]).toBeInstanceOf(MathSquareBrackets);
    expect(runText(boxed)).toBe('x+y');
  });

  it('puts a brace over or under a Word expression', () => {
    const over = mathComponents('\\overbrace{ab}');
    expect(over[0]).toBeInstanceOf(MathLimitUpper);
    expect(runText(over)).toBe('ab\u23DE');
    const under = mathComponents('\\underbrace{ab}');
    expect(under[0]).toBeInstanceOf(MathLimitLower);
    expect(runText(under)).toBe('ab\u23DF');
  });

  it('puts a label on a stretched arrow', () => {
    const over = mathComponents('\\xrightarrow{n}');
    expect(over).toHaveLength(1);
    expect(over[0]).toBeInstanceOf(MathLimitUpper);
    expect(runText(over)).toBe('→n');
    const both = mathComponents('\\xleftarrow[b]{a}');
    expect(both[0]).toBeInstanceOf(MathSubSuperScript);
    expect(runText(both)).toBe('←ba');
  });

  it('stacks an annotation on its base', () => {
    const over = mathComponents('\\overset{a}{b}');
    expect(over).toHaveLength(1);
    expect(over[0]).toBeInstanceOf(MathLimitUpper);
    expect(runText(over)).toBe('ba');
    const under = mathComponents('\\underset{a}{b}');
    expect(under[0]).toBeInstanceOf(MathLimitLower);
    expect(runText(under)).toBe('ba');
    expect(runText(mathComponents('\\stackrel{a}{b}'))).toBe('ba');
  });

  it('draws dots, a script ell, and an angle', () => {
    expect(runText(mathComponents('\\dots'))).toBe('…');
    expect(runText(mathComponents('\\ell'))).toBe('ℓ');
    expect(runText(mathComponents('\\hbar'))).toBe('ℏ');
    expect(runText(mathComponents('\\angle'))).toBe('∠');
    expect(runText(mathComponents('\\propto'))).toBe('∝');
  });

  it('draws an arrow', () => {
    expect(runText(mathComponents('\\Rightarrow'))).toBe('⇒');
    expect(runText(mathComponents('\\mapsto'))).toBe('↦');
    expect(runText(mathComponents('\\iff'))).toBe('⇔');
    expect(runText(mathComponents('A \\to B'))).toBe('A → B');
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
    const round = mathComponents('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}');
    expect(round).toHaveLength(1);
    expect(round[0]).toBeInstanceOf(MathRoundBrackets);
    expect(runText(round)).toBe(' a & b \n c & d ');
    const square = mathComponents('\\begin{bmatrix}1\\end{bmatrix}');
    expect(square[0]).toBeInstanceOf(MathSquareBrackets);
    expect(runText(square)).toBe('1');
    const cases = mathComponents('\\begin{cases}x\\end{cases}');
    expect(cases[0]).toBeInstanceOf(MathCurlyBrackets);
    expect(runText(cases)).toBe('x');
    expect(runText(mathComponents('\\begin{vmatrix}a\\end{vmatrix}'))).toBe('|a|');
  });

  it('keeps an accent on its symbol', () => {
    expect(runText(mathComponents('\\hat{x}'))).toBe('x\u0302');
    expect(runText(mathComponents('\\overline{ab}'))).toBe('ab\u0305');
    expect(runText(mathComponents('\\vec{v}'))).toBe('v\u20D7');
    expect(runText(mathComponents('\\mathbb{R}'))).toBe('R');
  });

  it('leaves a style command out of the formula', () => {
    const limited = runText(mathComponents('\\sum\\limits_{i=1}^{n}'));
    expect(limited).toBe('∑i=1n');
    expect(limited).not.toContain('limits');
    expect(runText(mathComponents('\\displaystyle x'))).toBe(' x');
    expect(runText(mathComponents('\\mathbin{+}'))).toBe('+');
  });

  it('writes a modulus as the word mod', () => {
    const parenthesized = mathComponents('\\pmod{n}');
    expect(parenthesized).toHaveLength(1);
    expect(parenthesized[0]).toBeInstanceOf(MathRoundBrackets);
    expect(runText(parenthesized)).toBe('mod n');
    expect(runText(mathComponents('a \\bmod b'))).toBe('a mod b');
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
    const display = mathComponents('\\dfrac{a}{b}');
    expect(display).toHaveLength(1);
    expect(display[0]).toBeInstanceOf(MathFraction);
    expect(runText(display)).toBe('ab');
    expect(runText(mathComponents('\\tfrac{1}{2}'))).toBe('12');

    const sum = mathComponents('a + b');
    expect(sum[0]).toBeInstanceOf(MathRun);
  });
});
