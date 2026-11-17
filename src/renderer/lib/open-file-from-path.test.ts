import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';
import { useStatusMessageStore } from '@renderer/stores/status-message-store';

import { openFileFromPath } from './open-file-from-path';

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
});
