/**
 * Unit tests for Minimap extension.
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { minimapExtension } from './minimap';

describe('minimapExtension', () => {
  it('returns a valid extension', () => {
    const ext = minimapExtension();
    expect(ext).toBeDefined();
    expect(Array.isArray(ext)).toBe(true);
  });

  it('creates a valid EditorState', () => {
    const state = EditorState.create({
      doc: 'line 1\nline 2\nline 3',
      extensions: [minimapExtension()],
    });
    expect(state.doc.toString()).toBe('line 1\nline 2\nline 3');
  });

  it('handles empty document', () => {
    const state = EditorState.create({
      doc: '',
      extensions: [minimapExtension()],
    });
    expect(state.doc.toString()).toBe('');
  });
});
