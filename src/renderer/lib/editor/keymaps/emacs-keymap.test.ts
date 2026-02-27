/**
 * Unit tests for Emacs Keymap extension.
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { createEmacsKeymapExtension } from './emacs-keymap';

describe('createEmacsKeymapExtension', () => {
  it('returns an extension and compartment', () => {
    const result = createEmacsKeymapExtension();

    expect(result.extension).toBeDefined();
    expect(result.compartment).toBeDefined();
  });

  it('creates a valid EditorState when enabled', () => {
    const { extension } = createEmacsKeymapExtension(true);

    const state = EditorState.create({
      doc: 'hello emacs',
      extensions: [extension],
    });

    expect(state.doc.toString()).toBe('hello emacs');
  });

  it('creates a valid EditorState when disabled', () => {
    const { extension } = createEmacsKeymapExtension(false);

    const state = EditorState.create({
      doc: 'hello default',
      extensions: [extension],
    });

    expect(state.doc.toString()).toBe('hello default');
  });

  it('defaults to enabled', () => {
    const { extension } = createEmacsKeymapExtension();

    const state = EditorState.create({
      doc: 'test',
      extensions: [extension],
    });

    expect(state.doc.toString()).toBe('test');
  });
});
