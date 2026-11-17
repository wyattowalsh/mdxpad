import { describe, expect, it } from 'vitest';

import { normalizeTexMath, prepareMarkdownSource } from './markdown-math';

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

  it('hides an HTML comment and closes a void tag outside code', () => {
    const prepared = prepareMarkdownSource(
      'See <!-- secret --> this.<br>\n\n```\n<br>\n<!-- secret -->\n```\n'
    );
    expect(prepared.startsWith('See  this.<br />')).toBe(true);
    expect(prepared).toContain('```\n<br>\n<!-- secret -->\n```');
  });
});
