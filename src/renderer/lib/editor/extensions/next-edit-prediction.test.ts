/**
 * Unit tests for Next-Edit Prediction extension.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { nextEditPrediction } from './next-edit-prediction';
import type { PredictionProvider } from './next-edit-prediction';

describe('nextEditPrediction', () => {
  const mockProvider: PredictionProvider = async () => null;

  it('returns a valid extension', () => {
    const ext = nextEditPrediction(mockProvider);
    expect(ext).toBeDefined();
    expect(Array.isArray(ext)).toBe(true);
  });

  it('creates a valid EditorState with extension', () => {
    const state = EditorState.create({
      doc: 'Hello world',
      extensions: [nextEditPrediction(mockProvider)],
    });
    expect(state.doc.toString()).toBe('Hello world');
  });

  it('handles empty document', () => {
    const state = EditorState.create({
      doc: '',
      extensions: [nextEditPrediction(mockProvider)],
    });
    expect(state.doc.toString()).toBe('');
  });

  it('handles multiline document', () => {
    const doc = 'line 1\nline 2\nline 3';
    const state = EditorState.create({
      doc,
      extensions: [nextEditPrediction(mockProvider)],
    });
    expect(state.doc.toString()).toBe(doc);
  });

  it('accepts a custom prediction provider', () => {
    const customProvider: PredictionProvider = async (text, pos) => {
      return `Completion at ${pos}`;
    };

    const ext = nextEditPrediction(customProvider);
    expect(ext).toBeDefined();
  });

  it('does not show a prediction aborted by a later keystroke', async () => {
    vi.useFakeTimers();
    const views: EditorView[] = [];
    let resolveFirst: ((value: string) => void) | undefined;
    let calls = 0;
    const provider: PredictionProvider = () => {
      calls += 1;
      if (calls === 1) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve('later');
    };
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
      state: EditorState.create({
        doc: 'Hello',
        extensions: [nextEditPrediction(provider)],
      }),
      parent,
    });
    views.push(view);

    try {
      view.dispatch({ changes: { from: 5, insert: '!' } });
      await vi.advanceTimersByTimeAsync(500);
      expect(calls).toBe(1);
      view.dispatch({ changes: { from: view.state.doc.length, insert: '?' } });
      resolveFirst?.(' ghost');
      await Promise.resolve();
      expect(view.dom.querySelector('.cm-ghost-text')).toBeNull();
    } finally {
      for (const openView of views) {
        openView.destroy();
      }
      parent.remove();
      vi.useRealTimers();
    }
  });

  it('does not request a prediction after the editor closes', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const provider: PredictionProvider = () => {
      calls += 1;
      return Promise.resolve(' ghost');
    };
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
      state: EditorState.create({
        doc: 'Hello',
        extensions: [nextEditPrediction(provider)],
      }),
      parent,
    });
    const rejections: unknown[] = [];
    const onRejection = (event: PromiseRejectionEvent): void => {
      rejections.push(event.reason);
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', onRejection);

    try {
      view.dispatch({ changes: { from: 5, insert: '!' } });
      view.destroy();
      await vi.advanceTimersByTimeAsync(500);
      expect(calls).toBe(0);
      expect(rejections).toEqual([]);
    } finally {
      window.removeEventListener('unhandledrejection', onRejection);
      parent.remove();
      vi.useRealTimers();
    }
  });

  it('drops a prediction that finishes after the editor closes', async () => {
    vi.useFakeTimers();
    let finish: ((value: string) => void) | undefined;
    const provider: PredictionProvider = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
      state: EditorState.create({
        doc: 'Hello',
        extensions: [nextEditPrediction(provider)],
      }),
      parent,
    });
    const rejections: unknown[] = [];
    const onRejection = (event: PromiseRejectionEvent): void => {
      rejections.push(event.reason);
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', onRejection);

    try {
      view.dispatch({ changes: { from: 5, insert: '!' } });
      await vi.advanceTimersByTimeAsync(500);
      view.destroy();
      finish?.(' ghost');
      await Promise.resolve();
      expect(rejections).toEqual([]);
    } finally {
      window.removeEventListener('unhandledrejection', onRejection);
      parent.remove();
      vi.useRealTimers();
    }
  });
});

afterEach(() => {
  vi.useRealTimers();
});
