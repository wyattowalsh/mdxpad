import { describe, expect, it } from 'vitest';

import { pathMatchesExclude } from './search-service';

describe('pathMatchesExclude', () => {
  it('matches a named directory segment and a star pattern', () => {
    expect(pathMatchesExclude('/notes', '/notes/dist/readme.md', ['dist'])).toBe(true);
    expect(pathMatchesExclude('/notes', '/notes/drafts/notes.bak', ['*.bak'])).toBe(true);
    expect(pathMatchesExclude('/notes', '/notes/drafts/notes.md', ['dist', '*.bak'])).toBe(false);
  });
});
