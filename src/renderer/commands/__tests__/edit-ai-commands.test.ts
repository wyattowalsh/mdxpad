import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CommandContext } from '@shared/types/commands';
import type { DocumentId } from '@shared/types/document';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useMultiFileAiStore } from '@renderer/stores/multi-file-ai-store';
import { useUtilityPanelStore } from '@renderer/stores/utility-panel-store';
import { EDIT_AI_COMMANDS } from '../edit-ai-commands';

describe('edit.propose-revision', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useMultiFileAiStore.getState().reset();
    useUtilityPanelStore.setState({ activeUtilityPanel: null });
  });

  it('opens a review of the revision and does not replace the document yet', async () => {
    const generateText = vi.fn().mockResolvedValue({ success: true, text: '```md\nRevised\n```' });
    const notify = vi.fn();
    const context = {
      document: { fileId: null, filePath: null, content: 'Draft', isDirty: false },
      api: { ai: { generateText } },
      notify,
    } as unknown as CommandContext;

    const result = await EDIT_AI_COMMANDS[0]?.execute(context);

    expect(result).toEqual({ ok: true });
    expect(useDocumentStore.getState().content).toBe('');
    expect(useMultiFileAiStore.getState().fileEdits[0]?.modified).toBe('Revised');
    expect(useUtilityPanelStore.getState().activeUtilityPanel).toBe('edits');
  });

  it('revises the editor text when the command snapshot is older', async () => {
    useDocumentStore.getState().openDocument(
      {
        fileId: 'file-1' as DocumentId,
        filePath: '/notes/readme.md',
        mtime: 1,
      },
      'Old'
    );
    useDocumentStore.getState().setContent('Live draft');
    const generateText = vi.fn().mockResolvedValue({ success: true, text: 'Revised' });
    const context = {
      document: {
        fileId: 'file-1',
        filePath: '/notes/readme.md',
        content: 'Old',
        isDirty: true,
      },
      api: { ai: { generateText } },
      notify: vi.fn(),
    } as unknown as CommandContext;

    const result = await EDIT_AI_COMMANDS[0]?.execute(context);

    expect(result).toEqual({ ok: true });
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'Live draft' }));
    expect(useMultiFileAiStore.getState().fileEdits[0]?.original).toBe('Live draft');
  });
});
