import { describe, expect, it } from 'vitest';

import { readOpenSourceEditor } from './live-source-text';

describe('readOpenSourceEditor', () => {
  it('returns null when there is no editor', () => {
    expect(readOpenSourceEditor(null)).toBeNull();
    expect(readOpenSourceEditor(undefined)).toBeNull();
  });

  it('returns the text a live editor is showing', () => {
    expect(readOpenSourceEditor({ state: { doc: { toString: () => 'Hello!' } } })).toBe('Hello!');
  });

  it('skips a CodeMirror view that has been destroyed', () => {
    const view = { state: { doc: { toString: () => 'stale' } }, destroyed: true };
    expect(readOpenSourceEditor(view)).toBeNull();
  });

  it('skips a view marked closed by isDestroyed', () => {
    const view = { state: { doc: { toString: () => 'stale' } }, isDestroyed: true };
    expect(readOpenSourceEditor(view)).toBeNull();
  });
});
