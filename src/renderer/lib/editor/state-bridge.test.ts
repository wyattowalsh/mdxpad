/**
 * Unit tests for State Bridge utilities.
 * Tests state conversion utilities for bridging CodeMirror and shared editor types.
 */

import { describe, it, expect, vi } from 'vitest';
import { toEditorState, toSelectionInfo, debounce } from './state-bridge';
import { EditorState as CMEditorState } from '@codemirror/state';

describe('toEditorState', () => {
  it('converts CodeMirror state to EditorState', () => {
    const cmState = CMEditorState.create({ doc: 'hello world' });
    const state = toEditorState(cmState);
    expect(state.doc).toBe('hello world');
    expect(state.selection.anchor).toBe(0);
    expect(state.selection.head).toBe(0);
  });

  it('captures selection position', () => {
    const cmState = CMEditorState.create({
      doc: 'hello world',
      selection: { anchor: 0, head: 5 },
    });
    const state = toEditorState(cmState);
    expect(state.selection.anchor).toBe(0);
    expect(state.selection.head).toBe(5);
  });
});

describe('toSelectionInfo', () => {
  it('computes from/to correctly when anchor < head', () => {
    const info = toSelectionInfo(0, 5);
    expect(info.from).toBe(0);
    expect(info.to).toBe(5);
    expect(info.empty).toBe(false);
  });

  it('computes from/to correctly when anchor > head', () => {
    const info = toSelectionInfo(5, 0);
    expect(info.from).toBe(0);
    expect(info.to).toBe(5);
    expect(info.empty).toBe(false);
  });

  it('detects empty selection', () => {
    const info = toSelectionInfo(3, 3);
    expect(info.from).toBe(3);
    expect(info.to).toBe(3);
    expect(info.empty).toBe(true);
  });
});

describe('debounce', () => {
  it('delays function execution', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced.call();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('cancels previous timeout on subsequent calls', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced.call();
    vi.advanceTimersByTime(50);
    debounced.call();
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('clamps ms to 0-2000 range', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 5000); // Exceeds 2000

    debounced.call();
    vi.advanceTimersByTime(2000);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('cancel() prevents pending callback from executing', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced.call();
    vi.advanceTimersByTime(50);
    debounced.cancel();
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('cancel() is safe to call when no pending timeout', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    // Should not throw
    expect(() => debounced.cancel()).not.toThrow();
  });

  it('can be called again after cancel()', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced.call();
    debounced.cancel();
    debounced.call();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
