import { describe, expect, it } from 'vitest';

import { katexMathTex, renderableMathTex } from './renderable-math';

describe('renderableMathTex', () => {
  it('escapes specials that are not alignment tabs', () => {
    expect(renderableMathTex('a & b')).toBe('a \\& b');
    expect(renderableMathTex('a # b')).toBe('a \\# b');
    expect(renderableMathTex('100%')).toBe('100\\%');
    expect(renderableMathTex('a \\& b')).toBe('a \\& b');
    expect(renderableMathTex('\\begin{aligned}\na & b\n\\end{aligned}')).toBe(
      '\\begin{aligned}\na & b\n\\end{aligned}'
    );
    expect(renderableMathTex('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}')).toBe(
      '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'
    );
    expect(renderableMathTex('\\frac{a & b}{c}')).toBe('\\frac{a \\& b}{c}');
    expect(renderableMathTex('\\begin{aligned} a & b # c \\end{aligned}')).toBe(
      '\\begin{aligned} a & b \\# c \\end{aligned}'
    );
    expect(renderableMathTex('\\text{hello_world}')).toBe('\\text{hello\\_world}');
    expect(renderableMathTex('\\text{a^b}')).toBe('\\text{a\\textasciicircum{}b}');
    expect(renderableMathTex('a_b')).toBe('a_b');
    expect(renderableMathTex('\\text{a\\_b}')).toBe('\\text{a\\_b}');
    expect(renderableMathTex('\\begin{aligned}\\text{a & b}\\end{aligned}')).toBe(
      '\\begin{aligned}\\text{a \\& b}\\end{aligned}'
    );
    expect(katexMathTex('\\begin{multline}a\\\\b\\end{multline}')).toBe(
      '\\begin{gather}a\\\\b\\end{gather}'
    );
    expect(katexMathTex('\\begin{eqnarray}a&=b\\end{eqnarray}')).toBe(
      '\\begin{align}a&=b\\end{align}'
    );
    expect(katexMathTex('\\begin{displaymath}a=b\\end{displaymath}')).toBe(
      '\\begin{equation*}a=b\\end{equation*}'
    );
    expect(katexMathTex('\\begin{math}a=b\\end{math}')).toBe('a=b');
    expect(katexMathTex('\\begin{xalignat}{2}a&=b\\end{xalignat}')).toBe(
      '\\begin{alignat}{2}a&=b\\end{alignat}'
    );
    expect(katexMathTex('a=b\\label{eq:a}')).toBe('a=b');
    expect(katexMathTex('\\eqref{eq:a}')).toBe('\\text{(eq:a)}');
    expect(katexMathTex('\\mbox{a}')).toBe('\\text{a}');
    expect(renderableMathTex('\\begin{multline}a\\\\b\\end{multline}')).toBe(
      '\\begin{multline}a\\\\b\\end{multline}'
    );
  });
});
