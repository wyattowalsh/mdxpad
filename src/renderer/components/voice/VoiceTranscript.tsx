/**
 * VoiceTranscript Component
 *
 * Displays real-time transcription text from voice input with
 * insert and clear actions.
 *
 * @module renderer/components/voice/VoiceTranscript
 */

import * as React from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { Button } from '@renderer/components/ui/button';

// ============================================================================
// Types
// ============================================================================

export interface VoiceTranscriptProps {
  readonly transcript: string;
  readonly interimTranscript?: string;
  readonly isListening: boolean;
  readonly onInsert: (text: string) => void;
  readonly onClear: () => void;
  readonly className?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

function TranscriptText({
  transcript,
  interimTranscript,
  isListening,
  hasContent,
}: {
  readonly transcript: string;
  readonly interimTranscript: string;
  readonly isListening: boolean;
  readonly hasContent: boolean;
}): React.JSX.Element {
  return (
    <div className="mb-2 min-h-[2rem] text-sm">
      {transcript.length > 0 && <span>{transcript}</span>}
      {interimTranscript.length > 0 && (
        <span className="text-muted-foreground opacity-70">{interimTranscript}</span>
      )}
      {!hasContent && isListening && (
        <span className="text-muted-foreground italic">Listening...</span>
      )}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

function TranscriptActions({
  transcriptLength,
  fullTextLength,
  hasContent,
  onInsert,
  onClear,
}: {
  readonly transcriptLength: number;
  readonly fullTextLength: number;
  readonly hasContent: boolean;
  readonly onInsert: () => void;
  readonly onClear: () => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">
        {fullTextLength} character{fullTextLength !== 1 ? 's' : ''}
      </span>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onInsert}
          disabled={transcriptLength === 0}
          title="Insert"
        >
          <Copy className="mr-1 h-3 w-3" />
          Insert
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={!hasContent} title="Clear">
          <Trash2 className="mr-1 h-3 w-3" />
          Clear
        </Button>
      </div>
    </div>
  );
}

/**
 * Live transcript display for voice input.
 */
export const VoiceTranscript = React.memo(function VoiceTranscript({
  transcript,
  interimTranscript = '',
  isListening,
  onInsert,
  onClear,
  className,
}: VoiceTranscriptProps): React.JSX.Element | null {
  const fullText = transcript + interimTranscript;
  const hasContent = fullText.length > 0;

  const handleInsert = React.useCallback(() => {
    if (transcript.length > 0) onInsert(transcript);
  }, [transcript, onInsert]);

  if (!hasContent && !isListening) return null;

  return (
    <div
      className={cn(
        'rounded-md border bg-muted/50 p-3',
        isListening && 'border-red-500/50',
        className
      )}
      role="region"
      aria-label="Voice transcript"
      aria-live="polite"
    >
      <TranscriptText
        transcript={transcript}
        interimTranscript={interimTranscript}
        isListening={isListening}
        hasContent={hasContent}
      />
      <TranscriptActions
        transcriptLength={transcript.length}
        fullTextLength={fullText.length}
        hasContent={hasContent}
        onInsert={handleInsert}
        onClear={onClear}
      />
    </div>
  );
});
