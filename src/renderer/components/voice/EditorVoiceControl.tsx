/**
 * Microphone control that shows the live transcript and inserts it on request.
 */

import type { EditorView } from '@codemirror/view';
import { useCallback, useEffect, useRef, type RefObject } from 'react';

import { useVoiceInput } from '@renderer/hooks/useVoiceInput';
import { editorDocumentKey } from '@renderer/lib/editor-document-key';
import { insertVoiceAtSelection } from '@renderer/lib/insert-document-text';
import { selectFilePath, useDocumentStore } from '@renderer/stores/document-store';
import { selectActiveTabId, useTabStore } from '@renderer/stores/tab-store';
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
  const filePath = useDocumentStore(selectFilePath);
  const activeTabId = useTabStore(selectActiveTabId);
  const documentKey = editorDocumentKey(filePath, activeTabId);
  const spokenFor = useRef<string | null>(null);
  const hasSpeech = transcript.length > 0 || interimTranscript.length > 0 || isListening;
  if (!hasSpeech) {
    spokenFor.current = null;
  } else {
    spokenFor.current ??= documentKey;
  }
  const showSpeech = spokenFor.current === documentKey;

  const currentDocumentKey = useCallback(
    () =>
      editorDocumentKey(useDocumentStore.getState().filePath, useTabStore.getState().activeTabId),
    []
  );

  const startHere = useCallback(() => {
    const key = currentDocumentKey();
    if (spokenFor.current !== null && spokenFor.current !== key) {
      clearTranscript();
    }
    spokenFor.current = key;
    start();
  }, [clearTranscript, currentDocumentKey, start]);

  useEffect(() => {
    const toggle = (): void => {
      if (isListening) {
        stop();
        return;
      }
      startHere();
    };
    window.addEventListener(VOICE_TOGGLE_EVENT, toggle);
    return () => {
      window.removeEventListener(VOICE_TOGGLE_EVENT, toggle);
    };
  }, [isListening, startHere, stop]);

  const insertTranscript = useCallback(
    (addition: string) => {
      if (spokenFor.current !== null && spokenFor.current !== currentDocumentKey()) {
        return;
      }
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
    [clearTranscript, currentDocumentKey, editorRef, insertSpeech]
  );

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <VoiceInputButton
          isListening={isListening}
          isSupported={isSupported}
          onStart={startHere}
          onStop={stop}
        />
        {error ? <span className="max-w-48 truncate text-xs text-red-600">{error}</span> : null}
      </div>
      <VoiceTranscript
        transcript={showSpeech ? transcript : ''}
        interimTranscript={showSpeech ? interimTranscript : ''}
        isListening={showSpeech && isListening}
        onInsert={insertTranscript}
        onClear={clearTranscript}
      />
    </div>
  );
}
