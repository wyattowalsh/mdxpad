import { beforeEach, describe, expect, it } from 'vitest';

import { useDocumentStore } from '@renderer/stores/document-store';
import { useTabStore } from '@renderer/stores/tab-store';

import { noteEditorBaseline, publishEditorDocument } from './publish-editor-document';

describe('publishEditorDocument', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset();
    useTabStore.getState().reset();
    noteEditorBaseline('untitled', '');
  });

  it('keeps a document edit that landed ahead of the editor flush', () => {
    noteEditorBaseline('untitled', 'Hello');
    useDocumentStore.getState().setContent('Hello');
    useDocumentStore.getState().setContent('Imported');

    publishEditorDocument('untitled', 'Hello!');

    expect(useDocumentStore.getState().content).toBe('Imported');
  });

  it('stores editor text when the document has not been replaced', () => {
    noteEditorBaseline('untitled', 'Hello');
    useDocumentStore.getState().setContent('Hello');

    publishEditorDocument('untitled', 'Hello!');

    expect(useDocumentStore.getState().content).toBe('Hello!');
  });

  it('stores the editor once it catches up to the replacement', () => {
    noteEditorBaseline('untitled', 'Hello');
    useDocumentStore.getState().setContent('Hello');
    useDocumentStore.getState().setContent('Imported');
    publishEditorDocument('untitled', 'Hello!');

    publishEditorDocument('untitled', 'Imported');

    expect(useDocumentStore.getState().content).toBe('Imported');
    publishEditorDocument('untitled', 'Imported!');
    expect(useDocumentStore.getState().content).toBe('Imported!');
  });
});
