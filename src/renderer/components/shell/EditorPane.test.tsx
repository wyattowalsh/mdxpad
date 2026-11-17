import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useDocumentStore } from '@renderer/stores/document-store';
import { useEditorModeStore } from '@renderer/stores/editor-mode-store';
import { EditorPane } from './EditorPane';

describe('EditorPane', () => {
  afterEach(() => {
    useEditorModeStore.getState().setMode('source');
    localStorage.removeItem('mdxpad:editor-mode');
  });

  it('edits the document in WYSIWYG and returns to source', () => {
    useDocumentStore.getState().setContent('# Title');
    useEditorModeStore.getState().setMode('source');

    render(<EditorPane />);

    fireEvent.click(screen.getByRole('radio', { name: 'WYSIWYG' }));

    expect(document.querySelector('.prosemirror-editor')).not.toBeNull();
    expect(useEditorModeStore.getState().mode).toBe('wysiwyg');

    fireEvent.click(screen.getByRole('radio', { name: 'Source' }));

    expect(useEditorModeStore.getState().mode).toBe('source');
    expect(document.querySelector('.cm-editor, .cm-content')).not.toBeNull();
  });
});
