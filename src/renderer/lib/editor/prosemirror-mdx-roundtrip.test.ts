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

  it('keeps a quote marker inside display math', () => {
    const serialized = roundTrip('$$\n> quote inside math\n$$\n');
    expect(serialized).toContain('> quote inside math');
    expect(serialized).not.toContain('\n> $$');
    expect(serialized.startsWith('$$')).toBe(true);
    const doc = parseMdxContent('$$\n> quote inside math\n$$\n');
    expect(doc?.textContent).toContain('> quote inside math');
    expect(doc?.childCount).toBe(1);
  });

  it('keeps a command inside display math', () => {
    const serialized = roundTrip('$$\n\\frac{1}{2}\n$$\n');
    expect(serialized).toContain('\\frac{1}{2}');
    expect(serialized).not.toContain('\\\\frac');
    const bracketed = roundTrip('\\[\n\\frac{1}{2}\n\\]\n');
    expect(bracketed).toContain('\\frac{1}{2}');
    expect(bracketed).not.toContain('\\\\frac');
  });

  it('keeps a nested fence long enough to stay one block', () => {
    const source = '````\n```\ncode\n```\n````\n';
    expect(roundTrip(source)).toContain('```\ncode\n```');
  });

  it('keeps strikethrough around bold', () => {
    const serialized = roundTrip('~~strike **bold**~~\n');
    expect(serialized).toContain('~~strike **bold**~~');
  });

  it('keeps an empty link label', () => {
    expect(roundTrip('[](https://example.com)\n')).toContain('[](https://example.com)');
  });

  it('keeps an MDX comment', () => {
    const serialized = roundTrip('{/* comment */}\n');
    expect(serialized).toContain('{/* comment */}');
    expect(serialized).not.toContain('\\*');
  });

  it('keeps a quoted title and parentheses in an address', () => {
    const titled = roundTrip('[text](https://example.com \'say "hi"\')\n');
    const titledDoc = parseMdxContent(titled);
    const link = titledDoc?.firstChild?.firstChild?.marks.find((mark) => mark.type.name === 'link');
    expect(link?.attrs.title).toBe('say "hi"');
    expect(link?.attrs.href).toBe('https://example.com');
    const addressed = roundTrip('<https://example.com/a)b>\n');
    const addressDoc = parseMdxContent(addressed);
    const auto = addressDoc?.firstChild?.firstChild?.marks.find(
      (mark) => mark.type.name === 'link'
    );
    expect(auto?.attrs.href).toBe('https://example.com/a)b');
  });

  it('keeps an escaped parenthesis in a link address', () => {
    const serialized = roundTrip('[wiki](https://example.com/a\\)b)\n');
    const doc = parseMdxContent(serialized);
    const link = doc?.firstChild?.firstChild?.marks.find((mark) => mark.type.name === 'link');
    expect(link?.attrs.href).toBe('https://example.com/a)b');
    expect(serialized).toContain('https://example.com/a)b');
  });

  it('keeps an asterisk in image alt text', () => {
    const serialized = roundTrip('![a*b](photo.png)\n');
    expect(serialized).toContain('![a*b](photo.png)');
    expect(serialized).not.toContain('\\*');
  });

  it('keeps a formula in an image description', () => {
    const serialized = roundTrip('![alt \\(x^2\\)](a.png)\n');
    expect(serialized).toContain('x^2');
    expect(serialized).not.toContain('\uE013');
    expect(serialized).not.toContain('\uE014');
    const price = roundTrip('Price \\(\\$5\\).\n');
    expect(price).toContain('\\$5');
    expect(price).not.toContain('\uE019');
  });

  it('keeps image alt text', () => {
    expect(roundTrip('![diagram](./a.png "title")\n')).toContain('![diagram](./a.png "title")');
  });

  it('keeps a space in an image path', () => {
    const serialized = roundTrip('![Alt](<my photo.png> "Sunset")\n');
    expect(serialized).toContain('![Alt](<my photo.png> "Sunset")');
    expect(serialized).not.toContain('%20');
  });

  it('keeps asterisks inside a formula', () => {
    expect(roundTrip('$a*b*c$\n')).toContain('$a*b*c$');
    expect(roundTrip('$a*\\$b*$\n')).toContain('$a*\\$b*$');
    expect(roundTrip('Area \\((a*b)*(c*d)\\).\n')).toContain('\\((a*b)*(c*d)\\)');
    expect(roundTrip('\\(a \\\\) still\\)\n')).toContain('\\(a \\\\) still\\)');
  });

  it('keeps the sample of a fence that opens on a list marker', () => {
    const quoted = roundTrip('> - ```\n> const x = 1\n> ```\n');
    expect(quoted).toContain('const x = 1');
    expect(quoted).toContain('>   const x = 1');
    expect(roundTrip(quoted)).toBe(quoted);
    const top = roundTrip('- ```\nconst x = 1\n```\n');
    expect(top).toContain('const x = 1');
    expect(top).toContain('  const x = 1');
    expect(roundTrip(top)).toBe(top);
  });

  it('keeps a task checkbox', () => {
    const serialized = roundTrip('- [ ] todo\n');
    expect(serialized).toContain('[ ] todo');
    expect(serialized).not.toContain('\\[');
    const done = roundTrip('- [x] done\n');
    expect(done).toContain('[x] done');
    const doc = parseMdxContent('- [x] **done**\n');
    const item = doc?.firstChild?.firstChild;
    expect(item?.attrs.task).toBe('done');
    expect(item?.textContent).toBe('done');
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

  it('keeps a setext heading inside a list item', () => {
    const serialized = roundTrip('- item\n  ---\n  after\n');
    expect(serialized).toContain('## item');
    expect(serialized).toContain('after');
    expect(serialized).not.toContain('- \n');
    const doc = parseMdxContent(serialized.endsWith('\n') ? serialized : `${serialized}\n`);
    expect(doc?.firstChild?.type.name).toBe('bullet_list');
    expect(doc?.firstChild?.firstChild?.firstChild?.type.name).toBe('heading');
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

  it('keeps a table and a quote inside a footnote', () => {
    const table = roundTrip('A[^1].\n\n[^1]: | A | B |\n    | --- | --- |\n    | 1 | 2 |\n');
    expect(table).toContain('[^1]: | A | B |');
    expect(table).toContain('    | --- | --- |');
    expect(table).toContain('    | 1 | 2 |');
    const quote = roundTrip('A[^1].\n\n[^1]: > hello\n    > world\n');
    expect(quote).toContain('[^1]: > hello');
    expect(quote).toContain('    > world');
    expect(quote).not.toContain('\\>');
    const code = roundTrip('A[^1].\n\n[^1]: ```js\n    const x = 1\n    ```\n');
    expect(code).toContain('[^1]: ```js');
    expect(code).toContain('    const x = 1');
    expect(code).toContain('    ```');
    expect(code).not.toContain('mdxpad-footnote');
  });

  it('keeps adjacent footnote definitions separate', () => {
    const serialized = roundTrip('See [^a] and [^b].\n\n[^a]: One\n[^b]: Two\n');
    expect(serialized).toContain('[^a]: One');
    expect(serialized).toContain('[^b]: Two');
    expect(serialized).not.toContain('    [^b]:');
  });

  it('keeps a footnote reference and its definition', () => {
    const serialized = roundTrip('A footnote[^1].\n\n[^1]: The note\n');
    expect(serialized).toContain('A footnote[^1].');
    expect(serialized).toContain('[^1]: The note');
    expect(serialized).not.toContain('](The note)');
    expect(serialized).not.toContain('\\[');
  });

  it('keeps strikethrough across one line break', () => {
    const serialized = roundTrip('~~hello\nworld~~\n');
    expect(parseMdxContent(serialized)?.textContent).toBe('helloworld');
    expect(parseMdxContent(serialized)?.childCount).toBe(1);
    const spaced = roundTrip('~~hello \nworld~~\n');
    expect(parseMdxContent(spaced)?.textContent).toContain('world');
    const hard = roundTrip('~~hello  \nworld~~\n');
    expect(parseMdxContent(hard)?.textContent).toBe('helloworld');
    expect(hard).toContain('world');
  });

  it('keeps an asterisk inside strikethrough', () => {
    const serialized = roundTrip('~~a*b~~\n');
    expect(serialized).toContain('~~a*b~~');
    expect(serialized).not.toContain('\\*');
    const struck = roundTrip('~~`code`~~\n');
    expect(struck).toContain('~~`code`~~');
    expect(struck).not.toContain('`~~code~~`');
    expect(roundTrip('~~hello `x`~~\n')).toContain('~~hello `x`~~');
    const image = roundTrip('~~![alt](a.png)~~\n');
    expect(image).toContain('~~![alt](a.png)~~');
    const imageDoc = parseMdxContent(image.endsWith('\n') ? image : `${image}\n`);
    let imageStruck = false;
    imageDoc?.descendants((node) => {
      if (node.type.name === 'image') {
        imageStruck = node.marks.some((mark) => mark.type.name === 'strikethrough');
      }
    });
    expect(imageStruck).toBe(true);
    expect(roundTrip('~~hello ![alt](a.png)~~\n')).toContain('~~hello ![alt](a.png)~~');
  });

  it('keeps strikethrough', () => {
    const serialized = roundTrip('~~gone~~\n');
    expect(serialized).toContain('~~gone~~');
    expect(serialized).not.toContain('\\~');
  });

  it('keeps a table that follows a paragraph', () => {
    const listed = roundTrip('- item\n\n  | A | B |\n  | --- | --- |\n  | 1 | 2 |\n');
    expect(listed).toContain('- item');
    expect(listed).toContain('  | A | B |');
    expect(listed).toContain('  | 1 | 2 |');
    expect(listed).not.toContain('item|');
    const quoted = roundTrip('> intro\n>\n> | A | B |\n> | --- | --- |\n> | 1 | 2 |\n');
    expect(quoted).toContain('> intro');
    expect(quoted).toContain('> | A | B |');
    expect(quoted).not.toContain('intro|');
  });

  it('keeps a table inside a quote', () => {
    const serialized = roundTrip('> | A | B |\n> | --- | ---: |\n> | 1 | 2 |\n');
    expect(serialized).toContain('> | A | B |');
    expect(serialized).toContain('> | --- | ---: |');
    expect(serialized).toContain('> | 1 | 2 |');
    const doc = parseMdxContent(serialized.endsWith('\n') ? serialized : `${serialized}\n`);
    expect(doc?.firstChild?.type.name).toBe('blockquote');
    expect(doc?.firstChild?.firstChild?.type.name).toBe('table');
  });

  it('keeps a table and its alignment', () => {
    const source = '| A | B |\n| --- | ---: |\n| 1 | **2** |\n';
    const doc = parseMdxContent(source);
    expect(doc?.firstChild?.type.name).toBe('table');
    const serialized = roundTrip(source);
    expect(serialized).toContain('| A | B |');
    expect(serialized).toContain('| --- | ---: |');
    expect(serialized).toContain('| 1 | **2** |');
    const left = roundTrip('| A | B |\n| :--- | ---: |\n| 1 | 2 |\n');
    expect(left).toContain('| :--- | ---: |');
    const leftDoc = parseMdxContent(left.endsWith('\n') ? left : `${left}\n`);
    expect(leftDoc?.firstChild?.firstChild?.firstChild?.attrs.align).toBe('left');
  });

  it('keeps a fenced block inside a quote', () => {
    const source = '> ```js\n> const x = 1\n> ```\n>\n> After\n';
    const serialized = roundTrip(source);
    expect(serialized).toContain('> ```');
    expect(serialized).toContain('> After');
    const doc = parseMdxContent(serialized.endsWith('\n') ? serialized : `${serialized}\n`);
    expect(doc?.childCount).toBe(1);
    expect(doc?.firstChild?.type.name).toBe('blockquote');
  });

  it('keeps an indented code block indented', () => {
    const serialized = roundTrip('    const x = 1\n');
    expect(serialized).toContain('    const x = 1');
    expect(serialized).not.toContain('```');
    const quoted = roundTrip('>     const x = 1\n>     const y = 2\n');
    expect(quoted).toContain('>     const x = 1');
    expect(quoted).toContain('>     const y = 2');
    expect(roundTrip('```js\nconst x = 1\n```\n')).toContain('```js');
  });

  it('keeps setext heading levels', () => {
    expect(roundTrip('Hello\n===\n')).toContain('# Hello');
    expect(roundTrip('Hello\n===\n')).not.toContain('## Hello');
    expect(roundTrip('Sub\n---\n')).toContain('## Sub');
    expect(roundTrip('## Two\n')).toContain('## Two');
  });

  it('keeps an escaped marker after a line break', () => {
    const soft = roundTrip('hello\n\\# not a heading\n');
    expect(soft).toContain('\\# not a heading');
    expect(parseMdxContent(soft)?.childCount).toBe(1);
    const hard = roundTrip('hello  \n\\> quote\n');
    expect(hard).toContain('\\> quote');
    expect(parseMdxContent(hard)?.childCount).toBe(1);
    const literal = roundTrip('\\~\\~gone\\~\\~\n');
    expect(literal).toContain('\\~\\~gone\\~\\~');
    expect(literal).not.toContain('~~gone~~');
  });

  it('keeps a single tilde as text', () => {
    const serialized = roundTrip('H~2~O and `H~2~O`\n');
    expect(serialized).toContain('H~2~O and `H~2~O`');
    expect(serialized).not.toContain('\\~');
  });

  it('keeps distinct bullet markers', () => {
    expect(roundTrip('- one\n+ two\n* three\n')).toBe('- one\n+ two\n* three');
  });

  it('keeps parenthesis numbering', () => {
    expect(roundTrip('1) one\n2) two\n')).toBe('1) one\n2) two');
    expect(roundTrip('1. one\n2. two\n')).toBe('1. one\n2. two');
  });

  it('keeps a list that starts at zero', () => {
    expect(roundTrip('0. zero\n1. one\n')).toBe('0. zero\n1. one');
    expect(roundTrip('0) zero\n1) one\n')).toBe('0) zero\n1) one');
  });

  it('keeps the following lines inside a double-digit list item', () => {
    expect(roundTrip('10. parent\n    - child\n')).toBe('10. parent\n    - child');
    expect(roundTrip('10. item\n\n    second paragraph\n')).toBe(
      '10. item\n\n    second paragraph'
    );
    expect(roundTrip('9. item\n10. next\n    continuation\n')).toBe(
      '9. item\n10. next\n    continuation'
    );
    expect(roundTrip('1. one\n   two lines\n')).toBe('1. one\n   two lines');
    expect(roundTrip('10) ten\n    more\n')).toBe('10) ten\n    more');
  });

  it('keeps an unmatched bracket from gaining backslashes', () => {
    expect(roundTrip('\\[not math]\n')).toBe('\\[not math]');
    expect(roundTrip('see \\[x]\n')).toBe('see \\[x]');
    expect(roundTrip('> \\[note]\n')).toBe('> \\[note]');
    expect(roundTrip('\\[\na+b\n\\]\n')).toBe('\\[\na+b\n\\]');
    expect(roundTrip('\\]not\n')).toBe(']not');
  });

  it('keeps a literal marker beside emphasis', () => {
    expect(roundTrip('\\__not strong__\n')).toBe('\\_*not strong*\\_');
    expect(roundTrip('mix \\*em **both*** end\n')).toBe('mix \\*em **both**\\* end');
  });

  it('keeps an image description that escapes a star', () => {
    expect(roundTrip('![a\\*b](a.png)\n')).toBe('![a*b](a.png)');
    const again = roundTrip('![a*b](a.png)\n');
    expect(roundTrip(again.endsWith('\n') ? again : `${again}\n`)).toBe(again);
  });

  it('keeps an escaped star inside emphasis', () => {
    expect(roundTrip('*foo\\*bar*\n')).toBe('*foo\\*bar*');
    expect(roundTrip('**foo\\*bar**\n')).toBe('**foo*bar**');
    expect(roundTrip('a *b\\* c*\n')).toBe('a *b\\* c*');
  });

  it('keeps literal stars that are not emphasis', () => {
    expect(roundTrip('a * b * c\n')).toBe('a * b * c');
    expect(roundTrip('*foo**bar*\n')).toBe('*foo**bar*');
    expect(roundTrip('\\*foo\\*\n')).toBe('\\*foo\\*');
    expect(roundTrip('\\* item\n')).toBe('\\* item');
    expect(roundTrip('\\*\\*\\*\n')).toBe('\\*\\*\\*');
  });

  it('keeps nested emphasis on the same words', () => {
    expect(roundTrip('***foo** bar*\n')).toBe('***foo** bar*');
    expect(roundTrip('***foo* bar**\n')).toBe('***foo* bar**');
    expect(roundTrip('***both***\n')).toBe('***both***');
    expect(roundTrip('**foo *bar* baz**\n')).toBe('**foo *bar* baz**');
    expect(roundTrip('*foo **bar** baz*\n')).toBe('*foo **bar** baz*');
  });
});
