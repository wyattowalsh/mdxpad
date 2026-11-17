import { beforeEach, describe, expect, it, vi } from 'vitest';

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
});
