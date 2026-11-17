/**
 * Comment commands for the command palette.
 */

import type { Command, CommandId, CommandResult, CommandContext } from '@shared/types/commands';
import { useCommandRegistry } from '@renderer/stores/command-registry-store';
import { useCommentsStore } from '@renderer/stores/comments-store';
import { useUtilityPanelStore } from '@renderer/stores/utility-panel-store';

function addComment(ctx: CommandContext): CommandResult {
  if (!ctx.editor) {
    ctx.notify({ type: 'warning', message: 'No editor available' });
    return { ok: false, error: 'No editor available' };
  }
  const { from, to } = ctx.editor.state.selection.main;
  if (from === to) {
    ctx.notify({ type: 'warning', message: 'Select text to comment on' });
    return { ok: false, error: 'Select text to comment on' };
  }
  const quote = ctx.editor.state.sliceDoc(from, to).trim();
  if (quote.length === 0) {
    ctx.notify({ type: 'warning', message: 'Select text to comment on' });
    return { ok: false, error: 'Select text to comment on' };
  }
  const threadId = useCommentsStore.getState().createThread(from, to, 'You', quote);
  useCommentsStore.getState().setActiveThread(threadId);
  useUtilityPanelStore.getState().setActiveUtilityPanel('comments');
  ctx.notify({ type: 'info', message: 'Comment added' });
  return { ok: true };
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
