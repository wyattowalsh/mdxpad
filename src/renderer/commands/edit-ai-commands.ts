/**
 * Commands that propose a revision of the open document for review.
 */

import type { Command, CommandContext, CommandId, CommandResult } from '@shared/types/commands';
import { liveDocumentContent } from './live-document';
import {
  MAX_REVISION_CHARS,
  openDocumentEditPath,
  unwrapDocumentRevision,
} from '@renderer/lib/apply-open-document-edit';
import { isFeatureEnabled } from '@renderer/stores/feature-flags-store';
import { useCommandRegistry } from '@renderer/stores/command-registry-store';
import { useMultiFileAiStore } from '@renderer/stores/multi-file-ai-store';
import { useUtilityPanelStore } from '@renderer/stores/utility-panel-store';

async function proposeRevision(ctx: CommandContext): Promise<CommandResult> {
  const content = liveDocumentContent(ctx);
  if (content.trim().length === 0) {
    ctx.notify({ type: 'warning', message: 'The document is empty' });
    return { ok: false, error: 'The document is empty' };
  }
  if (content.length > MAX_REVISION_CHARS) {
    ctx.notify({ type: 'warning', message: 'The document is too long to revise in one pass' });
    return { ok: false, error: 'Document is too long' };
  }

  const response = await ctx.api.ai.generateText({
    prompt: content,
    systemPrompt: 'Revise the markdown document for clarity. Return only the revised document.',
    temperature: 0.2,
  });
  if (!response.success || response.text === undefined || response.text.trim().length === 0) {
    const message = response.error?.message ?? 'Revision failed';
    ctx.notify({ type: 'error', message });
    return { ok: false, error: message };
  }

  const modified = unwrapDocumentRevision(response.text);
  useMultiFileAiStore
    .getState()
    .startMultiFileEdit('document-revision', [
      { path: openDocumentEditPath(ctx.document.filePath), original: content, modified },
    ]);
  useUtilityPanelStore.getState().setActiveUtilityPanel('edits');
  ctx.notify({ type: 'info', message: 'Review the proposed revision before applying it' });
  return { ok: true };
}

export const EDIT_AI_COMMANDS: readonly Command[] = [
  {
    id: 'edit.propose-revision' as CommandId,
    name: 'Propose Document Revision',
    description: 'Ask AI for a revision of the open document and review it before applying',
    category: 'edit',
    enabled: () => isFeatureEnabled('ai'),
    execute: proposeRevision,
  },
];

export function registerEditAiCommands(): () => void {
  const { register, unregister } = useCommandRegistry.getState();
  const registeredIds: CommandId[] = [];
  for (const command of EDIT_AI_COMMANDS) {
    const result = register(command);
    if (result.ok) {
      registeredIds.push(command.id);
    }
  }
  return () => {
    for (const id of registeredIds) {
      unregister(id);
    }
  };
}
