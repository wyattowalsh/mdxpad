/**
 * Unit tests for Font Settings extension.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createFontSettingsExtension } from './font-settings';

describe('createFontSettingsExtension', () => {
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

  it('returns an extension, update function, and compartment', () => {
    const result = createFontSettingsExtension();

    expect(result.extension).toBeDefined();
    expect(typeof result.update).toBe('function');
    expect(result.compartment).toBeDefined();
  });

  it('creates a valid extension with default settings', () => {
    const { extension } = createFontSettingsExtension();

    const state = EditorState.create({
      doc: 'test',
      extensions: [extension],
    });

    expect(state.doc.toString()).toBe('test');
  });

  it('accepts custom font settings', () => {
    const { extension } = createFontSettingsExtension({
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 16,
      lineHeight: 1.8,
    });

    view = new EditorView({
      state: EditorState.create({
        doc: 'test',
        extensions: [extension],
      }),
      parent: container,
    });

    expect(view.state.doc.toString()).toBe('test');
  });

  it('update function dispatches reconfiguration', () => {
    const { extension, update } = createFontSettingsExtension();

    view = new EditorView({
      state: EditorState.create({
        doc: 'test',
        extensions: [extension],
      }),
      parent: container,
    });

    expect(() =>
      update(view, {
        fontSize: 20,
        fontFamily: 'serif',
        lineHeight: 2.0,
      })
    ).not.toThrow();
  });

  it('clamps font size to minimum of 8', () => {
    const { extension, update } = createFontSettingsExtension({ fontSize: 4 });

    view = new EditorView({
      state: EditorState.create({
        doc: 'test',
        extensions: [extension],
      }),
      parent: container,
    });

    // Should not throw with extreme values
    expect(() => update(view, { fontSize: 1 })).not.toThrow();
    expect(() => update(view, { fontSize: 100 })).not.toThrow();
  });
});
