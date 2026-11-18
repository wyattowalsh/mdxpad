import type { Command, CommandContext, CommandId, CommandResult } from '@shared/types/commands';
import { useDocumentStore } from '@renderer/stores/document-store';

import { documentStillMatches, liveDocumentContent } from './live-document';

interface ImportedDocument {
  readonly content: string;
  readonly warnings: readonly string[];
}

type ImportResult =
  | { readonly ok: true; readonly value: ImportedDocument }
  | { readonly ok: false; readonly error: { readonly message: string } };

function promptValue(label: string): string | null {
  const value = window.prompt(label)?.trim() ?? '';
  return value.length === 0 ? null : value;
}

function applyImportedDocument(
  ctx: CommandContext,
  snapshot: string,
  imported: ImportedDocument,
  label: string
): CommandResult {
  if (!documentStillMatches(ctx, snapshot)) {
    ctx.notify({
      type: 'warning',
      message: 'The document changed during import. It was not replaced.',
    });
    return { ok: false, error: 'Document changed during import' };
  }
  useDocumentStore.getState().setContent(imported.content);
  const warningCount = imported.warnings.length;
  const warningText =
    warningCount === 0 ? '' : ` ${warningCount} warning${warningCount === 1 ? '' : 's'}.`;
  ctx.notify({
    type: 'success',
    message: `Imported ${label} (${imported.content.length} characters).${warningText}`,
  });
  return { ok: true };
}

async function runImport(
  ctx: CommandContext,
  label: string,
  load: (source: string) => Promise<ImportResult>,
  requireContent: boolean
): Promise<CommandResult> {
  const snapshot = liveDocumentContent(ctx);
  if (requireContent && snapshot.trim().length === 0) {
    ctx.notify({ type: 'warning', message: 'The document is empty' });
    return { ok: false, error: 'The document is empty' };
  }
  const result = await load(snapshot);
  if (!result.ok) {
    ctx.notify({ type: 'error', message: result.error.message });
    return { ok: false, error: result.error.message };
  }
  return applyImportedDocument(ctx, snapshot, result.value, label);
}

function unavailableImport(ctx: CommandContext): CommandResult {
  ctx.notify({ type: 'warning', message: 'Import is not available' });
  return { ok: false, error: 'Import is not available' };
}

const importHtmlCommand: Command = {
  id: 'import.html' as CommandId,
  name: 'Import HTML from Document',
  description: 'Convert the current document as HTML into Markdown',
  category: 'file',
  execute: (ctx) => {
    const importer = ctx.api.import;
    if (!importer) {
      return unavailableImport(ctx);
    }
    return runImport(ctx, 'HTML', (source) => importer.fromHtml(source), true);
  },
};

const importNotionCommand: Command = {
  id: 'import.notion' as CommandId,
  name: 'Import Notion Page',
  description: 'Import a Notion page into the current document',
  category: 'file',
  execute: async (ctx) => {
    const importer = ctx.api.import;
    if (!importer) {
      return unavailableImport(ctx);
    }
    const pageId = promptValue('Notion page ID');
    const apiKey = promptValue('Notion API key');
    if (!pageId || !apiKey) {
      ctx.notify({ type: 'info', message: 'Import cancelled' });
      return { ok: false, error: 'Import cancelled' };
    }
    return runImport(ctx, 'Notion', () => importer.fromNotion(pageId, apiKey), false);
  },
};

const importGoogleDocsCommand: Command = {
  id: 'import.google-docs' as CommandId,
  name: 'Import Google Doc',
  description: 'Import a Google Doc into the current document',
  category: 'file',
  execute: async (ctx) => {
    const importer = ctx.api.import;
    if (!importer) {
      return unavailableImport(ctx);
    }
    const docId = promptValue('Google Doc ID');
    const accessToken = promptValue('Google access token');
    if (!docId || !accessToken) {
      ctx.notify({ type: 'info', message: 'Import cancelled' });
      return { ok: false, error: 'Import cancelled' };
    }
    return runImport(ctx, 'Google Docs', () => importer.fromGoogleDocs(docId, accessToken), false);
  },
};

export const IMPORT_COMMANDS: readonly Command[] = [
  importHtmlCommand,
  importNotionCommand,
  importGoogleDocsCommand,
];
