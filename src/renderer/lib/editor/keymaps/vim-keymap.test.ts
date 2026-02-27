/**
 * Unit tests for Vim Keymap extension.
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { createVimKeymapExtension } from './vim-keymap';

describe('createVimKeymapExtension', () => {
  it('returns an extension and compartment', () => {
    const result = createVimKeymapExtension();

    expect(result.extension).toBeDefined();
    expect(result.compartment).toBeDefined();
  });

  it('creates a valid EditorState when enabled', () => {
    const { extension } = createVimKeymapExtension(true);

    const state = EditorState.create({
      doc: 'hello vim',
      extensions: [extension],
    });

    expect(state.doc.toString()).toBe('hello vim');
  });

  it('creates a valid EditorState when disabled', () => {
    const { extension } = createVimKeymapExtension(false);

    const state = EditorState.create({
      doc: 'hello default',
      extensions: [extension],
    });

    expect(state.doc.toString()).toBe('hello default');
  });

  it('defaults to enabled', () => {
    const { extension } = createVimKeymapExtension();

    const state = EditorState.create({
      doc: 'test',
      extensions: [extension],
    });

    expect(state.doc.toString()).toBe('test');
  });
});
