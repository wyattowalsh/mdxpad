import { describe, expect, it } from 'vitest';

import { documentWindowTitle } from './document-window-title';

describe('document window title', () => {
  it('names the open file and marks unsaved work', () => {
    expect(documentWindowTitle('notes.md', false)).toBe('notes.md — MDXPad');
    expect(documentWindowTitle('notes.md', true)).toBe('• notes.md — MDXPad');
    expect(documentWindowTitle('   ', false)).toBe('Untitled — MDXPad');
  });
});
