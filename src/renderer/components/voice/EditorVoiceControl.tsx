/**
 * Microphone control that appends recognized speech to the open document.
 */

import { useEffect, useRef } from 'react';

import { useVoiceInput } from '@renderer/hooks/useVoiceInput';
import { joinVoiceTranscript } from '@renderer/lib/insert-document-text';
import { useDocumentStore } from '@renderer/stores/document-store';
import { VoiceInputButton } from './VoiceInputButton';

export function EditorVoiceControl(): React.JSX.Element {
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
    const current = useDocumentStore.getState().content;
    useDocumentStore.getState().setContent(joinVoiceTranscript(current, addition));
  }, [transcript]);

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
