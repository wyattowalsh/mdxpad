import { describe, expect, it } from 'vitest';

import { joinRelativePath, resolveInsideDirectory } from './resolve-beside-file';

describe('resolve beside an open file', () => {
  it('joins a relative document inside the folder', () => {
    expect(resolveInsideDirectory('/docs', 'other.md')).toBe('/docs/other.md');
    expect(resolveInsideDirectory('/docs', './drafts/a.mdx')).toBe('/docs/drafts/a.mdx');
  });

  it('rejects a link that leaves the folder', () => {
    expect(resolveInsideDirectory('/docs', '../secret.md')).toBeNull();
    expect(resolveInsideDirectory('/docs', '/etc/passwd.md')).toBeNull();
    expect(resolveInsideDirectory('/docs', 'drafts/../../secret.md')).toBeNull();
  });

  it('resolves an import that steps up to a sibling file', () => {
    expect(joinRelativePath('/docs/components', '../lib/button.md')).toBe('/docs/lib/button.md');
  });
});
