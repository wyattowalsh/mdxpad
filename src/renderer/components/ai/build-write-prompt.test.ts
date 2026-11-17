import { describe, expect, it } from 'vitest';
import {
  NO_MODELS_AVAILABLE_MESSAGE,
  buildAttachmentLoadOptions,
  buildWritePrompt,
  resolveListedModelId,
  toContextDocumentIds,
} from './build-write-prompt';

const DOCUMENT_ID = '55555555-5555-4555-8555-555555555555';

describe('buildWritePrompt', () => {
  it('includes the action text and an empty document', () => {
    const prompt = buildWritePrompt('Continue writing.', 'Untitled', '', null);

    expect(prompt).toContain('Continue writing.');
    expect(prompt).toContain('## Current document');
    expect(prompt).toContain('Path: Untitled');
    expect(prompt).toBe('Continue writing.\n\n## Current document\nPath: Untitled\n\n');
    expect(prompt).not.toContain('## Instruction');
  });

  it('includes the full document text and the loaded instruction', () => {
    const documentText = '# Title\n\nFull editor text';
    const prompt = buildWritePrompt('Rewrite the selection.', '/notes/draft.mdx', documentText, {
      fileName: 'AGENTS.md',
      content: 'Follow the house style.',
    });

    expect(prompt).toContain('Rewrite the selection.');
    expect(prompt).toContain('Path: /notes/draft.mdx');
    expect(prompt).toContain(documentText);
    expect(prompt).toContain('## Instruction');
    expect(prompt).toContain('File: AGENTS.md');
    expect(prompt).toContain('Follow the house style.');
  });
});

describe('buildAttachmentLoadOptions', () => {
  it('prefers the workspace model root and includes the document path', () => {
    expect(
      buildAttachmentLoadOptions({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        workspaceRootPath: '/from-prop',
        workspaceRootPathFromStore: '/from-store',
        documentPath: '/from-store/draft.mdx',
        instructionScope: 'workspace',
      })
    ).toEqual({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      workspaceRootPath: '/from-store',
      documentPath: '/from-store/draft.mdx',
      instructionScope: 'workspace',
    });
  });
});

describe('session create helpers', () => {
  it('keeps only uuid document ids', () => {
    expect(toContextDocumentIds(DOCUMENT_ID)).toEqual([DOCUMENT_ID]);
    expect(toContextDocumentIds('local-draft')).toEqual([]);
    expect(toContextDocumentIds(null)).toEqual([]);
  });

  it('uses the first listed model and reports an empty list', () => {
    expect(
      resolveListedModelId({
        success: true,
        models: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o' }],
      })
    ).toEqual({ ok: true, modelId: 'gpt-4o-mini' });

    expect(
      resolveListedModelId({
        success: false,
        models: [],
        error: { message: 'Provider has no models' },
      })
    ).toEqual({ ok: false, error: 'Provider has no models' });

    expect(resolveListedModelId({ success: true, models: [] })).toEqual({
      ok: false,
      error: NO_MODELS_AVAILABLE_MESSAGE,
    });
  });
});
