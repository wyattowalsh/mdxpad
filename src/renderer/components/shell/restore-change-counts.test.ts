import { describe, expect, it } from 'vitest';

import { restoreChangeCounts } from './restore-change-counts';

describe('restoreChangeCounts', () => {
  it('counts lines the restore brings back and lines it removes', () => {
    expect(restoreChangeCounts('keep\nonly now\n', 'keep\nfrom version\n')).toEqual({
      restored: 1,
      removed: 1,
    });
  });
});
