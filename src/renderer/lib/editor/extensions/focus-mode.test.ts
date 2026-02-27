/**
 * Unit tests for Focus Mode extension.
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { focusModeExtension } from './focus-mode';

describe('focusModeExtension', () => {
  it('returns a valid extension', () => {
    const ext = focusModeExtension();
    expect(ext).toBeDefined();
    expect(Array.isArray(ext)).toBe(true);
  });

  it('creates a valid EditorState', () => {
    const state = EditorState.create({
      doc: 'line 1\nline 2\nline 3',
      extensions: [focusModeExtension()],
    });
    expect(state.doc.toString()).toBe('line 1\nline 2\nline 3');
  });

  it('handles empty document', () => {
    const state = EditorState.create({
      doc: '',
      extensions: [focusModeExtension()],
    });
    expect(state.doc.toString()).toBe('');
  });

  it('handles single line document', () => {
    const state = EditorState.create({
      doc: 'only one line',
      extensions: [focusModeExtension()],
    });
    expect(state.doc.toString()).toBe('only one line');
  });
});
