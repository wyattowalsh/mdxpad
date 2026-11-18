import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandContext } from '@shared/types/commands';
import type { EditorView } from '@codemirror/view';

import { useCommentsStore } from '@renderer/stores/comments-store';
import { useUtilityPanelStore } from '@renderer/stores/utility-panel-store';

import { registerWysiwygComment } from '@renderer/lib/editor/wysiwyg-comment';

import { addCommentCommand } from './comment-commands';

function context(from: number, to: number, text: string): CommandContext {
  return {
    editor: {
      state: {
        selection: { main: { from, to } },
        sliceDoc: () => text,
      },
    } as unknown as EditorView,
    document: { fileId: null, filePath: '/tmp/note.md', content: text, isDirty: false },
    ui: { previewVisible: true, sidebarVisible: true, zoomLevel: 100 },
    platform: { isMac: true, isWindows: false, isLinux: false },
    api: {} as CommandContext['api'],
    notify: vi.fn(),
  };
}

describe('addCommentCommand', () => {
  beforeEach(() => {
    useCommentsStore.getState().reset();
    useUtilityPanelStore.setState({ activeUtilityPanel: null });
    registerWysiwygComment(null);
  });

  it('creates a thread from the selection and opens the panel', () => {
    const result = addCommentCommand.execute(context(0, 5, 'Hello'));
    expect(result).toEqual({ ok: true });
    expect(useCommentsStore.getState().threads).toHaveLength(1);
    expect(useCommentsStore.getState().threads[0]?.messages[0]?.content).toBe('Hello');
    expect(useUtilityPanelStore.getState().activeUtilityPanel).toBe('comments');
  });

  it('creates a thread from the visual editor selection', () => {
    registerWysiwygComment(() => ({ anchorFrom: 6, anchorTo: 13, quote: 'Goodbye' }));
    const ctx = { ...context(0, 0, ''), editor: null };
    const result = addCommentCommand.execute(ctx);
    expect(result).toEqual({ ok: true });
    expect(useCommentsStore.getState().threads[0]?.messages[0]?.content).toBe('Goodbye');
    expect(useCommentsStore.getState().threads[0]?.anchorFrom).toBe(6);
  });

  it('asks for a selection when the cursor is collapsed', () => {
    const ctx = context(2, 2, '');
    const result = addCommentCommand.execute(ctx);
    expect(result).toEqual({ ok: false, error: 'Select text to comment on' });
    expect(ctx.notify).toHaveBeenCalledWith({
      type: 'warning',
      message: 'Select text to comment on',
    });
  });
});
