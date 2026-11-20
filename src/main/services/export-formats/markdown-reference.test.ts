import { describe, expect, it } from 'vitest';

import { prepareMarkdownSource } from '@shared/lib/markdown-math';

import { renderMarkdownInline } from './markdown-inline-html';
import { markdownToPdfHtml } from './pdf-exporter';
import { plainFootnoteMarkers } from './markdown-footnote';
import { omitLocalMarkdownTargets } from './omit-local-markdown-targets';
import { expandImageReferences, expandLinkReferences } from './markdown-reference';

describe('expandLinkReferences', () => {
  it('keeps parentheses in an angle reference address', () => {
    const source = 'See [a][id].\n\n[id]: <https://example.com/a(b)> "Guide"\n';
    const expanded = expandLinkReferences(prepareMarkdownSource(source, { preserveHtml: true }));
    expect(expanded).toContain('[a](<https://example.com/a(b)> "Guide")');
    expect(expanded).not.toContain('[https://example.com/a(b)]');
  });

  it('keeps a reference address on the following line', () => {
    const source = 'See [a][id].\n\n[id]:\n<https://example.com/a(b)>\n';
    const expanded = expandLinkReferences(prepareMarkdownSource(source, { preserveHtml: true }));
    expect(expanded).toContain('[a](https://example.com/a(b))');
    expect(expanded).not.toContain('[https://example.com/a(b)]');
  });

  it('keeps an escaped greater-than in a reference address', () => {
    const source = 'See [a][id].\n\n[id]: <https://example.com/a\\>b>\n';
    const expanded = expandLinkReferences(prepareMarkdownSource(source, { preserveHtml: true }));
    expect(expanded).toContain('[a](https://example.com/a\\>b)');
    expect(expanded).not.toContain('[https://example.com');
    expect(renderMarkdownInline(expanded)).toContain('href="https://example.com/a%3Eb"');
  });

  it('keeps an escaped parenthesis on the following reference line', () => {
    const source = 'See [a][id].\n\n[id]:\nhttps://example.com/a\\(b\\)\n';
    const prepared = prepareMarkdownSource(source, { preserveHtml: true });
    expect(prepared).not.toContain('$');
    const expanded = expandLinkReferences(prepared);
    expect(expanded).toContain('https://example.com/a\\(b\\)');
    expect(renderMarkdownInline(expanded)).toContain('href="https://example.com/a(b)"');
    const quoted = '> [id]:\n> https://example.com/a\\(b\\)\n\n[a][id]\n';
    const quotedPrepared = prepareMarkdownSource(quoted, { preserveHtml: true });
    expect(quotedPrepared).not.toContain('$');
    expect(renderMarkdownInline(expandLinkReferences(quotedPrepared))).toContain(
      'href="https://example.com/a(b)"'
    );
  });

  it('keeps an escaped parenthesis in a bare reference address', () => {
    const source = 'See [a][id].\n\n[id]: https://example.com/a\\(b\\)\n';
    const prepared = prepareMarkdownSource(source, { preserveHtml: true });
    expect(prepared).not.toContain('$');
    const expanded = expandLinkReferences(prepared);
    expect(expanded).toContain('https://example.com/a\\(b\\)');
    expect(renderMarkdownInline(expanded)).toContain('href="https://example.com/a(b)"');
  });

  it('keeps an escaped parenthesis in a reference address', () => {
    const source = 'See [a][id].\n\n[id]: <https://example.com/a\\(b\\)>\n';
    const prepared = prepareMarkdownSource(source, { preserveHtml: true });
    expect(prepared).not.toContain('$');
    expect(expandLinkReferences(prepared)).toContain('[a](https://example.com/a\\(b\\))');
  });

  it('keeps a reference address inside a quote', () => {
    const source = '> [a][id]\n>\n> [id]: <https://example.com/a(b)>\n';
    const expanded = expandLinkReferences(prepareMarkdownSource(source, { preserveHtml: true }));
    expect(expanded).toContain('[a](https://example.com/a(b))');
    expect(expanded).not.toContain('[https://example.com/a(b)]');
  });

  it('keeps a definition line that continues a paragraph', () => {
    const plain = markdownToPdfHtml('para\n[a]: https://example.com\n');
    expect(plain).toContain('para');
    expect(plain).toContain('[a]:');
    expect(plain).toContain('https://example.com');
    const quoted = markdownToPdfHtml('> [a]\n> [a]: https://example.com\n> more\n');
    expect(quoted).toContain('[a]:');
    expect(quoted).toContain('more');
    expect(quoted.match(/<blockquote>/g)).toHaveLength(1);
    const linked = markdownToPdfHtml('# Title\n[a]: https://example.com\n\n[a]\n');
    expect(linked).toContain('href="https://example.com"');
    const underlined = markdownToPdfHtml('Title\n=====\n[a]: https://example.com\n\n[a]\n');
    expect(underlined).toContain('href="https://example.com"');
    const item = markdownToPdfHtml('- [x]\n\n  [x]: https://first.example\n');
    expect(item).toContain('href="https://first.example"');
    expect(item).not.toContain('checkbox');
    expect(markdownToPdfHtml('- [x] done\n')).toContain('checkbox');
  });

  it('hides a repeated reference definition', () => {
    const html = markdownToPdfHtml(
      'first\n\n[x]: https://first.example\n\n[x]\n\n[x]: https://second.example\n'
    );
    expect(html).toContain('href="https://first.example"');
    expect(html).not.toContain('second.example');
  });

  it('turns a reference into an inline link and drops the definition', () => {
    const expanded = expandLinkReferences(
      'See [the docs][guide].\n\n[guide]: https://example.com\n'
    );
    expect(expanded).toContain('[the docs](https://example.com)');
    expect(expanded).not.toContain('[guide]:');
  });

  it('resolves a shortcut and leaves an inline link and code span alone', () => {
    const expanded = expandLinkReferences(
      'Use [Docs] and [keep](https://keep.example) and `[Docs]`.\n\n[docs]: <https://example.com>\n'
    );
    expect(expanded).toContain('[Docs](https://example.com)');
    expect(
      expandLinkReferences('See [the docs][].\n\n[the docs]: https://example.com\n')
    ).toContain('[the docs](https://example.com)');
    expect(expanded).toContain('[keep](https://keep.example)');
    expect(expanded).toContain('`[Docs]`');
  });

  it('leaves a link inside a tilde fence alone', () => {
    const expanded = expandLinkReferences('~~~\n[guide]: https://example.com\n~~~\n\n[guide]\n');
    expect(expanded).toContain('[guide]: https://example.com');
    expect(expanded).not.toContain('[guide](https://example.com)');
  });

  it('reads an indented definition whose address is on the next line', () => {
    const expanded = expandLinkReferences('See [docs].\n\n   [docs]:\n   https://example.com\n');
    expect(expanded).toContain('[docs](https://example.com)');
    expect(expanded).not.toContain('[docs]:');
    const coded = expandLinkReferences('See [docs].\n\n    [docs]:\n    https://example.com\n');
    expect(coded).not.toContain('[docs](https://example.com)');
  });

  it('reads an address written on the following line', () => {
    const expanded = expandLinkReferences('See [docs].\n\n[docs]:\nhttps://example.com\n');
    expect(expanded).toContain('[docs](https://example.com)');
    expect(expanded.replace('[docs](https://example.com)', '')).not.toContain(
      'https://example.com'
    );
    const titled = expandLinkReferences('See [docs].\n\n[docs]:\n/url\n"Guide"\n');
    expect(titled).toContain('[docs](/url "Guide")');
    expect(titled).not.toContain('\n"Guide"');
  });

  it('keeps a title written beside the address', () => {
    const expanded = expandLinkReferences('See [docs].\n\n[docs]: https://example.com "Guide"\n');
    expect(expanded).toContain('[docs](https://example.com "Guide")');
    expect(expanded).not.toContain('[docs]:');
    const single = expandLinkReferences("See [docs].\n\n[docs]: https://example.com 'Guide'\n");
    expect(single).toContain("[docs](https://example.com 'Guide')");
    const paren = expandLinkReferences('See [docs].\n\n[docs]: https://example.com (Guide)\n');
    expect(paren).toContain('[docs](https://example.com (Guide))');
    const kept = expandLinkReferences(
      'See [docs].\n\n[docs]: https://example.com "Guide"\n"Stay"\n'
    );
    expect(kept).toContain('"Stay"');
    expect(expandLinkReferences('![A photo][pic]\n\n[pic]: photo.jpg "Sunset"\n')).toContain(
      '![A photo](photo.jpg "Sunset")'
    );
  });

  it('keeps a title written on the following line', () => {
    const expanded = expandLinkReferences(
      'See [docs][guide].\n\n[guide]: https://example.com\n"Guide"\n'
    );
    expect(expanded).toContain('[docs](https://example.com "Guide")');
    expect(expanded).not.toContain('\n"Guide"');
    const quoted = expandLinkReferences('> [foo]: /url\n> "Title"\n>\n> [foo]\n');
    expect(quoted).toContain('[foo](/url "Title")');
    expect(quoted).not.toContain('"Title"\n');
  });

  it('resolves a reference defined inside a quote', () => {
    const expanded = expandLinkReferences('> [foo]: /url\n>\n> [foo]\n');
    expect(expanded).toContain('[foo](/url)');
    expect(expanded).not.toContain('[foo]:');
  });

  it('turns a footnote into a numbered note', () => {
    const expanded = plainFootnoteMarkers(expandLinkReferences('A footnote[^1].\n\n[^1]: Note\n'));
    expect(expanded).toContain('footnote¹.');
    expect(expanded).toContain('1. Note');
    expect(expanded).not.toContain('[^1]');
  });

  it('expands a reference when a formula closer sits inside a link', () => {
    const source =
      'See \\(prefix [Docs] and [a \\)](https://example.com) tail\n\n[Docs]: https://docs.example.com/guide\n';
    const expanded = expandLinkReferences(source);
    expect(expanded).toContain('[Docs](https://docs.example.com/guide)');
    expect(expanded).toContain('[a \\)](https://example.com)');
    const html = markdownToPdfHtml(source);
    expect(html).toContain('href="https://docs.example.com/guide"');
    expect(html).toContain('href="https://example.com"');
    const image = expandImageReferences(
      'Look \\(prefix ![shot][pic] and [a \\)](https://example.com)\n\n[pic]: ./pixel.png\n'
    );
    expect(image).toContain('![shot](./pixel.png)');
    const inside = expandLinkReferences(
      'See \\(x [Docs] y\\) then [Guide].\n\n[Docs]: https://docs.example.com/inside\n[Guide]: https://docs.example.com/guide\n'
    );
    expect(inside).toContain('\\(x [Docs] y\\)');
    expect(inside).toContain('[Guide](https://docs.example.com/guide)');
    expect(inside).not.toContain('[Docs](https://docs.example.com/inside)');
  });

  it('keeps a bracket that belongs to an inline address', () => {
    const expanded = expandLinkReferences(
      'See [search](https://example.com/?q[id]=1).\n\n[id]: https://example.com/docs\n'
    );
    expect(expanded).toContain('[search](https://example.com/?q[id]=1)');
    expect(expanded).not.toContain('q[id](https://example.com/docs)');
    const titled = expandLinkReferences(
      '[text](https://example.com "see [id]")\n\n[id]: https://example.com/docs\n'
    );
    expect(titled).toContain('"see [id]"');
    expect(titled).not.toContain('[id](https://example.com/docs)');
    const math = expandLinkReferences('See $[id]$.\n\n[id]: https://example.com/docs\n');
    expect(math).toContain('$[id]$');
    expect(math).not.toContain('$[id](https://example.com/docs)$');
    const image = expandLinkReferences(
      '![shot](https://example.com/?q[id]=1)\n\n[id]: https://example.com/docs\n'
    );
    expect(image).toContain('![shot](https://example.com/?q[id]=1)');
    expect(image).not.toContain('q[id](https://example.com/docs)');
  });

  it('drops a reference address that an export cannot open', () => {
    const script = omitLocalMarkdownTargets('See [a][id].\n\n[id]: javascript:alert(1)\n');
    expect(script).not.toContain('javascript');
    const file = omitLocalMarkdownTargets('See [a][id].\n\n[id]: file:///etc/passwd\n');
    expect(file).not.toContain('file:');
    expect(file).not.toContain('/etc/passwd');
    const root = omitLocalMarkdownTargets('See [a][id].\n\n[id]: /etc/passwd\n');
    expect(root).not.toContain('/etc/passwd');
    const angled = omitLocalMarkdownTargets('See [a][id].\n\n[id]: <javascript:alert(1)>\n');
    expect(angled).not.toContain('javascript');
    const kept = omitLocalMarkdownTargets(
      'See [docs][id].\n\n[id]: https://example.com "Guide"\n\nSee [up][rel].\n\n[rel]: ../notes.md\n'
    );
    expect(kept).toContain('https://example.com "Guide"');
    expect(kept).toContain('../notes.md');
  });

  it('resolves an image reference and leaves a fenced definition alone', () => {
    expect(expandLinkReferences('![A photo][pic]\n\n[pic]: photo.jpg\n')).toContain(
      '![A photo](photo.jpg)'
    );
    const fenced = expandLinkReferences('```\n[guide]: https://example.com\n```\n');
    expect(fenced).toContain('[guide]: https://example.com');
  });
});
