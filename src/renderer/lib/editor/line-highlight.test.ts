/**
 * Unit tests for Line Highlight extension.
 * Tests CodeMirror extension for flash highlighting navigation targets.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  addLineHighlight,
  clearLineHighlight,
  lineHighlightField,
  lineHighlightExtension,
  highlightLineTemporary,
  HIGHLIGHT_DURATION_MS,
} from './line-highlight';

describe('HIGHLIGHT_DURATION_MS', () => {
  it('is 500ms per FR-022 specification', () => {
    expect(HIGHLIGHT_DURATION_MS).toBe(500);
  });
});

describe('lineHighlightField', () => {
  it('starts with no decorations', () => {
    const state = EditorState.create({
      doc: 'line 1\nline 2\nline 3',
      extensions: [lineHighlightField],
    });

    const decorations = state.field(lineHighlightField);
    expect(decorations.size).toBe(0);
  });

  it('adds line decoration on addLineHighlight effect', () => {
    const state = EditorState.create({
      doc: 'line 1\nline 2\nline 3',
      extensions: [lineHighlightField],
    });

    // Apply effect to highlight position in line 2 (offset 10)
    const transaction = state.update({
      effects: addLineHighlight.of(10),
    });

    const decorations = transaction.state.field(lineHighlightField);
    expect(decorations.size).toBe(1);
  });

  it('clears decoration on clearLineHighlight effect', () => {
    const state = EditorState.create({
      doc: 'line 1\nline 2\nline 3',
      extensions: [lineHighlightField],
    });

    // First add a highlight
    const withHighlight = state.update({
      effects: addLineHighlight.of(10),
    });

    expect(withHighlight.state.field(lineHighlightField).size).toBe(1);

    // Then clear it
    const cleared = withHighlight.state.update({
      effects: clearLineHighlight.of(undefined),
    });

    expect(cleared.state.field(lineHighlightField).size).toBe(0);
  });

  it('replaces existing highlight when adding new one', () => {
    const state = EditorState.create({
      doc: 'line 1\nline 2\nline 3',
      extensions: [lineHighlightField],
    });

    // Add first highlight
    const first = state.update({
      effects: addLineHighlight.of(0),
    });

    // Add second highlight (should replace)
    const second = first.state.update({
      effects: addLineHighlight.of(15),
    });

    // Should still only have one decoration
    expect(second.state.field(lineHighlightField).size).toBe(1);
  });

  it('handles invalid position gracefully', () => {
    const state = EditorState.create({
      doc: 'short',
      extensions: [lineHighlightField],
    });

    // Try to highlight beyond document length
    const transaction = state.update({
      effects: addLineHighlight.of(100),
    });

    const decorations = transaction.state.field(lineHighlightField);
    expect(decorations.size).toBe(0);
  });

  it('handles negative position gracefully', () => {
    const state = EditorState.create({
      doc: 'line 1\nline 2',
      extensions: [lineHighlightField],
    });

    const transaction = state.update({
      effects: addLineHighlight.of(-5),
    });

    const decorations = transaction.state.field(lineHighlightField);
    expect(decorations.size).toBe(0);
  });

  it('maps decorations through document changes', () => {
    const state = EditorState.create({
      doc: 'line 1\nline 2\nline 3',
      extensions: [lineHighlightField],
    });

    // Highlight line 2 (position 10)
    const withHighlight = state.update({
      effects: addLineHighlight.of(10),
    });

    expect(withHighlight.state.field(lineHighlightField).size).toBe(1);

    // Insert text at the beginning, shifting positions
    const afterInsert = withHighlight.state.update({
      changes: { from: 0, to: 0, insert: 'prefix\n' },
    });

    // Decoration should still exist, mapped to new position
    expect(afterInsert.state.field(lineHighlightField).size).toBe(1);
  });
});

describe('lineHighlightExtension', () => {
  it('is an array containing field and theme', () => {
    expect(Array.isArray(lineHighlightExtension)).toBe(true);
    expect(lineHighlightExtension.length).toBe(2);
  });

  it('can be used to create an EditorState', () => {
    const state = EditorState.create({
      doc: 'test content',
      extensions: [lineHighlightExtension],
    });

    expect(state.doc.toString()).toBe('test content');
  });
});

describe('highlightLineTemporary', () => {
  let view: EditorView;
  let container: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();

    // Create a container for the editor
    container = document.createElement('div');
    document.body.appendChild(container);

    // Create an EditorView
    view = new EditorView({
      state: EditorState.create({
        doc: 'line 1\nline 2\nline 3\nline 4\nline 5',
        extensions: [lineHighlightExtension],
      }),
      parent: container,
    });
  });

  afterEach(() => {
    view.destroy();
    container.remove();
    vi.useRealTimers();
  });

  it('adds highlight immediately', () => {
    highlightLineTemporary(view, 10);

    const decorations = view.state.field(lineHighlightField);
    expect(decorations.size).toBe(1);
  });

  it('clears highlight after default duration', () => {
    highlightLineTemporary(view, 10);

    // Highlight should be present
    expect(view.state.field(lineHighlightField).size).toBe(1);

    // Advance time past the duration
    vi.advanceTimersByTime(HIGHLIGHT_DURATION_MS + 10);

    // Highlight should be cleared
    expect(view.state.field(lineHighlightField).size).toBe(0);
  });

  it('clears highlight after custom duration', () => {
    const customDuration = 200;
    highlightLineTemporary(view, 10, customDuration);

    expect(view.state.field(lineHighlightField).size).toBe(1);

    // Advance less than custom duration
    vi.advanceTimersByTime(customDuration - 50);
    expect(view.state.field(lineHighlightField).size).toBe(1);

    // Advance past custom duration
    vi.advanceTimersByTime(100);
    expect(view.state.field(lineHighlightField).size).toBe(0);
  });

  it('returns cleanup function that clears highlight early', () => {
    const cleanup = highlightLineTemporary(view, 10);

    expect(view.state.field(lineHighlightField).size).toBe(1);

    // Call cleanup early
    cleanup();

    // Highlight should be cleared immediately
    expect(view.state.field(lineHighlightField).size).toBe(0);
  });

  it('cleanup prevents timeout from clearing again', () => {
    const dispatchSpy = vi.spyOn(view, 'dispatch');

    const cleanup = highlightLineTemporary(view, 10);

    // Initial highlight dispatch
    expect(dispatchSpy).toHaveBeenCalledTimes(1);

    // Cleanup (clears and cancels timeout)
    cleanup();
    expect(dispatchSpy).toHaveBeenCalledTimes(2);

    // Advance past timeout - should not dispatch again
    vi.advanceTimersByTime(HIGHLIGHT_DURATION_MS + 100);
    expect(dispatchSpy).toHaveBeenCalledTimes(2);

    dispatchSpy.mockRestore();
  });

  it('highlights correct line for given position', () => {
    // Position 10 should be in line 2 ("line 2")
    highlightLineTemporary(view, 10);

    const decorations = view.state.field(lineHighlightField);
    // Check the decoration is at line 2 start (position 7)
    let found = false;
    decorations.between(0, view.state.doc.length, (from) => {
      if (from === 7) found = true; // "line 1\n" = 7 chars, line 2 starts at 7
    });
    expect(found).toBe(true);
  });
});
