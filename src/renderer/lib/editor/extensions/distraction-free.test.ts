/**
 * Unit tests for Distraction-Free Mode extension.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { distractionFreeExtension, createDistractionFreeState } from './distraction-free';

describe('distractionFreeExtension', () => {
  it('returns a valid extension', () => {
    const ext = distractionFreeExtension();
    expect(ext).toBeDefined();
  });

  it('creates a valid EditorState', () => {
    const state = EditorState.create({
      doc: 'test content',
      extensions: [distractionFreeExtension()],
    });
    expect(state.doc.toString()).toBe('test content');
  });
});

describe('createDistractionFreeState', () => {
  afterEach(() => {
    // Clean up any body classes
    document.body.classList.remove('distraction-free-active');
  });

  it('starts as inactive', () => {
    const state = createDistractionFreeState();
    expect(state.isActive).toBe(false);
  });

  it('toggles to active', () => {
    const state = createDistractionFreeState();
    state.toggle();
    expect(state.isActive).toBe(true);
  });

  it('toggles back to inactive', () => {
    const state = createDistractionFreeState();
    state.toggle();
    state.toggle();
    expect(state.isActive).toBe(false);
  });

  it('adds body class when activated', () => {
    const state = createDistractionFreeState();
    state.toggle();
    expect(document.body.classList.contains('distraction-free-active')).toBe(true);
  });

  it('removes body class when deactivated', () => {
    const state = createDistractionFreeState();
    state.toggle(); // activate
    state.toggle(); // deactivate
    expect(document.body.classList.contains('distraction-free-active')).toBe(false);
  });
});
