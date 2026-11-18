import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentId } from '@shared/types/document';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useStatusMessageStore } from '@renderer/stores/status-message-store';

import {
  importPathCandidates,
  openFileFromPath,
  openFirstExistingFile,
} from './open-file-from-path';

describe('openFileFromPath', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useStatusMessageStore.setState({ message: '' });
    vi.stubGlobal('mdxpad', {
      readFile: vi.fn(),
    });
  });

  it('opens a file the app can read', async () => {
    vi.mocked(window.mdxpad.readFile).mockResolvedValue({ ok: true, value: '# Note' });

    await openFileFromPath('/docs/note.mdx');

    expect(useDocumentStore.getState().content).toBe('# Note');
    expect(useDocumentStore.getState().filePath).toBe('/docs/note.mdx');
    expect(useDocumentStore.getState().fileId).not.toBe('/docs/note.mdx');
    expect(useDocumentStore.getState().fileId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(useStatusMessageStore.getState().message).toBe('');
  });

  it('says when a file is outside the opened folder', async () => {
    vi.mocked(window.mdxpad.readFile).mockResolvedValue({
      ok: false,
      error: { code: 'PERMISSION_DENIED', path: '/secret.md' },
    });

    await openFileFromPath('/secret.md');

    expect(useDocumentStore.getState().filePath).toBeNull();
    expect(useStatusMessageStore.getState().message).toBe(
      'Open this file from the file dialog before reading it'
    );
  });

  it('tries a source extension when the import has none', async () => {
    expect(importPathCandidates('/docs/Button')).toContain('/docs/Button.mdx');
    expect(importPathCandidates('/docs/Button')).toContain('/docs/Button/index.mdx');
    expect(importPathCandidates('/docs/note.md')).toEqual(['/docs/note.md']);

    vi.mocked(window.mdxpad.readFile).mockImplementation(async (filePath: string) => {
      if (filePath === '/docs/Button.mdx') {
        return { ok: true, value: 'export const Button = 1;' };
      }
      return { ok: false, error: { code: 'NOT_FOUND', path: filePath } };
    });

    await openFirstExistingFile(importPathCandidates('/docs/Button'));

    expect(useDocumentStore.getState().filePath).toBe('/docs/Button.mdx');
    expect(useStatusMessageStore.getState().message).toBe('');
  });

  it('opens another file without asking about unsaved edits', async () => {
    useDocumentStore.getState().openDocument(
      { fileId: 'a' as DocumentId, filePath: '/docs/a.mdx', mtime: 1 },
      'saved'
    );
    useDocumentStore.getState().setContent('edited');
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    vi.mocked(window.mdxpad.readFile).mockResolvedValue({ ok: true, value: '# Other' });

    await openFileFromPath('/docs/b.mdx');

    expect(confirm).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().filePath).toBe('/docs/b.mdx');
    expect(useDocumentStore.getState().content).toBe('# Other');
  });

  it('does not reload the open file over unsaved edits', async () => {
    useDocumentStore.getState().openDocument(
      { fileId: 'a' as DocumentId, filePath: '/docs/a.mdx', mtime: 1 },
      'saved'
    );
    useDocumentStore.getState().setContent('edited');
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);

    await openFileFromPath('/docs/a.mdx');

    expect(confirm).not.toHaveBeenCalled();
    expect(window.mdxpad.readFile).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().content).toBe('edited');
  });

  it('does not show an open error after another file is already open', async () => {
    let finishRead: (value: { ok: false; error: { code: 'NOT_FOUND'; path: string } }) => void =
      () => undefined;
    vi.mocked(window.mdxpad.readFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRead = resolve;
        })
    );

    const pending = openFileFromPath('/docs/missing.mdx');
    useDocumentStore.getState().openDocument(
      { fileId: 'b' as DocumentId, filePath: '/docs/b.mdx', mtime: 1 },
      'kept'
    );
    finishRead({ ok: false, error: { code: 'NOT_FOUND', path: '/docs/missing.mdx' } });
    await pending;

    expect(useDocumentStore.getState().filePath).toBe('/docs/b.mdx');
    expect(useDocumentStore.getState().content).toBe('kept');
    expect(useStatusMessageStore.getState().message).toBe('');
  });
});
