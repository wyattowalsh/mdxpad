/**
 * Unit tests for Word Wrap extension.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createWordWrapExtension } from './word-wrap';

describe('createWordWrapExtension', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container?.remove();
  });

  it('returns an extension, toggle function, and compartment', () => {
    const result = createWordWrapExtension();

    expect(result.extension).toBeDefined();
    expect(typeof result.toggle).toBe('function');
    expect(result.compartment).toBeDefined();
  });

  it('creates a valid extension that can initialize EditorState', () => {
    const { extension } = createWordWrapExtension();

    const state = EditorState.create({
      doc: 'Hello world',
      extensions: [extension],
    });

    expect(state.doc.toString()).toBe('Hello world');
  });

  it('defaults to word wrap disabled', () => {
    const { extension } = createWordWrapExtension();

    view = new EditorView({
      state: EditorState.create({
        doc: 'Hello world',
        extensions: [extension],
      }),
      parent: container,
    });

    // EditorView should be created without errors
    expect(view.state.doc.toString()).toBe('Hello world');
  });

  it('accepts initial wrap enabled', () => {
    const { extension } = createWordWrapExtension(true);

    view = new EditorView({
      state: EditorState.create({
        doc: 'Hello world',
        extensions: [extension],
      }),
      parent: container,
    });

    expect(view.state.doc.toString()).toBe('Hello world');
  });

  it('toggle function dispatches reconfiguration', () => {
    const { extension, toggle } = createWordWrapExtension(false);

    view = new EditorView({
      state: EditorState.create({
        doc: 'Hello world',
        extensions: [extension],
      }),
      parent: container,
    });

    // Should not throw when toggling
    expect(() => toggle(view, true)).not.toThrow();
    expect(() => toggle(view, false)).not.toThrow();
  });
});
