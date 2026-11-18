import { describe, expect, it } from 'vitest';

import { plainFootnoteMarkers } from './markdown-footnote';
import { expandLinkReferences } from './markdown-reference';

describe('expandLinkReferences', () => {
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
    const expanded = plainFootnoteMarkers(
      expandLinkReferences('A footnote[^1].\n\n[^1]: Note\n')
    );
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
