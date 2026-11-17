import { describe, expect, it } from 'vitest';

import { normalizeTexMath } from './markdown-math';

describe('normalizeTexMath', () => {
  it('turns TeX delimiters into dollar math and leaves code alone', () => {
    const source = [
      'The area is \\(x^2\\).',
      '',
      '\\[',
      'a+b',
      '\\]',
      '',
      '`\\(not\\)`',
      '',
      '```',
      '\\(not\\)',
      '```',
    ].join('\n');
    const normalized = normalizeTexMath(source);
    expect(normalized).toContain('The area is $x^2$.');
    expect(normalized).toContain('$$\na+b\n$$');
    expect(normalized).toContain('`\\(not\\)`');
    expect(normalized).toContain('```\n\\(not\\)\n```');
  });
});
