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

  it('keeps a JSX block', () => {
    const serialized = roundTrip('<Card>Hello</Card>\n');
    expect(serialized).toContain('<Card>Hello</Card>');
    expect(serialized).not.toContain('mdxpad-jsx');
  });

  it('keeps math characters literal', () => {
    expect(roundTrip('The product is $a * b$.\n')).toContain('$a * b$');
    expect(roundTrip('The term is $a_{i}$.\n')).toContain('$a_{i}$');
    expect(roundTrip('The product is $a * b$.\n')).not.toContain('\\*');
    expect(roundTrip('The term is $a_{i}$.\n')).not.toContain('\\_');
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
});
