import { createElement } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { RequestId } from '@shared/types/preview-worker';
import { createModuleFromCode } from '@renderer/preview-frame/mdx-module-runtime';

import { compileMdx } from './compile';

const testId = (id: string): RequestId => id as RequestId;

describe('remark math prices', () => {
  it('leaves an unmatched display fence as text', async () => {
    const result = await compileMdx(testId('lone-fence'), 'Text $$\n\n> inside\n\n$$\n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('"inside"');
      expect(result.code).toContain('$$');
      expect(result.code).not.toContain('katex-display');
    }
    const closed = await compileMdx(testId('closed-fence'), '$$\nx^2\n$$\n');
    expect(closed.ok).toBe(true);
    if (closed.ok) {
      expect(closed.code).toContain('children: "x^2"');
    }
  });

  it('renders a formula that opens at the end of a line', async () => {
    const result = await compileMdx(testId('display-prefix'), 'Text $$\nx^2\n$$\nmore\n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('children: "x^2"');
      expect(result.code).toContain('"more"');
      expect(result.code).not.toContain('children: "m"');
    }
  });

  it('renders a quoted formula that opens at the end of a line', async () => {
    const result = await compileMdx(testId('quote-display'), '> Text $$\n> x^2\n> $$\n>\n> more\n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('children: "x^2"');
      expect(result.code).toContain('"more"');
      expect(result.code).not.toContain('children: "m"');
    }
  });

  it('renders a list fence that starts on the marker', async () => {
    const result = await compileMdx(testId('list-fence'), '- $$\n  x^2\n  $$\n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('children: "x^2"');
    }
  });

  it('renders a quoted list formula', async () => {
    const result = await compileMdx(
      testId('quoted-list-formula'),
      '> - Text $$\n>   x^2\n>   $$\n>   more\n'
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('children: "x^2"');
      expect(result.code).toContain('"more"');
      expect(result.code).not.toContain('children: "m"');
    }
  });

  it('renders a list formula that opens at the end of a line', async () => {
    const result = await compileMdx(testId('list-display'), '- Text $$\n  x^2\n  $$\n  more\n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('children: "x^2"');
      expect(result.code).toContain('"more"');
      expect(result.code).not.toContain('children: "m"');
    }
  });

  it('renders the formula after a price', async () => {
    const result = await compileMdx(testId('price-formula'), 'Pay $5 then $a*b$.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('a*b');
      expect(result.code).toContain('katex');
      expect(result.code).not.toContain('$5 then $');
    }
  });

  it('renders the formula after a dollar sign in an email', async () => {
    const result = await compileMdx(testId('email-formula'), 'Mail ada$b@example.com and $x^2$.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('mailto:ada$b@example.com');
      expect(result.code).toContain('application/x-tex",\n              children: "x^2"');
      expect(result.code).not.toContain('mailto:b@example.com');
    }
  });

  it('renders the formula after a dollar sign glued to a word', async () => {
    const result = await compileMdx(testId('glued-formula'), 'Path C:$foo and $x^2$.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('C:$foo');
      expect(result.code).toContain('children: "x^2"');
    }
  });

  it('renders the formula after a dollar sign inside parentheses', async () => {
    const result = await compileMdx(testId('paren-formula'), 'See (notes $a) and $x^2$.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('(notes $a)');
      expect(result.code).toContain('children: "x^2"');
    }
  });

  it('renders the formula after a dollar sign in a reference label', async () => {
    const result = await compileMdx(
      testId('ref-formula'),
      'See [a$b] and $x^2$.\n\n[a$b]: https://example.com/guide\n'
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('https://example.com/guide');
      expect(result.code).toContain('a$b');
      expect(result.code).toContain('children: "x^2"');
    }
  });

  it('renders a formula inside a link label', async () => {
    const result = await compileMdx(testId('label-formula'), '[size $n^2$](https://example.com)');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('href: "https://example.com"');
      expect(result.code).toContain('children: "n^2"');
    }
  });

  it('renders the formula after a dollar sign in a link', async () => {
    const result = await compileMdx(
      testId('url-formula'),
      'Price $5 and [link](https://example.com/$10) more $x$.'
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('https://example.com/$10');
      expect(result.code).toContain('children: "x"');
      expect(result.code).toContain('$5');
    }
  });

  it('leaves a price out of KaTeX', async () => {
    const result = await compileMdx(testId('price'), 'It costs $5 and $10 today.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).not.toContain('katex');
    }
  });

  it('keeps a live expression that contains a colon', async () => {
    const result = await compileMdx(testId('mdx-live'), '{css({ color: "red" })}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('color');
    }
  });

  it('compiles a url that contains a tag and an unfinished sum', async () => {
    const result = await compileMdx(
      testId('mdx-url-tag'),
      'See https://example.com/a<b> and {1 +} more'
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const text = render(createElement((await createModuleFromCode(result.code)).default))
        .container.textContent;
      expect(text).toContain('example.com/a<b>');
      expect(text).toContain('{1 +}');
    }
  });

  it('compiles a heart, a nested type, and a fragment in prose', async () => {
    const result = await compileMdx(
      testId('mdx-angles'),
      'I <3 this, Array<Array<T>>, and <> here, plus {#anchor}'
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('I <3 this');
      expect(result.code).toContain('Array');
    }
  });

  it('shows a template placeholder and keeps a style object', async () => {
    const placeholder = await compileMdx(testId('mdx-template'), 'Hello {{name}}!');
    expect(placeholder.ok).toBe(true);
    if (placeholder.ok) {
      expect(placeholder.code).toContain('{{name}}');
      const module = await createModuleFromCode(placeholder.code);
      expect(render(createElement(module.default)).container.textContent).toContain('{{name}}');
    }

    const styled = await compileMdx(
      testId('mdx-style'),
      '<div style={{ color: "red" }}>ok</div>'
    );
    expect(styled.ok).toBe(true);
    if (styled.ok) {
      expect(styled.code).toContain('color');
      expect(styled.code).toContain('red');
    }
  });

  it('strikes a double tilde and leaves a single tilde as text', async () => {
    const result = await compileMdx(testId('mdx-tilde'), 'H~2~O and ~~gone~~');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('H~2~O');
      expect(result.code).toContain('"gone"');
      expect(result.code).not.toContain('"2"');
    }
  });

  it('compiles a comparison and a JSON sample', async () => {
    const result = await compileMdx(testId('mdx-json'), 'Compare a <= b and JSON {"a": 1}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('Compare');
      expect(result.code).toContain('JSON');
    }
  });

  it('compiles an autolink and a generic type', async () => {
    const result = await compileMdx(
      testId('mdx-autolink'),
      'See <https://example.com> and List<T> and <Card>Hi</Card>'
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('https://example.com');
      expect(result.code).toContain('List');
      expect(result.code).toContain('Card');
    }
  });

  it('compiles a markdown comment and a line break', async () => {
    const result = await compileMdx(testId('mdx-html'), 'See <!-- secret --> this.<br>Next');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('this.');
      expect(result.code).toContain('Next');
      expect(result.code).not.toContain('secret');
    }
  });

  it('points a capitalized heading link at the heading id', async () => {
    const result = await compileMdx(testId('heading-link'), '# Two\n\nSee [two](#Two).\n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('id: "two"');
      expect(result.code).toContain('href: "#two"');
      expect(result.code).not.toContain('"#Two"');
    }
  });

  it('renders a TeX inline formula', async () => {
    const result = await compileMdx(testId('tex-inline'), 'The area is \\(x^2\\).');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('katex');
      expect(result.code).not.toContain('\\(x^2\\)');
    }
  });

  it('keeps a real formula', async () => {
    const result = await compileMdx(testId('formula'), 'The area is $x^2$.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('katex');
    }
  });

  it('keeps a formula that contains spaces', async () => {
    const result = await compileMdx(testId('spaced'), 'The sum is $a + b$.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('katex');
    }
  });

  it('renders a formula written in words', async () => {
    const result = await compileMdx(testId('words'), 'Compare $n and m$.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toContain('katex');
    }
  });
});
