import { describe, expect, it } from 'vitest';

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

  it('leaves a footnote marker and its definition alone', () => {
    const expanded = expandLinkReferences('A footnote[^1].\n\n[^1]: Note\n');
    expect(expanded).toContain('footnote[^1].');
    expect(expanded).toContain('[^1]: Note');
    expect(expanded).not.toContain('[^1](Note)');
  });

  it('resolves an image reference and leaves a fenced definition alone', () => {
    expect(expandLinkReferences('![A photo][pic]\n\n[pic]: photo.jpg\n')).toContain(
      '![A photo](photo.jpg)'
    );
    const fenced = expandLinkReferences('```\n[guide]: https://example.com\n```\n');
    expect(fenced).toContain('[guide]: https://example.com');
  });
});
