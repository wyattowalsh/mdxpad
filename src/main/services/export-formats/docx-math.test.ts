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
    expect(runText(mathComponents('\\substack{a^2\\\\b_i}'))).toBe('a2\nbi');
  });

  it('strikes a cancelled Word expression', () => {
    expect(runText(mathComponents('\\cancel{ab}'))).toBe('a\u0336b\u0336');
    expect(runText(mathComponents('\\bcancel{x}'))).toBe('x\u0336');
    expect(runText(mathComponents('\\xcancel{y}'))).toBe('y\u0336');
  });

  it('draws a named delimiter', () => {
    expect(runText(mathComponents('\\langle x \\rangle'))).toBe('⟨ x ⟩');
    expect(runText(mathComponents('\\lfloor y \\rfloor'))).toBe('⌊ y ⌋');
    expect(runText(mathComponents('\\vert z \\vert'))).toBe('| z |');
    expect(runText(mathComponents('\\backslash'))).toBe('\\');
  });

  it('hides a phantom and keeps an ensured expression', () => {
    expect(runText(mathComponents('\\phantom{secret}'))).toBe('');
    expect(runText(mathComponents('\\ensuremath{x+1}'))).toBe('x+1');
    expect(runText(mathComponents('a\\relax b'))).toBe('a b');
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
    expect(runText(round)).toBe(' a \u2003 b \n c \u2003 d ');
    expect(runText(round)).not.toContain('&');
    expect(runText(mathComponents('\\begin{pmatrix}a \\& b\\end{pmatrix}'))).toContain('&');
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

  it('draws a big operator and a set difference', () => {
    expect(runText(mathComponents('\\bigcup_{i} A_i'))).toBe('⋃i Ai');
    expect(runText(mathComponents('\\oint'))).toBe('∮');
    expect(runText(mathComponents('A \\setminus B'))).toBe('A ∖ B');
    expect(runText(mathComponents('A \\sqsubseteq B'))).toBe('A ⊑ B');
  });

  it('puts an equation number in parentheses', () => {
    const tagged = mathComponents('a+b\\tag{1}');
    expect(tagged.at(-1)).toBeInstanceOf(MathRoundBrackets);
    expect(runText(tagged)).toBe('a+b1');
    const starred = mathComponents('x\\tag*{2}');
    expect(starred.at(-1)).toBeInstanceOf(MathRoundBrackets);
    expect(runText(starred)).toBe('x2');
    expect(runText(mathComponents('a\\notag'))).toBe('a');
    expect(runText(mathComponents('b\\nonumber'))).toBe('b');
  });

  it('keeps the words of a font command and drops a color name', () => {
    expect(runText(mathComponents('\\textbf{hello}'))).toBe('hello');
    expect(runText(mathComponents('\\boldsymbol{x}'))).toBe('x');
    expect(runText(mathComponents('\\color{red}x'))).toBe('x');
  });

  it('draws a slanted or negated relation', () => {
    expect(runText(mathComponents('a \\leqslant b \\nleq c'))).toBe('a ⩽ b ≰ c');
    expect(runText(mathComponents('a \\nsubseteq b'))).toBe('a ⊈ b');
    expect(runText(mathComponents('a \\vdash b \\simeq c'))).toBe('a ⊢ b ≃ c');
  });

  it('draws a short inequality and a middle bar', () => {
    expect(runText(mathComponents('a \\le b \\ge c \\ne d'))).toBe('a ≤ b ≥ c ≠ d');
    expect(runText(mathComponents('a \\ll b \\gg c'))).toBe('a ≪ b ≫ c');
    expect(runText(mathComponents('\\not\\le'))).toBe('≰');
    expect(runText(mathComponents('\\not \\le'))).toBe('≰');
    expect(runText(mathComponents('\\not \\in'))).toBe('∉');
    expect(runText(mathComponents('\\left. x \\middle| y \\right.'))).toBe(' x | y ');
  });

  it('raises a prime and keeps an apostrophe in text', () => {
    const prime = mathComponents("f'");
    expect(prime).toHaveLength(1);
    expect(prime[0]).toBeInstanceOf(MathSuperScript);
    expect(runText(prime)).toBe('f′');
    expect(runText(mathComponents("f''"))).toBe('f′′');
    const both = mathComponents("f_i'");
    expect(both[0]).toBeInstanceOf(MathSubSuperScript);
    expect(runText(both)).toBe('fi′');
    expect(runText(mathComponents("\\text{it's}"))).toBe("it's");
  });

  it('keeps a script on the symbol before a space', () => {
    const sum = mathComponents('\\sum _{i=1}^{n}');
    expect(sum).toHaveLength(1);
    expect(sum[0]).toBeInstanceOf(MathSubSuperScript);
    expect(runText(sum)).toBe('∑i=1n');
    const power = mathComponents('x ^2');
    expect(power).toHaveLength(1);
    expect(power[0]).toBeInstanceOf(MathSuperScript);
    expect(runText(power)).toBe('x2');
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

  it('skips a space before a fraction or a root', () => {
    const spaced = mathComponents('\\frac {1}{2}');
    expect(spaced).toHaveLength(1);
    expect(spaced[0]).toBeInstanceOf(MathFraction);
    expect(runText(spaced)).toBe('12');
    expect(runText(mathComponents('\\sqrt {x}'))).toBe('x');
    const indexed = mathComponents('\\sqrt [3]{8}');
    expect(indexed).toHaveLength(1);
    expect(indexed[0]).toBeInstanceOf(MathRadical);
    expect(runText(indexed)).toBe('38');
  });

  it('keeps a subscript and a superscript on one symbol', () => {
    const lowerFirst = mathComponents('x_i^2');
    expect(lowerFirst).toHaveLength(1);
    expect(lowerFirst[0]).toBeInstanceOf(MathSubSuperScript);
    expect(runText(lowerFirst)).toBe('xi2');
    const upperFirst = mathComponents('x^2_i');
    expect(upperFirst).toHaveLength(1);
    expect(upperFirst[0]).toBeInstanceOf(MathSubSuperScript);
    expect(runText(upperFirst)).toBe('xi2');
    expect(mathComponents('{x_i}^2')[0]).toBeInstanceOf(MathSubSuperScript);
  });

  it('builds an infix fraction and a binomial', () => {
    const over = mathComponents('{a+1 \\over b}');
    expect(over).toHaveLength(1);
    expect(over[0]).toBeInstanceOf(MathFraction);
    expect(runText(over)).toBe('a+1b');
    const choose = mathComponents('{n \\choose k}');
    expect(choose[0]).toBeInstanceOf(MathRoundBrackets);
    expect(runText(choose)).toBe('nk');
    expect(runText(mathComponents('a \\over b+c'))).toBe('ab+c');
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
