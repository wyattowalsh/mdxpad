import { describe, expect, it } from 'vitest';

import { shareTokenFromUrl, shareUrlFromArgv } from './share-url';

const token = 'a'.repeat(32);

describe('shareTokenFromUrl', () => {
  it('reads a share token and ignores other addresses', () => {
    expect(shareTokenFromUrl(`mdxpad://share/${token}`)).toBe(token);
    expect(shareTokenFromUrl(`mdxpad://share/${token}?x=1`)).toBeNull();
    expect(shareTokenFromUrl('mdxpad://share/short')).toBeNull();
    expect(shareTokenFromUrl('file:///etc/passwd')).toBeNull();
    expect(shareTokenFromUrl('mdxpad://share/../../etc/passwd')).toBeNull();
    expect(shareUrlFromArgv(['electron', `mdxpad://share/${token}`])).toBe(
      `mdxpad://share/${token}`
    );
  });
});
