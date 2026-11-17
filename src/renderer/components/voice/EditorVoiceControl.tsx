/**
 * Microphone control that inserts recognized speech at the cursor.
 */

import type { EditorView } from '@codemirror/view';
import { useEffect, useRef, type RefObject } from 'react';

import { useVoiceInput } from '@renderer/hooks/useVoiceInput';
import { insertVoiceAtSelection } from '@renderer/lib/insert-document-text';
import { useDocumentStore } from '@renderer/stores/document-store';
import { VoiceInputButton } from './VoiceInputButton';

export function EditorVoiceControl({
  editorRef = null,
}: {
  readonly editorRef?: RefObject<EditorView | null> | null | undefined;
}): React.JSX.Element {
  const { transcript, isListening, isSupported, error, start, stop } = useVoiceInput();
  const insertedRef = useRef(0);

  useEffect(() => {
    if (transcript.length < insertedRef.current) {
      insertedRef.current = transcript.length;
      return;
    }
    const addition = transcript.slice(insertedRef.current);
    insertedRef.current = transcript.length;
    if (addition.length === 0) {
      return;
    }
    const view = editorRef?.current ?? null;
    const current = view ? view.state.doc.toString() : useDocumentStore.getState().content;
    const selection = view
      ? { from: view.state.selection.main.from, to: view.state.selection.main.to }
      : null;
    const { text, cursor } = insertVoiceAtSelection(current, addition, selection);
    if (view) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: { anchor: cursor, head: cursor },
      });
    }
    useDocumentStore.getState().setContent(text);
  }, [editorRef, transcript]);

  return (
    <div className="flex items-center gap-2">
      <VoiceInputButton
        isListening={isListening}
        isSupported={isSupported}
        onStart={start}
        onStop={stop}
      />
      {error ? <span className="max-w-48 truncate text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
