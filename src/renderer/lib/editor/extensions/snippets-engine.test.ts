/**
 * Unit tests for Snippets Engine extension.
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { snippetExtension, MDX_SNIPPETS, type Snippet } from './snippets-engine';

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

describe('snippetExtension', () => {
  it('returns a valid extension with default snippets', () => {
    const ext = snippetExtension();
    expect(ext).toBeDefined();
  });

  it('returns a valid extension with custom snippets', () => {
    const custom: Snippet[] = [
      {
        prefix: 'hero',
        label: 'Hero Section',
        body: '<Hero title="${1:title}" />',
      },
    ];

    const ext = snippetExtension(custom);
    expect(ext).toBeDefined();
  });

  it('creates a valid EditorState', () => {
    const state = EditorState.create({
      doc: 'test',
      extensions: [snippetExtension()],
    });
    expect(state.doc.toString()).toBe('test');
  });

  it('handles empty custom snippets array', () => {
    const ext = snippetExtension([]);
    expect(ext).toBeDefined();
  });
});
