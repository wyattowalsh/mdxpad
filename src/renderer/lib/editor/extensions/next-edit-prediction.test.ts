/**
 * Unit tests for Next-Edit Prediction extension.
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
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
});
