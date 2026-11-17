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
    expect(prepareMarkdownSource('See <https://example.com> and <ada@example.com>.')).toBe(
      'See [https://example.com](https://example.com) and [ada@example.com](mailto:ada@example.com).'
    );
    expect(prepareMarkdownSource('Compare a <= b and JSON {"a": 1} and {1 + 2}')).toContain(
      'a &lt;= b'
    );
    expect(prepareMarkdownSource('Compare a <= b and JSON {"a": 1} and {1 + 2}')).toContain(
      '\\{"a": 1\\}'
    );
    expect(prepareMarkdownSource('Compare a <= b and JSON {"a": 1} and {1 + 2}')).toContain(
      '{1 + 2}'
    );
    expect(prepareMarkdownSource('{css({ color: "red" })} and {(a)} and `{a <= b}`')).toBe(
      '{css({ color: "red" })} and {(a)} and `{a <= b}`'
    );
    expect(prepareMarkdownSource('Use {foo: 1}')).toContain('\\{foo: 1\\}');
    expect(prepareMarkdownSource('I <3 this and a << b and Array<Array<T>>')).toContain(
      'I &lt;3 this'
    );
    expect(prepareMarkdownSource('I <3 this and a << b and Array<Array<T>>')).toContain('&lt;&lt;');
    expect(prepareMarkdownSource('I <3 this and a << b and Array<Array<T>>')).toContain(
      'Array&lt;Array&lt;T&gt;&gt;'
    );
    expect(prepareMarkdownSource('Hello {{name}} and `{{name}}`')).toBe(
      'Hello \\{\\{name\\}\\} and `{{name}}`'
    );
    expect(prepareMarkdownSource('Use <> fragments and {#anchor}')).toBe(
      'Use &lt;&gt; fragments and \\{#anchor\\}'
    );
    expect(prepareMarkdownSource('List<T> and <Card>Hi</Card> and `List<T>`')).toBe(
      'List&lt;T&gt; and <Card>Hi</Card> and `List<T>`'
    );
    expect(prepared).toContain('```\n<br>\n<!-- secret -->\n```');
  });
});
