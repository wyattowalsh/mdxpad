/**
 * Unit tests for Multi-Cursor extension.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { multiCursorExtension, selectNextOccurrence, selectAllOccurrences } from './multi-cursor';

describe('multiCursorExtension', () => {
  it('returns a valid extension', () => {
    const ext = multiCursorExtension();
    expect(ext).toBeDefined();
  });

  it('creates a valid EditorState', () => {
    const state = EditorState.create({
      doc: 'hello world',
      extensions: [multiCursorExtension()],
    });
    expect(state.doc.toString()).toBe('hello world');
  });
});

describe('selectNextOccurrence', () => {
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

  it('selects word under cursor when nothing is selected', () => {
    view = new EditorView({
      state: EditorState.create({
        doc: 'hello world hello',
        extensions: [multiCursorExtension()],
        selection: EditorSelection.cursor(2),
      }),
      parent: container,
    });

    const result = selectNextOccurrence(view);
    expect(result).toBe(true);

    const { from, to } = view.state.selection.main;
    expect(view.state.sliceDoc(from, to)).toBe('hello');
  });

  it('finds next occurrence and adds to selections', () => {
    // Create a view with "hello" selected (0-5)
    view = new EditorView({
      state: EditorState.create({
        doc: 'hello world hello again',
        extensions: [multiCursorExtension()],
        selection: EditorSelection.single(0, 5),
      }),
      parent: container,
    });

    // Verify initial state
    expect(view.state.selection.ranges.length).toBe(1);
    expect(view.state.sliceDoc(0, 5)).toBe('hello');

    // Call the command
    selectNextOccurrence(view);

    // Should now have 2 ranges
    expect(view.state.selection.ranges.length).toBe(2);
    // Second selection should be the second "hello"
    const second = view.state.selection.ranges[1];
    expect(second).toBeDefined();
    expect(view.state.sliceDoc(second!.from, second!.to)).toBe('hello');
  });

  it('returns false when no text and cursor is not on a word', () => {
    view = new EditorView({
      state: EditorState.create({
        doc: '   ',
        extensions: [multiCursorExtension()],
        selection: EditorSelection.cursor(1),
      }),
      parent: container,
    });

    const result = selectNextOccurrence(view);
    expect(result).toBe(false);
  });

  it('returns false when no more occurrences exist', () => {
    view = new EditorView({
      state: EditorState.create({
        doc: 'unique word here',
        extensions: [multiCursorExtension()],
        selection: EditorSelection.single(0, 6),
      }),
      parent: container,
    });

    const result = selectNextOccurrence(view);
    expect(result).toBe(false);
  });
});

describe('selectAllOccurrences', () => {
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

  it('selects all occurrences of the selected text', () => {
    view = new EditorView({
      state: EditorState.create({
        doc: 'foo bar foo baz foo',
        extensions: [multiCursorExtension()],
        selection: EditorSelection.single(0, 3),
      }),
      parent: container,
    });

    const result = selectAllOccurrences(view);
    expect(result).toBe(true);
    expect(view.state.selection.ranges.length).toBe(3);
  });

  it('returns false when no text is selected and cursor is on whitespace', () => {
    view = new EditorView({
      state: EditorState.create({
        doc: '   ',
        extensions: [multiCursorExtension()],
        selection: EditorSelection.cursor(1),
      }),
      parent: container,
    });

    const result = selectAllOccurrences(view);
    expect(result).toBe(false);
  });

  it('handles single occurrence correctly', () => {
    view = new EditorView({
      state: EditorState.create({
        doc: 'unique text here',
        extensions: [multiCursorExtension()],
        selection: EditorSelection.single(0, 6),
      }),
      parent: container,
    });

    const result = selectAllOccurrences(view);
    expect(result).toBe(true);
    expect(view.state.selection.ranges.length).toBe(1);
  });
});
