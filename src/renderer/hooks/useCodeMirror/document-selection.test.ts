import { describe, expect, it } from 'vitest';

import { selectionAfterDocumentUpdate } from './document-selection';

describe('selectionAfterDocumentUpdate', () => {
  it('keeps the caret inside an edited document', () => {
    expect(selectionAfterDocumentUpdate({ anchor: 4, head: 8 }, 20, 'preserve')).toEqual({
      anchor: 4,
      head: 8,
    });
    expect(selectionAfterDocumentUpdate({ anchor: 40, head: 40 }, 10, 'preserve')).toEqual({
      anchor: 10,
      head: 10,
    });
  });

  it('starts a newly opened document at the beginning', () => {
    expect(selectionAfterDocumentUpdate({ anchor: 40, head: 40 }, 10, 'start')).toEqual({
      anchor: 0,
      head: 0,
    });
  });
});
