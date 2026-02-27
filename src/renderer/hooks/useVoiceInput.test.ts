/**
 * Voice Input Hook Tests
 *
 * Tests for the useVoiceInput hook with mocked SpeechRecognition API.
 *
 * @module renderer/hooks/useVoiceInput.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVoiceInput } from './useVoiceInput';

// ============================================================================
// Mock Setup
// ============================================================================

interface MockSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

function createMockSpeechRecognition(): MockSpeechRecognition {
  return {
    continuous: false,
    interimResults: false,
    lang: '',
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    onresult: null,
    onerror: null,
    onend: null,
    onstart: null,
  };
}

let mockInstance: MockSpeechRecognition | null = null;

// ============================================================================
// Tests
// ============================================================================

function setWindowProperty(name: string, value: unknown): void {
  Object.defineProperty(window, name, { value, writable: true, configurable: true });
}

function deleteWindowProperty(name: string): void {
  Reflect.deleteProperty(window, name);
}

describe('useVoiceInput', () => {
  beforeEach(() => {
    mockInstance = null;

    const MockConstructor = vi.fn(() => {
      mockInstance = createMockSpeechRecognition();
      // Simulate start triggering onstart
      mockInstance.start.mockImplementation(() => {
        setTimeout(() => {
          if (mockInstance?.onstart) {
            mockInstance.onstart();
          }
        }, 0);
      });
      return mockInstance;
    });

    setWindowProperty('SpeechRecognition', MockConstructor);
  });

  afterEach(() => {
    deleteWindowProperty('SpeechRecognition');
    deleteWindowProperty('webkitSpeechRecognition');
    vi.restoreAllMocks();
  });

  it('should detect browser support', () => {
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isSupported).toBe(true);
  });

  it('should detect when speech recognition is not supported', () => {
    deleteWindowProperty('SpeechRecognition');
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isSupported).toBe(false);
  });

  it('should detect webkit prefix fallback', () => {
    deleteWindowProperty('SpeechRecognition');
    setWindowProperty(
      'webkitSpeechRecognition',
      vi.fn(() => createMockSpeechRecognition())
    );
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.isSupported).toBe(true);
  });

  it('should start listening', async () => {
    const { result } = renderHook(() => useVoiceInput());

    expect(result.current.isListening).toBe(false);

    await act(async () => {
      result.current.start();
      // Wait for the setTimeout in mock
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.isListening).toBe(true);
  });

  it('should stop listening', async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.isListening).toBe(false);
  });

  it('should set error when SpeechRecognition is not available', () => {
    deleteWindowProperty('SpeechRecognition');

    const { result } = renderHook(() => useVoiceInput());

    act(() => {
      result.current.start();
    });

    expect(result.current.error).toBe('SpeechRecognition is not supported in this browser');
  });

  it('should clear transcript', async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Simulate receiving a result
    act(() => {
      if (mockInstance?.onresult) {
        mockInstance.onresult({
          resultIndex: 0,
          results: {
            length: 1,
            item: () => ({
              isFinal: true,
              length: 1,
              item: () => ({ transcript: 'hello', confidence: 0.9 }),
              0: { transcript: 'hello', confidence: 0.9 },
            }),
            0: {
              isFinal: true,
              length: 1,
              item: () => ({ transcript: 'hello', confidence: 0.9 }),
              0: { transcript: 'hello', confidence: 0.9 },
            },
          },
        });
      }
    });

    expect(result.current.transcript).toBe('hello');

    act(() => {
      result.current.clearTranscript();
    });

    expect(result.current.transcript).toBe('');
  });

  it('should handle recognition errors', async () => {
    const { result } = renderHook(() => useVoiceInput());

    await act(async () => {
      result.current.start();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    act(() => {
      if (mockInstance?.onerror) {
        mockInstance.onerror({
          error: 'network',
          message: 'Network error',
        });
      }
    });

    expect(result.current.error).toBe('Speech recognition error: network');
    expect(result.current.isListening).toBe(false);
  });

  it('should configure language', async () => {
    renderHook(() => useVoiceInput({ language: 'fr-FR' }));

    await act(async () => {
      // Need to trigger start to create the instance
    });

    // The language is set during start, so we need to call start
    const { result } = renderHook(() => useVoiceInput({ language: 'fr-FR' }));

    await act(async () => {
      result.current.start();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(mockInstance?.lang).toBe('fr-FR');
  });
});
