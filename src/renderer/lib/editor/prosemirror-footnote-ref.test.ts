import { describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { serializeMdxContent } from './prosemirror-mdx-serializer';

describe('visual footnote reference', () => {
  it('shows a defined marker as a superscript and saves the marker', () => {
    const doc = parseMdxContent('A footnote[^1].\n\n[^1]: The note\n');
    if (!doc) {
      throw new Error('footnote markdown did not parse');
    }
    const ref = doc.firstChild?.child(1);
    expect(ref?.type.name).toBe('footnote_ref');
    expect(ref?.attrs.id).toBe('1');
    const saved = serializeMdxContent(doc);
    expect(saved).toContain('A footnote[^1].');
    expect(saved).toContain('[^1]: The note');
    expect(saved).not.toContain('\\[');
    const note = doc.child(1);
    expect(note.firstChild?.type.name).toBe('footnote_label');
    expect(note.textContent).toBe('The note');
  });

  it('keeps two notes on their own lines and leaves code and missing markers', () => {
    const adjacentDoc = parseMdxContent('See [^a] and [^b].\n\n[^a]: One\n[^b]: Two\n');
    if (!adjacentDoc) {
      throw new Error('footnote markdown did not parse');
    }
    const adjacent = serializeMdxContent(adjacentDoc);
    expect(adjacent).toContain('[^a]: One');
    expect(adjacent).toContain('[^b]: Two');
    expect(adjacent).not.toContain('    [^b]:');
    const coded = parseMdxContent('See `[^1]` and [^missing].\n\n[^1]: Note\n');
    expect(coded?.textContent).toContain('[^1]');
    expect(coded?.textContent).toContain('[^missing]');
  });
});
