import { describe, expect, it } from 'vitest';

import { renderableMathTex } from './renderable-math';

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
  });
});
