import { describe, expect, it } from 'vitest';

import { applyFootnotes, htmlFootnoteMarkers, plainFootnoteMarkers } from './markdown-footnote';
import { expandLinkReferences } from './markdown-reference';

describe('applyFootnotes', () => {
  it('numbers a marker and lists the note', () => {
    const rendered = plainFootnoteMarkers(applyFootnotes('A footnote[^1].\n\n[^1]: Note\n'));
    expect(rendered).toContain('footnote¹.');
    const linked = htmlFootnoteMarkers(applyFootnotes('A footnote[^1].\n\n[^1]: Note\n'));
    expect(linked).toContain('<sup><a href="#fn-1" id="fnref-1">1</a></sup>');
    expect(linked).toContain('<span id="fn-1"></span>');
    expect(rendered).toContain('## Notes');
    expect(rendered).toContain('1. Note');
    expect(rendered).not.toContain('[^1]');
  });

  it('keeps a table and a quote inside a note', () => {
    const table = applyFootnotes('A[^1].\n\n[^1]: | A | B |\n    | --- | --- |\n    | 1 | 2 |\n');
    expect(table).toContain('| A | B |');
    expect(table).toContain('| --- | --- |');
    expect(table).not.toContain('1. |');
    const quote = applyFootnotes('A[^1].\n\n[^1]: > hello\n    > world\n');
    expect(quote).toContain('> hello');
    expect(quote).toContain('> world');
    expect(quote).not.toContain('1. >');
  });

  it('keeps a fenced block inside a note', () => {
    const rendered = applyFootnotes('A[^1].\n\n[^1]: ```js\n    const x = 1\n    ```\n');
    expect(rendered).toContain('```js');
    expect(rendered).toContain('const x = 1');
    expect(rendered).not.toContain('1. ```');
  });

  it('keeps an indented continuation in the note', () => {
    const rendered = plainFootnoteMarkers(applyFootnotes('See[^1].\n\n[^1]: First\n    second\n'));
    expect(rendered).toContain('1. First\n    second');
    const expanded = expandLinkReferences('See[^1].\n\n[^1]: First\n\n    second\n');
    expect(expanded).toContain('1. First\n\n    second');
    expect(expanded).not.toContain('```');
  });

  it('leaves markers in code and escaped markers, and numbers a note inside a note', () => {
    const fenced = applyFootnotes('```\n[^1]\n```\n\n[^1]: Note\n');
    expect(fenced).toContain('```\n[^1]\n```');
    expect(fenced).toContain('1. Note');
    const escaped = plainFootnoteMarkers(applyFootnotes('See \\[^1].\n\n[^1]: Note\n'));
    expect(escaped).toContain('\\[^1]');
    expect(escaped).not.toContain('\\¹');
    const nested = plainFootnoteMarkers(
      applyFootnotes('See[^1].\n\n[^1]: Also[^2].\n\n[^2]: Inner\n')
    );
    expect(nested).toContain('Also².');
    expect(nested).toContain('2. Inner');
  });

  it('leaves a marker without a definition, including one in code', () => {
    expect(applyFootnotes('See [^missing] and `[^1]`.\n')).toContain('[^missing]');
    expect(applyFootnotes('See [^missing] and `[^1]`.\n')).toContain('`[^1]`');
  });
});
