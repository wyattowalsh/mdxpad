/**
 * Comment commands for the command palette.
 */

import type { Command, CommandId, CommandResult, CommandContext } from '@shared/types/commands';
import { useCommandRegistry } from '@renderer/stores/command-registry-store';
import { useCommentsStore } from '@renderer/stores/comments-store';
import { useUtilityPanelStore } from '@renderer/stores/utility-panel-store';
import { readWysiwygComment } from '@renderer/lib/editor/wysiwyg-comment';

function openComment(from: number, to: number, quote: string): CommandResult {
  const threadId = useCommentsStore.getState().createThread(from, to, 'You', quote);
  useCommentsStore.getState().setActiveThread(threadId);
  useUtilityPanelStore.getState().setActiveUtilityPanel('comments');
  return { ok: true };
}

function addComment(ctx: CommandContext): CommandResult {
  const visual = ctx.editor ? null : readWysiwygComment();
  const from = ctx.editor?.state.selection.main.from ?? visual?.anchorFrom;
  const to = ctx.editor?.state.selection.main.to ?? visual?.anchorTo;
  const quote = ctx.editor ? ctx.editor.state.sliceDoc(from ?? 0, to ?? 0).trim() : visual?.quote;
  if (from === undefined || to === undefined || from === to || !quote) {
    ctx.notify({
      type: 'warning',
      message: ctx.editor || visual ? 'Select text to comment on' : 'No editor available',
    });
    return {
      ok: false,
      error: ctx.editor || visual ? 'Select text to comment on' : 'No editor available',
    };
  }
  const result = openComment(from, to, quote);
  if (result.ok) {
    ctx.notify({ type: 'info', message: 'Comment added' });
  }
  return result;
}

const addCommentCommand: Command = {
  id: 'edit.add-comment' as CommandId,
  name: 'Add Comment',
  description: 'Comment on the selected text',
  category: 'edit',
  execute: addComment,
};

export function registerCommentCommands(): () => void {
  const { register, unregister } = useCommandRegistry.getState();
  const result = register(addCommentCommand);
  const registered = result.ok ? [addCommentCommand.id] : [];
  return () => {
    for (const id of registered) {
      unregister(id);
    }
  };
}

export { addCommentCommand };
