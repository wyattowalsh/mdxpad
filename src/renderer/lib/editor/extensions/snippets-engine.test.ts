/**
 * Unit tests for Snippets Engine extension.
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { autocompletion } from '@codemirror/autocomplete';
import { createSnippetCompletionSource, MDX_SNIPPETS, type Snippet } from './snippets-engine';

describe('MDX_SNIPPETS', () => {
  it('contains built-in MDX snippets', () => {
    expect(MDX_SNIPPETS.length).toBeGreaterThan(0);
  });

  it('each snippet has required fields', () => {
    for (const s of MDX_SNIPPETS) {
      expect(s.prefix).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.body).toBeTruthy();
    }
  });

  it('includes component snippet', () => {
    const found = MDX_SNIPPETS.find((s) => s.prefix === 'component');
    expect(found).toBeDefined();
    expect(found!.body).toContain('Component');
  });

  it('includes codefence snippet', () => {
    const found = MDX_SNIPPETS.find((s) => s.prefix === 'codefence');
    expect(found).toBeDefined();
    expect(found!.body).toContain('```');
  });

  it('includes frontmatter snippet', () => {
    const found = MDX_SNIPPETS.find((s) => s.prefix === 'frontmatter');
    expect(found).toBeDefined();
    expect(found!.body).toContain('---');
  });
});

describe('createSnippetCompletionSource', () => {
  it('returns a completion source function with default snippets', () => {
    const source = createSnippetCompletionSource();
    expect(typeof source).toBe('function');
  });

  it('returns a completion source function with custom snippets', () => {
    const custom: Snippet[] = [
      {
        prefix: 'hero',
        label: 'Hero Section',
        body: '<Hero title="${1:title}" />',
      },
    ];

    const source = createSnippetCompletionSource(custom);
    expect(typeof source).toBe('function');
  });

  it('creates a valid EditorState when wrapped in autocompletion', () => {
    const source = createSnippetCompletionSource();
    const state = EditorState.create({
      doc: 'test',
      extensions: [autocompletion({ override: [source] })],
    });
    expect(state.doc.toString()).toBe('test');
  });

  it('handles empty custom snippets array', () => {
    const source = createSnippetCompletionSource([]);
    expect(typeof source).toBe('function');
  });
});
