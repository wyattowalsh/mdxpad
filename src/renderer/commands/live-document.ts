import type { CommandContext } from '@shared/types/commands';

import { useDocumentStore } from '@renderer/stores/document-store';

/** The text the editor is showing for this command's saved file. */
export function liveDocumentContent(ctx: CommandContext): string {
  const state = useDocumentStore.getState();
  if (ctx.document.filePath !== null && state.filePath === ctx.document.filePath) {
    return state.content;
  }
  return ctx.document.content;
}

/** The open editor still has the text captured before an async command. */
export function documentStillMatches(ctx: CommandContext, snapshot: string): boolean {
  const state = useDocumentStore.getState();
  return state.filePath === ctx.document.filePath && state.content === snapshot;
}
