import { describe, expect, it } from 'vitest';

import { sourcePosition } from '../../components/comments/comment-position';
import { parseMdxContent } from './prosemirror-mdx-parser';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { wysiwygCommentAnchor } from './wysiwyg-comment';

function range(source: string, text: string): { from: number; to: number } {
  const doc = parseMdxContent(source);
  if (!doc) {
    throw new Error('markdown did not parse');
  }
  let from = -1;
  let to = -1;
  doc.descendants((node, pos) => {
    if (from === -1 && node.isText && node.text === text) {
      from = pos;
      to = pos + node.nodeSize;
    }
  });
  if (from === -1) {
    throw new Error(`missing text ${text}`);
  }
  return { from, to };
}

describe('wysiwygCommentAnchor', () => {
  it('anchors a later paragraph on its own line', () => {
    const source = 'Hello\n\nGoodbye\n';
    const doc = parseMdxContent(source);
    if (!doc) {
      throw new Error('markdown did not parse');
    }
    const { from, to } = range(source, 'Goodbye');
    const anchor = wysiwygCommentAnchor(doc, from, to);
    expect(anchor?.quote).toBe('Goodbye');
    const content = serializeMdxContent(doc);
    expect(sourcePosition(content, anchor?.anchorFrom ?? 0).line).toBeGreaterThan(1);
  });

  it('anchors emphasized words on the line where they appear', () => {
    const source = 'Hello **bold** world\n';
    const doc = parseMdxContent(source);
    if (!doc) {
      throw new Error('markdown did not parse');
    }
    const { from, to } = range(source, 'bold');
    const anchor = wysiwygCommentAnchor(doc, from, to);
    expect(anchor?.quote).toBe('bold');
    expect(sourcePosition(serializeMdxContent(doc), anchor?.anchorFrom ?? 0).line).toBe(1);
  });
});
