import type { CommandContext } from '@shared/types/commands';

import { readOpenSourceEditor } from '@renderer/components/tabs/live-source-text';
import { useDocumentStore } from '@renderer/stores/document-store';

function sourceEditorText(ctx: CommandContext): string | null {
  return readOpenSourceEditor(ctx.editor);
}

function sameOpenFile(ctx: CommandContext): boolean {
  return useDocumentStore.getState().filePath === ctx.document.filePath;
}

/** The text the editor is showing for this command's saved file. */
export function liveDocumentContent(ctx: CommandContext): string {
  const state = useDocumentStore.getState();
  const typed = sourceEditorText(ctx);
  if (typed !== null && sameOpenFile(ctx)) {
    return typed;
  }
  if (ctx.document.filePath !== null && state.filePath === ctx.document.filePath) {
    return state.content;
  }
  return ctx.document.content;
}

/** The open editor still has the text captured before an async command. */
export function documentStillMatches(ctx: CommandContext, snapshot: string): boolean {
  const state = useDocumentStore.getState();
  if (state.filePath !== ctx.document.filePath) {
    return false;
  }
  const typed = sourceEditorText(ctx);
  if (typed !== null) {
    return typed === snapshot;
  }
  return state.content === snapshot;
}

/** Keystrokes are in the source editor and have not been stored as saved yet. */
export function editorHasUnsavedText(ctx: CommandContext): boolean {
  const typed = sourceEditorText(ctx);
  const state = useDocumentStore.getState();
  if (typed === null || state.filePath !== ctx.document.filePath) {
    return false;
  }
  return typed !== state.savedContent;
}

/**
 * The bytes written are still the open document.
 * A source editor can be ahead of the store, so copy that text in before
 * marking the document saved.
 */
export function syncSavedText(
  savedPath: string | null,
  savedText: string,
  ctx: CommandContext
): boolean {
  const current = useDocumentStore.getState();
  if (current.filePath !== savedPath) {
    return false;
  }
  const typed = sourceEditorText(ctx);
  if (typed !== null && typed !== savedText) {
    return false;
  }
  if (current.content !== savedText) {
    if (typed === null) {
      return false;
    }
    current.setContent(savedText);
  }
  return true;
}
