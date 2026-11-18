/**
 * Microphone control that shows the live transcript and inserts it on request.
 */

import type { EditorView } from '@codemirror/view';
import { useCallback, useEffect, type RefObject } from 'react';

import { useVoiceInput } from '@renderer/hooks/useVoiceInput';
import { insertVoiceAtSelection } from '@renderer/lib/insert-document-text';
import { useDocumentStore } from '@renderer/stores/document-store';
import { VOICE_TOGGLE_EVENT } from '@renderer/lib/voice-toggle';
import { VoiceInputButton } from './VoiceInputButton';
import { VoiceTranscript } from './VoiceTranscript';

export function EditorVoiceControl({
  editorRef = null,
  insertSpeech = null,
}: {
  readonly editorRef?: RefObject<EditorView | null> | null | undefined;
  readonly insertSpeech?: ((text: string) => void) | null;
}): React.JSX.Element {
  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    error,
    start,
    stop,
    clearTranscript,
  } = useVoiceInput();

  useEffect(() => {
    const toggle = (): void => {
      if (isListening) {
        stop();
        return;
      }
      start();
    };
    window.addEventListener(VOICE_TOGGLE_EVENT, toggle);
    return () => {
      window.removeEventListener(VOICE_TOGGLE_EVENT, toggle);
    };
  }, [isListening, start, stop]);

  const insertTranscript = useCallback(
    (addition: string) => {
      if (insertSpeech) {
        insertSpeech(addition);
      } else {
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
      }
      clearTranscript();
    },
    [clearTranscript, editorRef, insertSpeech]
  );

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <VoiceInputButton
          isListening={isListening}
          isSupported={isSupported}
          onStart={start}
          onStop={stop}
        />
        {error ? <span className="max-w-48 truncate text-xs text-red-600">{error}</span> : null}
      </div>
      <VoiceTranscript
        transcript={transcript}
        interimTranscript={interimTranscript}
        isListening={isListening}
        onInsert={insertTranscript}
        onClear={clearTranscript}
      />
    </div>
  );
}
