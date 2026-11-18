import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';
import { useStatusMessageStore } from '@renderer/stores/status-message-store';

const openFirstExistingFile = vi.fn();

vi.mock('@renderer/lib/open-file-from-path', () => ({
  importPathCandidates: (resolved: string) => [resolved],
  openFirstExistingFile: (...args: unknown[]) => openFirstExistingFile(...args),
}));

import { openImportSpecifier } from './open-import';

describe('openImportSpecifier', () => {
  beforeEach(() => {
    openFirstExistingFile.mockReset();
    useDocumentStore.getState().reset();
    useStatusMessageStore.setState({ message: '' });
    useDocumentStore.setState({ filePath: '/docs/components/Card.mdx' });
  });

  it('opens an import beside the current file', () => {
    openImportSpecifier('./Button');

    expect(openFirstExistingFile).toHaveBeenCalledWith(['/docs/components/Button']);
    expect(useStatusMessageStore.getState().message).toBe('');
  });

  it('does not read an import that leaves the open file folder', () => {
    openImportSpecifier('../secret.md');

    expect(openFirstExistingFile).not.toHaveBeenCalled();
    expect(useStatusMessageStore.getState().message).toBe(
      "That import is outside the open file's folder."
    );
  });
});
