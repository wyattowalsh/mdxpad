import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { useDocumentStore } from '@renderer/stores/document-store';

const voice = vi.hoisted(() => ({
  transcript: '',
  interimTranscript: '',
  isListening: false,
  isSupported: true,
  error: null as string | null,
  start: vi.fn(),
  stop: vi.fn(),
  clearTranscript: vi.fn(),
}));

vi.mock('@renderer/hooks/useVoiceInput', () => ({
  useVoiceInput: () => voice,
}));

import { EditorVoiceControl } from './EditorVoiceControl';

describe('EditorVoiceControl', () => {
  beforeEach(() => {
    voice.transcript = '';
    voice.interimTranscript = '';
    voice.isListening = false;
    voice.error = null;
    voice.start.mockClear();
    voice.stop.mockClear();
    voice.clearTranscript.mockClear();
    useDocumentStore.getState().reset();
    useDocumentStore.getState().setContent('Hello');
  });

  it('shows the live transcript while speech is recognized', () => {
    voice.isListening = true;
    voice.interimTranscript = 'there';

    render(<EditorVoiceControl />);

    expect(screen.getByRole('region', { name: 'Voice transcript' }).textContent).toContain(
      'there'
    );
    expect(useDocumentStore.getState().content).toBe('Hello');
  });

  it('inserts the transcript when asked and then clears it', () => {
    voice.transcript = 'there';
    useDocumentStore.getState().setContent('Hello');

    render(<EditorVoiceControl />);
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));

    expect(useDocumentStore.getState().content).toBe('Hello there');
    expect(voice.clearTranscript).toHaveBeenCalledOnce();
  });

  it('keeps recognized speech on the file that was open', () => {
    voice.transcript = 'there';
    useDocumentStore.setState({ content: 'Hello', filePath: '/notes/a.md' });

    render(<EditorVoiceControl />);
    act(() => {
      useDocumentStore.setState({ content: 'Other', filePath: '/notes/b.md' });
    });

    expect(screen.queryByRole('button', { name: 'Insert' })).toBeNull();
    expect(useDocumentStore.getState().content).toBe('Other');

    act(() => {
      useDocumentStore.setState({ content: 'Hello', filePath: '/notes/a.md' });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));

    expect(useDocumentStore.getState().content).toBe('Hello there');
    expect(useDocumentStore.getState().filePath).toBe('/notes/a.md');
  });

  it('clears recognized speech without inserting it', () => {
    voice.transcript = 'there';

    render(<EditorVoiceControl />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(useDocumentStore.getState().content).toBe('Hello');
    expect(voice.clearTranscript).toHaveBeenCalledOnce();
  });
});
