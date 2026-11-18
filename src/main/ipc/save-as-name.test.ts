import { describe, expect, it } from 'vitest';

import { saveAsDefaultPath } from './save-as-name';

describe('saveAsDefaultPath', () => {
  it('keeps an ordinary save named untitled.mdx', () => {
    expect(saveAsDefaultPath()).toBe('untitled.mdx');
    expect(saveAsDefaultPath('   ')).toBe('untitled.mdx');
  });

  it('suggests a recovered name from the original file', () => {
    expect(saveAsDefaultPath('/docs/note.mdx')).toBe('note-recovered.mdx');
    expect(saveAsDefaultPath('../secret/note.md')).toBe('note-recovered.md');
  });

  it('uses an mdx extension when the original name has none', () => {
    expect(saveAsDefaultPath('/docs/note')).toBe('note-recovered.mdx');
  });
});
