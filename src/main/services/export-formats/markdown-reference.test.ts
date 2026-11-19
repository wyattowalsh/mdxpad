import { describe, expect, it } from 'vitest';

import { prepareMarkdownSource } from '@shared/lib/markdown-math';

import { renderMarkdownInline } from './markdown-inline-html';
import { plainFootnoteMarkers } from './markdown-footnote';
import { expandLinkReferences } from './markdown-reference';

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

  it('resolves an image reference and leaves a fenced definition alone', () => {
    expect(expandLinkReferences('![A photo][pic]\n\n[pic]: photo.jpg\n')).toContain(
      '![A photo](photo.jpg)'
    );
    const fenced = expandLinkReferences('```\n[guide]: https://example.com\n```\n');
    expect(fenced).toContain('[guide]: https://example.com');
  });
});
