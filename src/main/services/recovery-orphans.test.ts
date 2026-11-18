import { describe, expect, it } from 'vitest';

import { orphanRecoveryIds } from './recovery-orphans';

describe('orphanRecoveryIds', () => {
  it('returns recovery files the manifest does not list', () => {
    const known = '123e4567-e89b-12d3-a456-426614174001';
    const orphan = '123e4567-e89b-12d3-a456-426614174002';

    expect(
      orphanRecoveryIds(
        [`${known}.json`, `${orphan}.json`, 'manifest.json', 'note.tmp', 'not-a-uuid.json'],
        new Set([known])
      )
    ).toEqual([orphan]);
  });
});
