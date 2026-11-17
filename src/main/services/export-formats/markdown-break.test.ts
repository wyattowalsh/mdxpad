import { describe, expect, it } from 'vitest';

import { isThematicBreak } from './markdown-break';

describe('isThematicBreak', () => {
  it('accepts a rule and rejects a normal line', () => {
    expect(isThematicBreak('---')).toBe(true);
    expect(isThematicBreak('* * *')).toBe(true);
    expect(isThematicBreak('___')).toBe(true);
    expect(isThematicBreak('not a rule')).toBe(false);
    expect(isThematicBreak('- item')).toBe(false);
  });
});
