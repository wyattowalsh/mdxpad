import { describe, expect, it } from 'vitest';

import { commentRangesForDecorations, type CommentRange } from './comment-decorations';

function range(from: number, to: number, threadId = `${from}-${to}`): CommentRange {
  return { threadId, from, to, resolved: false };
}

describe('commentRangesForDecorations', () => {
  it('keeps separate comments and trims an overlap', () => {
    expect(commentRangesForDecorations([range(0, 5), range(3, 8), range(10, 12)], 20)).toEqual([
      range(0, 5),
      range(5, 8, '3-8'),
      range(10, 12),
    ]);
  });

  it('drops a comment that is covered or outside the document', () => {
    expect(commentRangesForDecorations([range(0, 4), range(1, 3), range(18, 24)], 20)).toEqual([
      range(0, 4),
    ]);
  });
});
