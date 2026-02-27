/**
 * Unit tests for Find & Replace Regex extension.
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import {
  regexSearchExtension,
  regexSearchField,
  toggleRegexEffect,
  toggleCaseSensitiveEffect,
  expandCaptureGroups,
} from './find-replace-regex';

describe('regexSearchExtension', () => {
  it('returns a valid extension', () => {
    const ext = regexSearchExtension();
    expect(ext).toBeDefined();
  });

  it('creates a valid EditorState', () => {
    const state = EditorState.create({
      doc: 'hello world',
      extensions: [regexSearchExtension()],
    });
    expect(state.doc.toString()).toBe('hello world');
  });
});

describe('regexSearchField', () => {
  it('starts with default state', () => {
    const state = EditorState.create({
      doc: 'test',
      extensions: [regexSearchField],
    });

    const fieldState = state.field(regexSearchField);
    expect(fieldState.regexEnabled).toBe(false);
    expect(fieldState.caseSensitive).toBe(false);
  });

  it('updates regex enabled via effect', () => {
    const state = EditorState.create({
      doc: 'test',
      extensions: [regexSearchField],
    });

    const transaction = state.update({
      effects: toggleRegexEffect.of(true),
    });

    const fieldState = transaction.state.field(regexSearchField);
    expect(fieldState.regexEnabled).toBe(true);
  });

  it('updates case sensitivity via effect', () => {
    const state = EditorState.create({
      doc: 'test',
      extensions: [regexSearchField],
    });

    const transaction = state.update({
      effects: toggleCaseSensitiveEffect.of(true),
    });

    const fieldState = transaction.state.field(regexSearchField);
    expect(fieldState.caseSensitive).toBe(true);
  });

  it('handles multiple effects in one transaction', () => {
    const state = EditorState.create({
      doc: 'test',
      extensions: [regexSearchField],
    });

    const transaction = state.update({
      effects: [toggleRegexEffect.of(true), toggleCaseSensitiveEffect.of(true)],
    });

    const fieldState = transaction.state.field(regexSearchField);
    expect(fieldState.regexEnabled).toBe(true);
    expect(fieldState.caseSensitive).toBe(true);
  });

  it('toggles back to false', () => {
    const state = EditorState.create({
      doc: 'test',
      extensions: [regexSearchField],
    });

    const step1 = state.update({ effects: toggleRegexEffect.of(true) });
    const step2 = step1.state.update({ effects: toggleRegexEffect.of(false) });

    expect(step2.state.field(regexSearchField).regexEnabled).toBe(false);
  });
});

describe('expandCaptureGroups', () => {
  it('replaces $1, $2 with capture groups', () => {
    const match = /(hello) (world)/.exec('hello world');
    expect(match).not.toBeNull();

    const result = expandCaptureGroups('$2 $1', match!);
    expect(result).toBe('world hello');
  });

  it('handles missing capture groups gracefully', () => {
    const match = /(hello)/.exec('hello');
    expect(match).not.toBeNull();

    const result = expandCaptureGroups('$1 $2', match!);
    expect(result).toBe('hello ');
  });

  it('handles pattern without capture references', () => {
    const match = /(hello)/.exec('hello');
    expect(match).not.toBeNull();

    const result = expandCaptureGroups('replaced', match!);
    expect(result).toBe('replaced');
  });

  it('handles multiple references to the same group', () => {
    const match = /(hello)/.exec('hello');
    expect(match).not.toBeNull();

    const result = expandCaptureGroups('$1-$1', match!);
    expect(result).toBe('hello-hello');
  });
});
