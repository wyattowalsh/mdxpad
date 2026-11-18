import { describe, expect, it } from 'vitest';

import { documentFromMarkdown } from './wysiwyg-document';
import { sourceCursorAt } from './wysiwyg-cursor';

function textPos(source: string, text: string, offset: number): number {
  const doc = documentFromMarkdown(source);
  let found = 0;
  doc.descendants((node, pos) => {
    if (node.isText && node.text === text) {
      found = pos + offset;
    }
  });
  return found;
}

describe('visual source cursor', () => {
  it('starts a paragraph at line 1 column 1', () => {
    const doc = documentFromMarkdown('Hello');
    expect(sourceCursorAt(doc, textPos('Hello', 'Hello', 0))).toEqual({ line: 1, column: 1 });
  });

  it('counts characters inside the paragraph', () => {
    const doc = documentFromMarkdown('Hello');
    expect(sourceCursorAt(doc, textPos('Hello', 'Hello', 2))).toEqual({ line: 1, column: 3 });
  });

  it('counts the blank line between paragraphs', () => {
    const doc = documentFromMarkdown('Hello\n\nWorld');
    expect(sourceCursorAt(doc, textPos('Hello\n\nWorld', 'World', 0))).toEqual({
      line: 3,
      column: 1,
    });
  });

  it('counts the list marker in front of the item', () => {
    const doc = documentFromMarkdown('- Hello');
    expect(sourceCursorAt(doc, textPos('- Hello', 'Hello', 0))).toEqual({ line: 1, column: 3 });
  });

  it('counts emphasis markers around a word', () => {
    const doc = documentFromMarkdown('**Hi**');
    expect(sourceCursorAt(doc, textPos('**Hi**', 'Hi', 0))).toEqual({ line: 1, column: 3 });
  });

  it('counts the heading marker in front of the title', () => {
    const doc = documentFromMarkdown('# Title');
    expect(sourceCursorAt(doc, textPos('# Title', 'Title', 0))).toEqual({ line: 1, column: 3 });
  });
});
