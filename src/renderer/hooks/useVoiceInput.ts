/**
 * Voice Input Hook
 *
 * Provides Web Speech API integration for voice-to-text input.
 * Handles browser compatibility, webkit prefix fallback, and
 * graceful degradation when SpeechRecognition is not available.
 *
 * @module renderer/hooks/useVoiceInput
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent {
  readonly error: string;
  readonly message: string;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export interface VoiceInputOptions {
  readonly language?: string;
  readonly continuous?: boolean;
  readonly interimResults?: boolean;
}

export interface UseVoiceInputReturn {
  readonly transcript: string;
  readonly interimTranscript: string;
  readonly isListening: boolean;
  readonly isSupported: boolean;
  readonly error: string | null;
  readonly start: () => void;
  readonly stop: () => void;
  readonly clearTranscript: () => void;
}

// ============================================================================
// Browser Support Detection
// ============================================================================

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;

  // Access via property name to avoid type issues with non-standard APIs
  const sr = Reflect.get(window, 'SpeechRecognition') as unknown;
  if (typeof sr === 'function') return sr as SpeechRecognitionConstructor;

  const webkit = Reflect.get(window, 'webkitSpeechRecognition') as unknown;
  if (typeof webkit === 'function') return webkit as SpeechRecognitionConstructor;

  return null;
}

// ============================================================================
// Recognition Result Processing
// ============================================================================

function processResults(
  event: SpeechRecognitionEvent,
  setTranscript: (updater: (prev: string) => string) => void,
  setInterimTranscript: (value: string) => void
): void {
  let finalText = '';
  let interim = '';

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    if (result !== undefined) {
      const alternative = result[0];
      if (alternative !== undefined) {
        if (result.isFinal) {
          finalText += alternative.transcript;
        } else {
          interim += alternative.transcript;
        }
      }
    }
  }

  if (finalText.length > 0) {
    setTranscript((prev) => prev + finalText);
  }
  setInterimTranscript(interim);
}

// ============================================================================
// Recognition Setup
// ============================================================================

interface RecognitionCallbacks {
  readonly setIsListening: (value: boolean) => void;
  readonly setTranscript: (updater: (prev: string) => string) => void;
  readonly setInterimTranscript: (value: string) => void;
  readonly setError: (error: string | null) => void;
}

function configureRecognition(
  recognition: SpeechRecognitionInstance,
  callbacks: RecognitionCallbacks
): void {
  recognition.onstart = (): void => {
    callbacks.setIsListening(true);
  };
  recognition.onresult = (event): void => {
    processResults(event, callbacks.setTranscript, callbacks.setInterimTranscript);
  };
  recognition.onerror = (event): void => {
    if (event.error !== 'aborted') callbacks.setError(`Speech recognition error: ${event.error}`);
    callbacks.setIsListening(false);
  };
  recognition.onend = (): void => {
    callbacks.setIsListening(false);
    callbacks.setInterimTranscript('');
  };
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for voice-to-text input using the Web Speech API.
 */
export function useVoiceInput(options: VoiceInputOptions = {}): UseVoiceInputReturn {
  const { language = 'en-US', continuous = true, interimResults = true } = options;

  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isSupported = getSpeechRecognitionConstructor() !== null;
  const callbacks: RecognitionCallbacks = {
    setIsListening,
    setTranscript,
    setInterimTranscript,
    setError,
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current !== null) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionConstructor();
    if (Ctor === null) {
      setError('SpeechRecognition is not supported in this browser');
      return;
    }
    if (recognitionRef.current !== null) recognitionRef.current.abort();
    setError(null);
    const recognition = new Ctor();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;
    configureRecognition(recognition, callbacks);
    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start speech recognition');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks are stable setters
  }, [continuous, interimResults, language]);

  const stop = useCallback(() => {
    if (recognitionRef.current !== null) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    error,
    start,
    stop,
    clearTranscript,
  };
}
