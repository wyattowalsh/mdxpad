import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';
import { registerLiveSourceText } from '@renderer/components/tabs/live-source-text';
import {
  acceptDocumentEdit,
  applyOpenDocumentEdit,
  openDocumentEditPath,
  unwrapDocumentRevision,
} from './apply-open-document-edit';

describe('open document edits', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useTabStore.getState().reset();
    registerLiveSourceText(null);
    Reflect.deleteProperty(window, 'mdxpad');
  });

  it('unwraps a fenced revision', () => {
    expect(unwrapDocumentRevision('```md\n# Title\n```')).toBe('# Title');
  });

  it('replaces the open document and leaves a different path unchanged', () => {
    useDocumentStore.getState().setContent('old');
    expect(applyOpenDocumentEdit(openDocumentEditPath(null), 'new')).toBe(true);
    expect(useDocumentStore.getState().content).toBe('new');
    expect(applyOpenDocumentEdit('/other.mdx', 'nope')).toBe(false);
    expect(useDocumentStore.getState().content).toBe('new');
  });

  it('writes an accepted edit into a file open in another tab', () => {
    useDocumentStore.setState({ content: 'open', filePath: '/notes/open.md' });
    const activeId = useTabStore.getState().addTab({
      filePath: '/notes/open.md',
      fileName: 'open.md',
      isDirty: false,
      content: 'open',
      savedContent: 'open',
    });
    useTabStore.getState().addTab({
      filePath: '/notes/other.md',
      fileName: 'other.md',
      isDirty: false,
      content: 'old',
      savedContent: 'old',
    });
    useTabStore.getState().setActiveTab(activeId);

    expect(applyOpenDocumentEdit('/notes/other.md', 'revised')).toBe(true);

    expect(useDocumentStore.getState().content).toBe('open');
    const other = useTabStore.getState().tabs.find((tab) => tab.filePath === '/notes/other.md');
    expect(other?.content).toBe('revised');
    expect(other?.isDirty).toBe(true);
  });

  it('does not replace an open file that changed after the edit was proposed', async () => {
    useDocumentStore.setState({ content: 'newer', filePath: null });

    await expect(acceptDocumentEdit(openDocumentEditPath(null), 'revised', 'old')).resolves.toBe(
      'This file changed before the edit was accepted.'
    );

    expect(useDocumentStore.getState().content).toBe('newer');
  });

  it('does not replace keystrokes that are still only in the editor', () => {
    useDocumentStore.setState({ content: 'Hello', filePath: null });
    registerLiveSourceText(() => 'Hello!');

    expect(applyOpenDocumentEdit(openDocumentEditPath(null), 'revised', 'Hello')).toBe(false);

    expect(useDocumentStore.getState().content).toBe('Hello');
  });

  it('writes a closed file when that file can already be saved', async () => {
    const writeFile = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    Object.defineProperty(window, 'mdxpad', { configurable: true, value: { writeFile } });

    await expect(acceptDocumentEdit('/notes/closed.md', 'revised')).resolves.toBeNull();

    expect(writeFile).toHaveBeenCalledWith('/notes/closed.md', 'revised');
  });

  it('asks to open a closed file that cannot be saved', async () => {
    Object.defineProperty(window, 'mdxpad', {
      configurable: true,
      value: {
        writeFile: vi.fn().mockResolvedValue({
          ok: false,
          error: { code: 'PERMISSION_DENIED', path: '/notes/closed.md' },
        }),
      },
    });

    await expect(acceptDocumentEdit('/notes/closed.md', 'revised')).resolves.toBe(
      'Open closed.md before accepting this edit.'
    );
  });
});
