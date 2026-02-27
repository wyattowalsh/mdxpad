/**
 * VoiceInputButton Component
 *
 * Microphone button that toggles voice-to-text input.
 * Shows visual recording indicator when active.
 *
 * @module renderer/components/voice/VoiceInputButton
 */

import * as React from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { Button } from '@renderer/components/ui/button';

// ============================================================================
// Types
// ============================================================================

export interface VoiceInputButtonProps {
  /** Whether the microphone is currently recording */
  readonly isListening: boolean;
  /** Whether voice input is supported in this browser */
  readonly isSupported: boolean;
  /** Callback to start recording */
  readonly onStart: () => void;
  /** Callback to stop recording */
  readonly onStop: () => void;
  /** Optional additional CSS class name */
  readonly className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Microphone button for toggling voice input.
 *
 * Displays a microphone icon that toggles between on/off states.
 * When recording, shows a pulsing red indicator. When voice input
 * is not supported, the button is disabled.
 *
 * @example
 * ```tsx
 * <VoiceInputButton
 *   isListening={isListening}
 *   isSupported={isSupported}
 *   onStart={start}
 *   onStop={stop}
 * />
 * ```
 */
export const VoiceInputButton = React.memo(function VoiceInputButton({
  isListening,
  isSupported,
  onStart,
  onStop,
  className,
}: VoiceInputButtonProps): React.JSX.Element {
  const handleClick = React.useCallback(() => {
    if (isListening) {
      onStop();
    } else {
      onStart();
    }
  }, [isListening, onStart, onStop]);

  return (
    <Button
      variant={isListening ? 'destructive' : 'ghost'}
      size="icon"
      disabled={!isSupported}
      onClick={handleClick}
      className={cn('relative', className)}
      aria-label={isListening ? 'Stop recording' : 'Start recording'}
      aria-pressed={isListening}
      title={
        !isSupported
          ? 'Voice input is not supported in this browser'
          : isListening
            ? 'Stop recording'
            : 'Start recording'
      }
    >
      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}

      {/* Pulsing recording indicator */}
      {isListening && (
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500"
          aria-hidden="true"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        </span>
      )}
    </Button>
  );
});
