import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CommandContext } from '@shared/types/commands';
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
});
