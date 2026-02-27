/**
 * Unit tests for Keymap Factory.
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { createKeymapExtension, type KeymapMode } from './index';

describe('createKeymapExtension', () => {
  const modes: KeymapMode[] = ['default', 'vim', 'emacs'];

  for (const mode of modes) {
    it(`creates a valid extension for "${mode}" mode`, () => {
      const ext = createKeymapExtension(mode);
      expect(ext).toBeDefined();
    });

    it(`creates a valid EditorState with "${mode}" mode`, () => {
      const ext = createKeymapExtension(mode);

      const state = EditorState.create({
        doc: `test ${mode}`,
        extensions: [ext],
      });

      expect(state.doc.toString()).toBe(`test ${mode}`);
    });
  }

  it('returns empty extension for default mode', () => {
    const ext = createKeymapExtension('default');
    // Default returns an empty array
    expect(Array.isArray(ext)).toBe(true);
    expect((ext as []).length).toBe(0);
  });
});
