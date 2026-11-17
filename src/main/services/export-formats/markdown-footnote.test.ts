import { describe, expect, it } from 'vitest';

import { applyFootnotes } from './markdown-footnote';
import { expandLinkReferences } from './markdown-reference';

describe('applyFootnotes', () => {
  it('numbers a marker and lists the note', () => {
    const rendered = applyFootnotes('A footnote[^1].\n\n[^1]: Note\n');
    expect(rendered).toContain('footnote¹.');
    expect(rendered).toContain('## Notes');
    expect(rendered).toContain('1. Note');
    expect(rendered).not.toContain('[^1]');
  });

  it('keeps an indented continuation in the note', () => {
    const rendered = applyFootnotes('See[^1].\n\n[^1]: First\n    second\n');
    expect(rendered).toContain('1. First\nsecond');
    expect(rendered).not.toContain('    second');
    const expanded = expandLinkReferences('See[^1].\n\n[^1]: First\n\n    second\n');
    expect(expanded).toContain('1. First\n\nsecond');
    expect(expanded).not.toContain('```');
  });

  it('leaves a marker without a definition, including one in code', () => {
    expect(applyFootnotes('See [^missing] and `[^1]`.\n')).toContain('[^missing]');
    expect(applyFootnotes('See [^missing] and `[^1]`.\n')).toContain('`[^1]`');
  });
});
