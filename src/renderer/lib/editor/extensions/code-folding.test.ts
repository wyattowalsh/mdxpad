/**
 * Unit tests for Code Folding extension.
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { codeFoldingExtension, foldFrontmatter, foldCodeFence, foldJsxBlock } from './code-folding';

describe('codeFoldingExtension', () => {
  it('returns a valid extension', () => {
    const ext = codeFoldingExtension();
    expect(ext).toBeDefined();
    expect(Array.isArray(ext)).toBe(true);
  });

  it('creates a valid EditorState', () => {
    const state = EditorState.create({
      doc: '# Hello\n\nWorld',
      extensions: [codeFoldingExtension()],
    });
    expect(state.doc.toString()).toBe('# Hello\n\nWorld');
  });
});

describe('foldFrontmatter', () => {
  it('folds frontmatter block on line 1', () => {
    const doc = EditorState.create({
      doc: '---\ntitle: Hello\ndate: 2024-01-01\n---\n\n# Content',
    }).doc;

    const result = foldFrontmatter(doc, 1);
    expect(result).not.toBeNull();
    expect(result!.from).toBe(doc.line(1).to); // End of first ---
    expect(result!.to).toBe(doc.line(4).to); // End of closing ---
  });

  it('returns null when frontmatter opener is not on line 1', () => {
    const doc = EditorState.create({
      doc: 'some text\n---\ntitle: Hello\n---',
    }).doc;

    const result = foldFrontmatter(doc, 2);
    expect(result).toBeNull();
  });

  it('returns null when no closing delimiter exists', () => {
    const doc = EditorState.create({
      doc: '---\ntitle: Hello\ndate: 2024-01-01',
    }).doc;

    const result = foldFrontmatter(doc, 1);
    expect(result).toBeNull();
  });

  it('returns null for non-frontmatter lines', () => {
    const doc = EditorState.create({
      doc: '# Hello\n\nWorld',
    }).doc;

    const result = foldFrontmatter(doc, 1);
    expect(result).toBeNull();
  });
});

describe('foldCodeFence', () => {
  it('folds triple backtick code fences', () => {
    const doc = EditorState.create({
      doc: '```javascript\nconsole.log("hello");\n```',
    }).doc;

    const result = foldCodeFence(doc, 1);
    expect(result).not.toBeNull();
    expect(result!.from).toBe(doc.line(1).to);
    expect(result!.to).toBe(doc.line(3).to);
  });

  it('folds tilde code fences', () => {
    const doc = EditorState.create({
      doc: '~~~python\nprint("hello")\n~~~',
    }).doc;

    const result = foldCodeFence(doc, 1);
    expect(result).not.toBeNull();
  });

  it('returns null for non-fence lines', () => {
    const doc = EditorState.create({
      doc: 'regular text',
    }).doc;

    const result = foldCodeFence(doc, 1);
    expect(result).toBeNull();
  });

  it('returns null when no closing fence exists', () => {
    const doc = EditorState.create({
      doc: '```javascript\nconsole.log("hello");',
    }).doc;

    const result = foldCodeFence(doc, 1);
    expect(result).toBeNull();
  });
});

describe('foldJsxBlock', () => {
  it('folds simple JSX blocks', () => {
    const doc = EditorState.create({
      doc: '<Component>\n  content\n</Component>',
    }).doc;

    const result = foldJsxBlock(doc, 1);
    expect(result).not.toBeNull();
    expect(result!.from).toBe(doc.line(1).to);
    expect(result!.to).toBe(doc.line(3).to);
  });

  it('skips self-closing tags', () => {
    const doc = EditorState.create({
      doc: '<Component />',
    }).doc;

    const result = foldJsxBlock(doc, 1);
    expect(result).toBeNull();
  });

  it('returns null for lowercase tags (HTML elements)', () => {
    const doc = EditorState.create({
      doc: '<div>\n  content\n</div>',
    }).doc;

    const result = foldJsxBlock(doc, 1);
    expect(result).toBeNull();
  });

  it('handles nested JSX blocks', () => {
    const doc = EditorState.create({
      doc: '<Outer>\n  <Outer>\n    inner\n  </Outer>\n</Outer>',
    }).doc;

    const result = foldJsxBlock(doc, 1);
    expect(result).not.toBeNull();
    // Should fold to the outer closing tag
    expect(result!.to).toBe(doc.line(5).to);
  });

  it('returns null when no closing tag exists', () => {
    const doc = EditorState.create({
      doc: '<Component>\n  content',
    }).doc;

    const result = foldJsxBlock(doc, 1);
    expect(result).toBeNull();
  });
});
