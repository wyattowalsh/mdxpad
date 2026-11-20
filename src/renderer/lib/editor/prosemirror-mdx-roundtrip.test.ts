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
  it('keeps a formula after a price', () => {
    const saved = roundTrip('Pay $5 then $a*b$.\n');
    expect(saved).toContain('Pay $5 then $a*b$.');
    expect(saved).not.toContain('\\');
    expect(roundTrip(saved.endsWith('\n') ? saved : `${saved}\n`)).not.toContain('\\');
  });

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

  it('keeps a blank line inside display math', () => {
    const doc = parseMdxContent('$$\n\n$$\n');
    expect(doc?.textContent).toContain('$$');
    const serialized = roundTrip('$$\n\n$$\n');
    expect(serialized.startsWith('$$')).toBe(true);
    expect(serialized.trim().endsWith('$$')).toBe(true);
    expect(roundTrip('$$\n```\nnot code\n```\n$$\n')).toContain('not code');
  });

  it('keeps unmatched markers in separate table columns', () => {
    const stars = roundTrip('| a* | b* |\n| --- | --- |\n| 1 | 2 |\n');
    expect(stars).toContain('| b');
    expect(roundTrip(`${stars}\n`)).toBe(stars);
    const doubled = roundTrip('| a** | b** |\n| --- | --- |\n| 1 | 2 |\n');
    expect(doubled).toContain('| b');
    expect(roundTrip(`${doubled}\n`)).toBe(doubled);
    const tildes = roundTrip('| a~~ | b~~ |\n| --- | --- |\n| 1 | 2 |\n');
    expect(tildes).toContain('| b');
    expect(roundTrip(`${tildes}\n`)).toBe(tildes);
    const across = roundTrip('| **a | b** |\n| --- | --- |\n| 1 | 2 |\n');
    expect(across).toContain('| --- | --- |');
    expect(across).toContain('| 1 | 2 |');
    expect(roundTrip(`${across}\n`)).toBe(across);
    const words = roundTrip('| notes_txt | size_kb |\n| --- | --- |\n| 1 | 2 |\n');
    expect(words).toContain('notes_txt');
    expect(words).toContain('| size_kb |');
    expect(roundTrip(`${words}\n`)).toBe(words);
  });

  it('keeps a pipe inside a table formula', () => {
    const source = '| f | g |\n| --- | --- |\n| $a|b$ | c |\n';
    const serialized = roundTrip(source);
    expect(serialized).toContain('$a|b$');
    expect(serialized).toContain('| c |');
    const escaped = roundTrip('| f |\n| --- |\n| $a\\|b$ |\n');
    expect(escaped).toContain('$a\\|b$');
    expect(roundTrip('| a\\|b | c |\n| --- | --- |\n| 1 | 2 |\n')).toContain('a\\|b');
    expect(roundTrip('| f | g |\n| --- | --- |\n| `a|b` | c |\n')).toContain('`a|b`');
    const html = roundTrip('| f | g |\n| --- | --- |\n| <em>a|b</em> | c |\n');
    expect(html).toContain('<em>a|b</em>');
    expect(html).toContain('| c |');
    expect(html).not.toContain('\\|');
    const linked = roundTrip('| f | g |\n| --- | --- |\n| [a|b](https://example.com) | c |\n');
    expect(linked).toContain('[a|b](https://example.com)');
    expect(linked).toContain('| c |');
    const image = roundTrip('| f | g |\n| --- | --- |\n| ![a|b](photo.png) | c |\n');
    expect(image).toContain('![a|b](photo.png)');
    expect(image).toContain('| c |');
    const reference = roundTrip(
      '| f | g |\n| --- | --- |\n| [a|b][ref] | c |\n\n[ref]: https://example.com\n'
    );
    expect(reference).toContain('[a|b](https://example.com)');
    expect(reference).toContain('| c |');
    const autolink = roundTrip('| f | g |\n| --- | --- |\n| <https://example.com/a|b> | c |\n');
    expect(autolink).toContain('example.com/a|b');
    expect(autolink).toContain('| c |');
    const strong = roundTrip('| f | g |\n| --- | --- |\n| **a|b** | c |\n');
    expect(strong).toContain('**a|b**');
    expect(strong).toContain('| c |');
    const emphasis = roundTrip('| f | g |\n| --- | --- |\n| _a|b_ | c |\n');
    expect(emphasis).toContain('*a|b*');
    expect(emphasis).toContain('| c |');
    const addressed = roundTrip(
      '| f | g |\n| --- | --- |\n| [see](https://example.com/a|b) | c |\n'
    );
    expect(addressed).toContain('https://example.com/a|b');
    expect(addressed).not.toContain('%EE%80%9D');
    expect(addressed).toContain('| c |');
  });

  it('keeps display math inside a list at a stable indent', () => {
    const source = '- item\n\n  $$\n  a+b\n  $$\n';
    const once = roundTrip(source);
    expect(once).toContain('a+b');
    expect(once).not.toContain('    a+b');
    expect(roundTrip(once.endsWith('\n') ? once : `${once}\n`)).toBe(once);
    const numbered = '1. $$\n   {a+b}^2\n   $$\n';
    const saved = roundTrip(numbered);
    expect(saved).toContain('{a+b}^2');
    expect(roundTrip(saved.endsWith('\n') ? saved : `${saved}\n`)).toBe(saved);
    const bullet = '- $$\n  a+b\n  $$\n';
    const bulleted = roundTrip(bullet);
    expect(roundTrip(bulleted.endsWith('\n') ? bulleted : `${bulleted}\n`)).toBe(bulleted);
  });

  it('keeps a wrapped heading inside a list', () => {
    const source = '- item\n  Title\n  =====\n';
    const saved = roundTrip(source);
    expect(saved).toContain('item');
    expect(saved).toContain('Title');
    expect(saved).toContain('  =====');
    const again = roundTrip(saved.endsWith('\n') ? saved : `${saved}\n`);
    const doc = parseMdxContent(again.endsWith('\n') ? again : `${again}\n`);
    expect(doc?.textContent).toContain('item');
    expect(doc?.textContent).toContain('Title');
    expect(again).toContain('=====');
  });

  it('keeps an indented fence inside a quoted list item', () => {
    const source = '> - item\n>\n>   ```\ncode\n```\n\nafter\n';
    const saved = roundTrip(source);
    expect(saved).toContain('code');
    expect(saved).toContain('after');
    expect(saved.indexOf('code')).toBeLessThan(saved.indexOf('after'));
    const doc = parseMdxContent(source);
    let code = '';
    doc?.descendants((node) => {
      if (node.type.name === 'code_block') {
        code += node.textContent;
      }
    });
    expect(code).toContain('code');
    expect(doc?.textContent).toContain('after');
  });

  it('leaves the paragraph after a quoted list fence outside the quote', () => {
    const source = '> - ```\n  code\n  ```\n\n  after\n';
    const saved = roundTrip(source);
    const again = roundTrip(saved.endsWith('\n') ? saved : `${saved}\n`);
    expect(again).toContain('after');
    expect(again).not.toContain('> after');
  });

  it('keeps a wrapped list fence inside a quote', () => {
    const source = '> - ```\n  code\n  ```\n\n  after\n';
    const saved = roundTrip(source);
    expect(saved).toContain('code');
    expect(saved).toContain('after');
    expect(saved.indexOf('after')).toBeGreaterThan(saved.lastIndexOf('```'));
    const again = roundTrip(saved.endsWith('\n') ? saved : `${saved}\n`);
    const doc = parseMdxContent(again.endsWith('\n') ? again : `${again}\n`);
    expect(doc?.textContent).toContain('code');
    expect(doc?.textContent).toContain('after');
  });

  it('keeps a wrapped fence inside a quote', () => {
    const source = '> ```\ncode\n```\n\nafter\n';
    const saved = roundTrip(source);
    expect(saved).toContain('> code');
    expect(saved).toContain('after');
    expect(saved.indexOf('after')).toBeGreaterThan(saved.lastIndexOf('> ```'));
    const again = roundTrip(saved.endsWith('\n') ? saved : `${saved}\n`);
    expect(again).toContain('> code');
    expect(again).toContain('after');
  });

  it('keeps a quoted formula inside its list item', () => {
    const source = '- item\n\n  > quote $$\n  > x^2\n  > $$\n  > more\n';
    const saved = roundTrip(source);
    expect(saved).toContain('  > x^2');
    expect(saved).not.toMatch(/^> x\^2/m);
    const again = roundTrip(saved.endsWith('\n') ? saved : `${saved}\n`);
    expect(again.replace(/\n$/, '')).toBe(saved.replace(/\n$/, ''));
  });

  it('keeps the indent of a quoted list formula', () => {
    const source = '> - Text $$\n>   x^2\n>   $$\n>   more\n';
    const saved = roundTrip(source);
    const again = roundTrip(saved.endsWith('\n') ? saved : `${saved}\n`);
    expect(saved).toContain('>   x^2');
    expect(saved).not.toContain('>     x^2');
    expect(again.replace(/\n$/, '')).toBe(saved.replace(/\n$/, ''));
  });

  it('keeps a quoted formula that opens at the end of a line', () => {
    const source = '> Text $$\n> x^2\n> $$\n>\n> more\n';
    const saved = roundTrip(source);
    const again = roundTrip(saved.endsWith('\n') ? saved : `${saved}\n`);
    expect(saved).not.toContain('> >');
    expect(again.replace(/\n$/, '')).toBe(saved.replace(/\n$/, ''));
    expect(again).toContain('x^2');
    expect(again).toContain('more');
  });

  it('keeps display math inside a blockquote', () => {
    const source = '> $$\n> a+b\n> $$\n';
    const doc = parseMdxContent(source);
    expect(doc?.textContent).toBe('$$a+b$$');
    expect(roundTrip(source)).toContain('a+b');
  });

  it('keeps a quote marker inside a TeX display formula', () => {
    const serialized = roundTrip('\\[\n> quote\n\\]\n');
    expect(serialized).toContain('\\[');
    expect(serialized).toContain('> quote');
    expect(serialized).toContain('\\]');
    expect(serialized).not.toContain('\n> \\]');
    const doc = parseMdxContent('\\[\n> quote\n\\]\n');
    expect(doc?.childCount).toBe(1);
    expect(doc?.textContent).toContain('> quote');
  });

  it('keeps a nested quote marker inside a quoted formula', () => {
    const source = '> $$\n> > nested\n> $$\n';
    const serialized = roundTrip(source);
    expect(serialized).toContain('> > nested');
    expect(serialized).not.toContain('\n> > $$');
    const doc = parseMdxContent(source);
    expect(doc?.textContent).toContain('> nested');
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

  it('keeps a backslash and a space before a line break', () => {
    const source = 'a\\ \nb\n';
    const once = roundTrip(source);
    expect(once).toBe('a\\\\\nb');
    expect(once).not.toContain('&#32;');
    expect(roundTrip(once.endsWith('\n') ? once : `${once}\n`)).toBe(once);
  });

  it('keeps the paragraph after a footnote', () => {
    const saved = roundTrip('[^1]: note\ncontinued\n');
    expect(saved).toContain('[^1]: note');
    expect(saved).toContain('\n\ncontinued');
    expect(saved).not.toContain('    continued');
    const indented = roundTrip('[^1]: note\n    continued\n');
    expect(indented).toContain('    continued');
  });

  it('keeps a link address that starts on the next line', () => {
    const saved = roundTrip('[id]:\nhttps://example.com\n');
    expect(saved).toContain('[id]:');
    expect(saved).toContain('https://example.com');
    const angled = roundTrip('[id]:\n<https://example.com>\n');
    expect(angled).toContain('<https://example.com>');
    const titled = roundTrip('[id]:\nhttps://example.com\n  "Title"\n');
    expect(titled).toContain('https://example.com');
    expect(titled).toContain('"Title"');
  });

  it('keeps a link title that starts on the next line', () => {
    const saved = roundTrip('[id]: https://example.com\n  "Title"\n');
    expect(saved).toContain('[id]: https://example.com');
    expect(saved).toContain('"Title"');
    const quoted = roundTrip("[id]: https://example.com\n  'Guide'\n");
    expect(quoted).toContain("'Guide'");
    const paren = roundTrip('[id]: https://example.com\n  (Notes)\n');
    expect(paren).toContain('(Notes)');
    const used = roundTrip('See [a][id].\n\n[id]: https://example.com\n  "Title"\n');
    expect(used).toContain('"Title"');
    const kept = roundTrip('[id]: https://example.com "Title"\n\nhello\n');
    expect(kept).toContain('hello');
    expect(kept).toContain('"Title"');
  });

  it('keeps a heading that starts with a byte-order mark', () => {
    const saved = roundTrip('\uFEFF# Title\n\nbody\n');
    expect(saved).toContain('# Title');
    expect(saved).not.toContain('\\#');
    expect(saved).toContain('body');
    const listed = roundTrip('\uFEFF- one\n- two\n');
    expect(listed).toContain('- one');
    expect(listed).toContain('- two');
    expect(listed).not.toContain('\\-');
  });

  it('keeps a backslash at the end of a web address', () => {
    const source = 'www.example.com/a\\ b\n';
    const once = roundTrip(source);
    expect(once).toContain('http://www.example.com/a%5C');
    expect(once).not.toContain('a\\)');
    const again = roundTrip(once.endsWith('\n') ? once : `${once}\n`);
    expect(again).toContain('http://www.example.com/a%5C');
  });

  it('keeps a hard break after a backslash and two spaces', () => {
    const source = 'a\\  \nb\n';
    const once = roundTrip(source);
    expect(once).toBe('a\\\\\\\nb');
    expect(roundTrip(once.endsWith('\n') ? once : `${once}\n`)).toBe(once);
  });

  it('keeps spaces inside strikethrough', () => {
    const once = roundTrip('~~  a  ~~\n');
    expect(once).toContain('~~  a  ~~');
    expect(roundTrip(once.endsWith('\n') ? once : `${once}\n`)).toBe(once);
    const coded = roundTrip('~~`  a  `~~\n');
    expect(coded).toContain('a');
    expect(roundTrip(coded.endsWith('\n') ? coded : `${coded}\n`)).toBe(coded);
  });

  it('keeps spaces at the edge of inline code', () => {
    const once = roundTrip('`  a  `\n');
    expect(once).toContain(' a ');
    expect(roundTrip(once.endsWith('\n') ? once : `${once}\n`)).toBe(once);
    const wider = roundTrip('`    code    `\n');
    expect(roundTrip(wider.endsWith('\n') ? wider : `${wider}\n`)).toBe(wider);
    expect(roundTrip('`code`\n')).toBe('`code`');
    expect(roundTrip('` a b `\n')).toBe('`a b`');
    expect(roundTrip('`   `\n')).toBe('` `');
  });

  it('keeps tildes inside code from ending the strikethrough', () => {
    const source = '~~remove `a~~b` now~~\n';
    const once = roundTrip(source);
    expect(once).toContain('~~remove `a~~b` now~~');
    expect(once).not.toContain('now\\~\\~');
    expect(roundTrip(once.endsWith('\n') ? once : `${once}\n`)).toBe(once);
  });

  it('keeps a pipe inside code when emphasis markers sit in that code', () => {
    const source = '| **a `b** | c` d** | e |\n| --- | --- |\n';
    const once = roundTrip(source);
    expect(once).toContain('| **a `b** | c` d** | e |');
    expect(roundTrip(once.endsWith('\n') ? once : `${once}\n`)).toBe(once);
  });

  it('keeps bold around an inner bold and italic', () => {
    const source = '**a *b **c** d* e**\n';
    const once = roundTrip(source);
    expect(once).toBe('**a *b c d* e**');
    expect(parseMdxContent(`${once}\n`)?.textContent).toBe('a b c d e');
    expect(roundTrip(`${once}\n`)).toBe(once);
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

  it('keeps escaped backslashes in a footnote', () => {
    const source = 'Note[^n]\n\n[^n]: \\\\(x\\\\\\)\n';
    const saved = roundTrip(source);
    const again = roundTrip(saved.endsWith('\n') ? saved : `${saved}\n`);
    const first = parseMdxContent(source)?.textContent ?? '';
    const second = parseMdxContent(saved.endsWith('\n') ? saved : `${saved}\n`)?.textContent ?? '';
    expect(second).toBe(first);
    expect(again.replace(/\n$/, '')).toBe(saved.replace(/\n$/, ''));
    expect(second).toContain('x');
  });

  it('keeps extra backslashes in an image description', () => {
    const source = '![\\\\(x\\\\\\)](a.png)\n';
    const saved = roundTrip(source);
    const again = roundTrip(saved.endsWith('\n') ? saved : `${saved}\n`);
    expect(again.replace(/\n$/, '')).toBe(saved.replace(/\n$/, ''));
    const doc = parseMdxContent(source);
    let alt = '';
    doc?.descendants((node) => {
      if (node.type.name === 'image') {
        alt = String(node.attrs.alt ?? '');
      }
    });
    let savedAlt = '';
    parseMdxContent(saved.endsWith('\n') ? saved : `${saved}\n`)?.descendants((node) => {
      if (node.type.name === 'image') {
        savedAlt = String(node.attrs.alt ?? '');
      }
    });
    expect(savedAlt).toBe(alt);
  });

  it('keeps a formula in an image description', () => {
    const serialized = roundTrip('![alt \\(x^2\\)](a.png)\n');
    expect(serialized).toContain('\\(x^2\\)');
    expect(serialized).not.toContain('\uE013');
    expect(serialized).not.toContain('\uE014');
    expect(roundTrip('[\\(2\\)](https://example.com)\n')).toContain('\\(2\\)');
    const titled = roundTrip('[text](https://example.com "see \\(x\\)")\n');
    expect(titled).toContain('\\(x\\)');
    expect(titled).not.toContain('\uE013');
    const imageTitle = roundTrip('![alt](a.png "see \\(x\\)")\n');
    expect(imageTitle).toContain('\\(x\\)');
    expect(imageTitle).not.toContain('\uE013');
    const reference = roundTrip('[link][id]\n\n[id]: https://example.com "see \\(x\\)"\n');
    expect(reference).toContain('\\(x\\)');
    expect(reference).not.toContain('\uE013');
    const destination = roundTrip('See [a][id].\n\n[id]: https://example.com/a\\(b\\)\n');
    expect(destination).toContain('https://example.com/a(b)');
    expect(destination).not.toContain('\uE013');
    expect(destination).not.toContain('\uE014');
    const brackets = roundTrip('See [a][id].\n\n[id]: https://example.com/a\\[b\\]\n');
    expect(brackets).toContain('https://example.com/a%5Bb%5D');
    expect(roundTrip(brackets.endsWith('\n') ? brackets : `${brackets}\n`)).toBe(brackets);
    const priced = roundTrip('Price $5 and \\(x\\).\n');
    expect(priced).toContain('Price $5 and \\(x\\).');
    expect(priced).not.toContain('Price Price');
    expect(priced).not.toContain('\\\\(x');
    const noted = roundTrip('Math note \\(x[^1]\\).\n\n[^1]: M\n');
    expect(noted).toContain('\\(x[^1]\\)');
    expect(noted).toContain('[^1]: M');
    expect(noted).not.toContain('\\\\)');
    const coded = roundTrip('See \\(x `y`\\).\n\nNext \\(z\\).\n');
    expect(coded).toContain('\\(x `y`\\)');
    expect(coded).toContain('\\(z\\)');
    expect(coded).not.toContain('\\\\)');
    const struck = roundTrip('See \\(x ~~y~~\\).\n');
    expect(struck).toContain('\\(x ~~y~~\\)');
    expect(struck).not.toContain('\\\\)');
    const linked = roundTrip('Link \\([docs](https://example.com)\\).\n');
    expect(linked).toContain('\\([docs](https://example.com)\\)');
    expect(linked).not.toContain('\\\\)');
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

  it('keeps a TeX escape inside a formula', () => {
    expect(roundTrip('$\\{x\\}$\n')).toContain('$\\{x\\}$');
    expect(roundTrip('$a\\|b$\n')).toContain('$a\\|b$');
    expect(roundTrip('$\\#$\n')).toContain('$\\#$');
    expect(roundTrip('$\\alpha$\n')).toContain('$\\alpha$');
    expect(roundTrip('\\(\\{x\\}\\)\n')).toContain('\\(\\{x\\}\\)');
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

  it('keeps a code fence that starts on a task item', () => {
    const source = '- [x] ```\n      code\n      ```\n';
    const once = roundTrip(source);
    expect(once).toContain('[x]');
    expect(once).toContain('```');
    expect(once).toContain('code');
    expect(once).not.toContain('`    code');
    expect(roundTrip(once.endsWith('\n') ? once : `${once}\n`)).toBe(once);
    const labeled = '- [ ] ```js\n      const x = 1\n      ```\n';
    const saved = roundTrip(labeled);
    expect(saved).toContain('```js');
    expect(saved).toContain('const x = 1');
    expect(roundTrip(saved.endsWith('\n') ? saved : `${saved}\n`)).toBe(saved);
    const quoted = '> - [x] ```\n>       code\n>       ```\n';
    const inQuote = roundTrip(quoted);
    expect(inQuote).toContain('```');
    expect(inQuote).toContain('code');
    expect(inQuote).not.toContain('`    code');
    expect(roundTrip(inQuote.endsWith('\n') ? inQuote : `${inQuote}\n`)).toBe(inQuote);
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

  it('keeps a footnote marker inside a link label', () => {
    const source = 'See [the note[^1]](https://example.com).\n\n[^1]: Details\n';
    const serialized = roundTrip(source);
    expect(serialized).toContain('[the note[^1]](https://example.com)');
    expect(serialized).toContain('[^1]: Details');
    expect(serialized).not.toContain('\\[');
    const image = roundTrip('![chart[^1]](./plot.png)\n\n[^1]: Details\n');
    expect(image).toContain('![chart[^1]](./plot.png)');
    expect(image).not.toContain('!\\[');
    const after = roundTrip('Read [docs](https://example.com)[^1].\n\n[^1]: Details\n');
    expect(after).toContain('[docs](https://example.com)[^1]');
  });

  it('does not indent a footnote formula further on each save', () => {
    const source = 'Foot[^1]\n\n[^1]: \\(x  \n    y\\)\n';
    const first = roundTrip(source);
    const second = roundTrip(first.endsWith('\n') ? first : `${first}\n`);
    expect(second).toBe(first);
    expect(first).toContain('y\\)');
    expect(first).not.toContain('        y');
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

  it('keeps an escaped entity as text', () => {
    expect(roundTrip('a\\&amp;b\n')).toBe('a\\&amp;b');
    expect(roundTrip('a\\&nbsp;b\n')).toBe('a\\&nbsp;b');
    expect(roundTrip('a\\&#32;b\n')).toBe('a\\&#32;b');
    expect(roundTrip('AT&T\n')).toBe('AT&T');
    expect(roundTrip('`&amp;`\n')).toBe('`&amp;`');
    expect(roundTrip('$a&b$\n')).toContain('$a&b$');
    expect(roundTrip('&nbsp;keep\n')).toBe('&nbsp;keep');
    const saved = roundTrip('a\\&amp;b\n');
    expect(parseMdxContent(`${saved}\n`)?.textContent).toBe('a&amp;b');
  });

  it('keeps tildes inside code', () => {
    expect(roundTrip('`~~~~~~~~`\n')).toBe('`~~~~~~~~`');
    const struck = roundTrip('~~hello `x`~~\n');
    expect(struck).toContain('~~');
    expect(struck).toContain('`x`');
    expect(roundTrip(struck.endsWith('\n') ? struck : `${struck}\n`)).toBe(struck);
    const image = roundTrip('~~hello ![alt](a.png)~~\n');
    expect(image).toContain('![alt](a.png)');
    expect(roundTrip(image.endsWith('\n') ? image : `${image}\n`)).toBe(image);
  });

  it('keeps a non-breaking space, a tab, and a line character', () => {
    expect(roundTrip('&nbsp;keep\n')).toBe('&nbsp;keep');
    expect(roundTrip('**&nbsp;keep**\n')).toBe('**&nbsp;keep**');
    expect(roundTrip('end&nbsp;\n')).toBe('end&nbsp;');
    expect(roundTrip('a&nbsp;b\n')).toBe('a&nbsp;b');
    expect(roundTrip('&#9;tab\n')).toBe('&#9;tab');
    expect(roundTrip('a&#10;b\n')).toBe('a&#10;b');
    expect(roundTrip('`&nbsp;`\n')).toBe('`&nbsp;`');
    const saved = roundTrip('&nbsp;keep\n');
    expect(roundTrip(`${saved}\n`)).toBe(saved);
    expect(parseMdxContent(`${saved}\n`)?.textContent).toBe('\u00A0keep');
  });

  it('keeps code and emphasis inside one link', () => {
    expect(roundTrip('[a **b** c](url)\n')).toBe('[a **b** c](url)');
    expect(roundTrip('[a *b* c](url)\n')).toBe('[a *b* c](url)');
    expect(roundTrip('[a `b` c](url)\n')).toBe('[a `b` c](url)');
    expect(roundTrip('[`docs`](url)\n')).toBe('[`docs`](url)');
    expect(roundTrip('[a `b`](url)\n')).toBe('[a `b`](url)');
    expect(roundTrip('**[docs](url)**\n')).toBe('**[docs](url)**');
    expect(roundTrip('**a [b](url) c**\n')).toBe('**a [b](url) c**');
    expect(roundTrip('[~~docs~~](url)\n')).toBe('[~~docs~~](url)');
    expect(roundTrip('~~[a `b`](url)~~\n')).toBe('[~~a `b`~~](url)');
    expect(roundTrip('[**a** *b*](url)\n')).toBe('[**a** *b*](url)');
    expect(roundTrip('[~~a~~ **b**](url)\n')).toBe('[~~a~~ **b**](url)');
  });

  it('keeps an escaped bracket in a link after an escaped wiki link', () => {
    const source = '\\[\\[wiki]]\n\n[link \\[foo\\]](/uri)\n';
    const serialized = roundTrip(source);
    expect(serialized).toContain('[link \\[foo\\]](/uri)');
    expect(serialized).toContain('\\[\\[wiki]]');
    const again = roundTrip(serialized.endsWith('\n') ? serialized : `${serialized}\n`);
    expect(again).toContain('[link \\[foo\\]](/uri)');
    const noted = roundTrip('> \\[!NOTE]\n> hi\n\n[link \\[foo\\]](/uri)\n');
    expect(noted).toContain('[link \\[foo\\]](/uri)');
    expect(noted).toContain('hi');
  });

  it('keeps a bracket inside a link label', () => {
    const nested = '[link [foo [bar]]](/uri)\n';
    const once = roundTrip(nested);
    expect(once).toContain('\\]');
    expect(once).toContain('](/uri)');
    expect(roundTrip(once.endsWith('\n') ? once : `${once}\n`)).toBe(once);
    const closed = '[foo\\] bar](https://example.com)\n';
    const saved = roundTrip(closed);
    expect(saved).toContain('\\]');
    expect(saved).toContain('](https://example.com)');
    expect(roundTrip(saved.endsWith('\n') ? saved : `${saved}\n`)).toBe(saved);
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

  it('keeps a reference label that contains a dollar sign', () => {
    const source = 'See [a$b] and $x^2$.\n\n[a$b]: https://example.com/guide\n';
    const once = roundTrip(source);
    expect(once).toContain('[a$b]');
    expect(once).not.toContain('\\[');
    expect(once).toContain('$x^2$');
    expect(once).toContain('https://example.com/guide');
    const twice = roundTrip(once.endsWith('\n') ? once : `${once}\n`);
    expect(twice).toBe(once);
  });

  it('keeps a formula that contains a link', () => {
    const source = 'See \\(x and [a \\)](https://example.com) y\\).\n';
    const once = roundTrip(source);
    expect(once).toContain('\\(x and [a \\)](https://example.com) y\\)');
    expect(once).not.toContain('y\\\\)');
    expect(roundTrip(once.endsWith('\n') ? once : `${once}\n`)).toBe(once);
  });

  it('keeps a formula inside strikethrough', () => {
    const inline = roundTrip('~~strike \\(x\\)~~\n');
    expect(inline).toBe('~~strike \\(x\\)~~');
    expect(roundTrip(`${inline}\n`)).toBe(inline);
    const display = roundTrip('~~strike \\[y\\]~~\n');
    expect(display).toBe('~~strike \\[y\\]~~');
    expect(roundTrip(`${display}\n`)).toBe(display);
  });

  it('keeps a formula closer after struck text', () => {
    const source = 'See \\(x ~~y\\)~~ z\\).\n';
    const once = roundTrip(source);
    expect(once).toContain('~~y\\)~~');
    expect(once).toContain('z\\)');
    expect(roundTrip(once.endsWith('\n') ? once : `${once}\n`)).toBe(once);
  });

  it('keeps a bracket that belongs to a web address', () => {
    const saved = roundTrip('See https://example.com/a<b> now\n');
    expect(saved).toContain('https://example.com/a%3Cb%3E');
    expect(saved).toContain('<b>');
    expect(saved).not.toContain('example.com/a)');
    const again = roundTrip(saved.endsWith('\n') ? saved : `${saved}\n`);
    expect(again).toContain('https://example.com/a%3Cb%3E');
    expect(again).not.toContain('example.com/a)');
  });

  it('keeps nested emphasis on the same words', () => {
    expect(roundTrip('***foo** bar*\n')).toBe('***foo** bar*');
    expect(roundTrip('***foo* bar**\n')).toBe('***foo* bar**');
    expect(roundTrip('***both***\n')).toBe('***both***');
    expect(roundTrip('**foo *bar* baz**\n')).toBe('**foo *bar* baz**');
    expect(roundTrip('*foo **bar** baz*\n')).toBe('*foo **bar** baz*');
  });
});
