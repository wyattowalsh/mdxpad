import { describe, expect, it } from 'vitest';

import { documentIdForPath } from './document-id';

const FILE_ID = '11111111-1111-4111-8111-111111111111';

describe('documentIdForPath', () => {
  it('keeps a uuid and does not use the path as the id', () => {
    const first = documentIdForPath('/docs/note.mdx', FILE_ID);
    const again = documentIdForPath('/docs/note.mdx', '/docs/note.mdx');
    const other = documentIdForPath('/docs/other.mdx', '/docs/other.mdx');

    expect(first).toBe(FILE_ID);
    expect(again).toBe(FILE_ID);
    expect(other).not.toBe('/docs/other.mdx');
    expect(other).toMatch(/^[0-9a-f-]{36}$/i);
    expect(other).not.toBe(first);
  });
});
