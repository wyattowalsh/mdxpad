import { describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { serializeMdxContent } from './prosemirror-mdx-serializer';

function roundTrip(source: string): string {
  const doc = parseMdxContent(source);
  if (!doc) {
    throw new Error('Expected a document');
  }
  return serializeMdxContent(doc);
}

describe('WYSIWYG markdown round trip', () => {
  it('keeps a leading frontmatter block', () => {
    const source = '---\ntitle: Hello\n---\n\n# Body\n';
    expect(roundTrip(source)).toContain('title: Hello');
    expect(roundTrip(source)).toContain('# Body');
    expect(roundTrip(source)).not.toContain('# title: Hello');
  });

  it('keeps a single newline as a newline', () => {
    const source = '$$\na^2+b^2\n$$\n';
    expect(roundTrip(source)).not.toContain('\\\\\n');
  });

  it('keeps image alt text', () => {
    expect(roundTrip('![diagram](./a.png "title")\n')).toContain('![diagram](./a.png "title")');
  });

  it('keeps a task checkbox', () => {
    const serialized = roundTrip('- [ ] todo\n');
    expect(serialized).toContain('[ ] todo');
    expect(serialized).not.toContain('\\[');
  });

  it('keeps a formatted task and a nested task', () => {
    const formatted = roundTrip('- [ ] **todo**\n');
    expect(formatted).toContain('[ ] **todo**');
    expect(formatted).not.toContain('\\[');
    const nested = roundTrip('- [ ] one\n  - [ ] nested\n');
    expect(nested).toContain('[ ] one');
    expect(nested).toContain('[ ] nested');
    expect(nested).not.toContain('\\[');
  });

  it('keeps a JSX block', () => {
    const serialized = roundTrip('<Card>Hello</Card>\n');
    expect(serialized).toContain('<Card>Hello</Card>');
    expect(serialized).not.toContain('mdxpad-jsx');
  });

  it('keeps TeX math delimiters', () => {
    expect(roundTrip('The area is \\(x^2\\).\n')).toContain('\\(x^2\\)');
    expect(roundTrip('\\[\na+b\n\\]\n')).toContain('\\[');
    expect(roundTrip('\\[\na+b\n\\]\n')).toContain('a+b');
  });

  it('keeps math characters literal', () => {
    expect(roundTrip('The product is $a * b$.\n')).toContain('$a * b$');
    expect(roundTrip('The term is $a_{i}$.\n')).toContain('$a_{i}$');
    expect(roundTrip('The product is $a * b$.\n')).not.toContain('\\*');
    expect(roundTrip('The term is $a_{i}$.\n')).not.toContain('\\_');
  });

  it('keeps the characters of a thematic break', () => {
    expect(roundTrip('***\n')).toContain('***');
    expect(roundTrip('___\n')).toContain('___');
    expect(roundTrip('---\n')).toContain('---');
  });

  it('keeps a loose list loose', () => {
    expect(roundTrip('- one\n\n- two\n')).toContain('- one\n\n- two');
    expect(roundTrip('1. one\n\n2. two\n')).toContain('1. one\n\n2. two');
  });

  it('keeps a tight list tight', () => {
    const serialized = roundTrip('- one\n- two\n');
    expect(serialized).toContain('- one\n- two');
    expect(serialized).not.toContain('- one\n\n- two');
  });

  it('keeps a reference link and its definition', () => {
    const serialized = roundTrip('See [docs][guide].\n\n[guide]: https://example.com/guide\n');
    expect(serialized).toContain('[docs](https://example.com/guide)');
    expect(serialized).toContain('[guide]: https://example.com/guide');
    expect(serialized).not.toContain('\\[');
  });

  it('keeps a footnote reference and its definition', () => {
    const serialized = roundTrip('A footnote[^1].\n\n[^1]: The note\n');
    expect(serialized).toContain('A footnote[^1].');
    expect(serialized).toContain('[^1]: The note');
    expect(serialized).not.toContain('](The note)');
    expect(serialized).not.toContain('\\[');
  });

  it('keeps strikethrough', () => {
    const serialized = roundTrip('~~gone~~\n');
    expect(serialized).toContain('~~gone~~');
    expect(serialized).not.toContain('\\~');
  });

  it('keeps a table and its alignment', () => {
    const source = '| A | B |\n| --- | ---: |\n| 1 | **2** |\n';
    const doc = parseMdxContent(source);
    expect(doc?.firstChild?.type.name).toBe('table');
    const serialized = roundTrip(source);
    expect(serialized).toContain('| A | B |');
    expect(serialized).toContain('| --- | ---: |');
    expect(serialized).toContain('| 1 | **2** |');
  });

  it('keeps an indented code block indented', () => {
    const serialized = roundTrip('    const x = 1\n');
    expect(serialized).toContain('    const x = 1');
    expect(serialized).not.toContain('```');
    expect(roundTrip('```js\nconst x = 1\n```\n')).toContain('```js');
  });

  it('keeps setext heading levels', () => {
    expect(roundTrip('Hello\n===\n')).toContain('# Hello');
    expect(roundTrip('Hello\n===\n')).not.toContain('## Hello');
    expect(roundTrip('Sub\n---\n')).toContain('## Sub');
    expect(roundTrip('## Two\n')).toContain('## Two');
  });

  it('keeps a single tilde as text', () => {
    const serialized = roundTrip('H~2~O and `H~2~O`\n');
    expect(serialized).toContain('H~2~O and `H~2~O`');
    expect(serialized).not.toContain('\\~');
  });
});
