import { describe, expect, it } from 'vitest';

import { setextLevel } from './markdown-setext';

describe('setextLevel', () => {
  it('reads an underline and rejects a normal line', () => {
    expect(setextLevel('===')).toBe(1);
    expect(setextLevel('---')).toBe(2);
    expect(setextLevel('Title')).toBeNull();
    expect(setextLevel('    ===')).toBeNull();
  });
});
