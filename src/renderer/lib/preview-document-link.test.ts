import { describe, expect, it } from 'vitest';

import { resolvePreviewDocumentLink } from './preview-document-link';

describe('resolvePreviewDocumentLink', () => {
  it('resolves a document beside the open file', () => {
    expect(resolvePreviewDocumentLink('/docs/note.md', 'other.md')).toBe('/docs/other.md');
    expect(resolvePreviewDocumentLink('/docs/note.md', './drafts/a.mdx')).toBe(
      '/docs/drafts/a.mdx'
    );
  });

  it('ignores links that leave the folder or are not documents', () => {
    expect(resolvePreviewDocumentLink('/docs/note.md', '../secret.md')).toBeNull();
    expect(resolvePreviewDocumentLink('/docs/note.md', '/etc/passwd.md')).toBeNull();
    expect(resolvePreviewDocumentLink('/docs/note.md', 'https://example.com/a.md')).toBeNull();
    expect(resolvePreviewDocumentLink('/docs/note.md', '#section')).toBeNull();
    expect(resolvePreviewDocumentLink('/docs/note.md', 'image.png')).toBeNull();
    expect(resolvePreviewDocumentLink(null, 'other.md')).toBeNull();
  });
});
