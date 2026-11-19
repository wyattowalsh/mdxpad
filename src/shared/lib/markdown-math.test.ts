import { describe, expect, it } from 'vitest';

import { fenceIndentedCode } from './indented-code';
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
    expect(prepareMarkdownSource('Write <mailto:ada@example.com>.')).toBe(
      'Write [mailto:ada@example.com](mailto:ada@example.com).'
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
    expect(prepareMarkdownSource('See https://example.com/a<b> and {1 +} more')).toContain(
      'a&lt;b&gt;'
    );
    expect(prepareMarkdownSource('See https://example.com/a<b> and {1 +} more')).toContain(
      '\\{1 +\\}'
    );
    expect(prepareMarkdownSource('<b>Hi</b> and <Note {...props} />')).toBe(
      '<b>Hi</b> and <Note {...props} />'
    );
    expect(prepareMarkdownSource('Hello {{name}} and `{{name}}`')).toBe(
      'Hello \\{\\{name\\}\\} and `{{name}}`'
    );
    expect(prepareMarkdownSource('Use <> fragments and {#anchor}')).toBe(
      'Use &lt;&gt; fragments and \\{#anchor\\}'
    );
    expect(prepareMarkdownSource('$$\na < b\n$$')).toContain('a < b');
    expect(prepareMarkdownSource('$$\na <= b\n$$')).toContain('a <= b');
    expect(prepareMarkdownSource('$$\na < b\n$$')).not.toContain('&lt;');
    expect(prepareMarkdownSource('Compare a < b')).toContain('a &lt; b');
    expect(prepareMarkdownSource('[link](https://example.com/a\\(b\\))')).toBe(
      '[link](https://example.com/a\\(b\\))'
    );
    expect(prepareMarkdownSource('[area \\(x^2\\)](https://example.com)')).toBe(
      '[area $x^2$](https://example.com)'
    );
    expect(
      prepareMarkdownSource('<div>\n\\(x^2\\)\na < b\n</div>\n', { preserveHtml: true })
    ).toContain('\\(x^2\\)');
    expect(
      prepareMarkdownSource('<div>\n\\(x^2\\)\na < b\n</div>\n', { preserveHtml: true })
    ).toContain('a < b');
    expect(prepareMarkdownSource('Price $\\$5$ and $a\\$<b>$.\n')).toContain('$\\$5$');
    expect(prepareMarkdownSource('Price $\\$5$ and $a\\$<b>$.\n')).toContain('$a\\$<b>$');
    expect(prepareMarkdownSource('Price $\\$5$ and $a\\$<b>$.\n')).not.toContain('&lt;');
    expect(normalizeTexMath('\\(a \\\\) still\\)')).toBe('$a \\\\) still$');
    expect(normalizeTexMath('Price \\(\\$5\\) and \\(a$b\\).\n')).toContain('$\\$5$');
    expect(normalizeTexMath('Price \\(\\$5\\) and \\(a$b\\).\n')).toContain('$a\\$b$');
    expect(prepareMarkdownSource('Price \\(\\$5\\) and \\(a$b\\).\n')).toContain('$\\$5$');
    expect(prepareMarkdownSource('Price \\(\\$5\\) and \\(a$b\\).\n')).toContain('$a\\$b$');
    expect(prepareMarkdownSource('    $x^2$\n')).toBe('```\n$x^2$\n```\n');
    expect(normalizeTexMath('- outer\n\n  - inner\n\n    ```\n    \\(x^2\\)\n    ```\n')).toContain('\\(x^2\\)');
    expect(normalizeTexMath('- outer\n\n  - inner\n\n    ```\n    \\(x^2\\)\n    ```\n')).not.toContain('$x^2$');
    expect(normalizeTexMath(fenceIndentedCode('- item\n\n      \\(x^2\\)\n'))).toContain('\\(x^2\\)');
    expect(normalizeTexMath(fenceIndentedCode('>     \\(x^2\\)\n'))).toContain('\\(x^2\\)');
    expect(normalizeTexMath(fenceIndentedCode('> >     \\(x^2\\)\n'))).toContain('\\(x^2\\)');
    expect(normalizeTexMath(fenceIndentedCode('> >     \\(x^2\\)\n'))).not.toContain('$x^2$');
    expect(normalizeTexMath(fenceIndentedCode('    \\(x^2\\)\n'))).toContain('\\(x^2\\)');
    expect(normalizeTexMath(fenceIndentedCode('    \\(x^2\\)\n'))).not.toContain('$x^2$');
    expect(prepareMarkdownSource('List<T> and <Card>Hi</Card> and `List<T>`')).toBe(
      'List&lt;T&gt; and <Card>Hi</Card> and `List<T>`'
    );
    expect(prepared).toContain('```\n<br>\n<!-- secret -->\n```');
  });

  it('escapes a raw ampersand, hash, and percent inside a formula', () => {
    expect(prepareMarkdownSource('$$a & b$$')).toContain('$$a \\& b$$');
    expect(prepareMarkdownSource('$$a # b$$')).toContain('$$a \\# b$$');
    expect(prepareMarkdownSource('$$100%$$')).toContain('$$100\\%$$');
    expect(prepareMarkdownSource('$$a \\& b$$')).toContain('$$a \\& b$$');
    expect(prepareMarkdownSource('$$a \\& b$$')).not.toContain('\\\\&');
    expect(prepareMarkdownSource('$$\n\\begin{aligned}\na & b\n\\end{aligned}\n$$')).toContain(
      'a & b'
    );
    expect(prepareMarkdownSource('$$\n\\begin{aligned}\na & b\n\\end{aligned}\n$$')).not.toContain(
      'a \\& b'
    );
    expect(prepareMarkdownSource('`$a & b$` and ```\n$$a & b$$\n```')).toContain('`$a & b$`');
    expect(prepareMarkdownSource('`$a & b$` and ```\n$$a & b$$\n```')).toContain('$$a & b$$');
    expect(prepareMarkdownSource('Price is $5 & $6$.')).not.toContain('\\&');
    expect(normalizeTexMath('\\[a & b\\]')).toContain('$$a \\& b$$');
  });
});
