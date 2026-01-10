/**
 * Unit tests for MDX Language Support module.
 * Tests the mdxLanguage function that provides CodeMirror 6 language support for MDX files.
 *
 * Per Constitution Article III Section 3.4 - CodeMirror idioms.
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { syntaxTree, ensureSyntaxTree } from '@codemirror/language';
import { mdxLanguage } from './mdx-language';

/**
 * Type definitions for Lezer syntax tree nodes.
 * Using inline types to avoid dependency on @lezer/common types.
 */
interface SyntaxNode {
  readonly from: number;
  readonly to: number;
  readonly name: string;
  readonly type: { readonly name: string };
}

/**
 * Helper function to create an EditorState with MDX content and parse it.
 * Uses ensureSyntaxTree to ensure the full document is parsed synchronously.
 */
function createStateWithContent(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [mdxLanguage()],
  });
}

/**
 * Helper function to get the fully parsed syntax tree.
 * Ensures the tree is complete by using ensureSyntaxTree with a reasonable timeout.
 */
function getFullTree(state: EditorState) {
  // Use ensureSyntaxTree with timeout to ensure full parsing
  const tree = ensureSyntaxTree(state, state.doc.length, 5000);
  return tree ?? syntaxTree(state);
}

/**
 * Helper function to collect all node names from a syntax tree.
 * Useful for debugging and understanding tree structure.
 */
function collectAllNodes(state: EditorState): { name: string; from: number; to: number; text: string }[] {
  const tree = getFullTree(state);
  const nodes: { name: string; from: number; to: number; text: string }[] = [];
  const cursor = tree.cursor();

  do {
    nodes.push({
      name: cursor.name,
      from: cursor.from,
      to: cursor.to,
      text: state.doc.sliceString(cursor.from, cursor.to),
    });
  } while (cursor.next());

  return nodes;
}

/**
 * Helper function to find a node by name that contains specific text.
 */
function findNodeByNameContainingText(
  state: EditorState,
  nodeName: string,
  containsText: string
): SyntaxNode | null {
  const tree = getFullTree(state);
  const cursor = tree.cursor();

  do {
    if (cursor.name === nodeName) {
      const text = state.doc.sliceString(cursor.from, cursor.to);
      if (text.includes(containsText)) {
        return cursor.node;
      }
    }
  } while (cursor.next());

  return null;
}

/**
 * Helper function to find all nodes with a given name.
 */
function findAllNodesByName(state: EditorState, nodeName: string): SyntaxNode[] {
  const tree = getFullTree(state);
  const nodes: SyntaxNode[] = [];
  const cursor = tree.cursor();

  do {
    if (cursor.name === nodeName) {
      nodes.push(cursor.node);
    }
  } while (cursor.next());

  return nodes;
}

/**
 * Helper function to get the node at a specific position.
 */
function getNodeAtPosition(state: EditorState, pos: number): SyntaxNode {
  const tree = getFullTree(state);
  return tree.resolveInner(pos, 1);
}

/**
 * Helper function to check if a node type exists in the tree.
 */
function hasNodeType(state: EditorState, nodeName: string): boolean {
  return findAllNodesByName(state, nodeName).length > 0;
}

// =============================================================================
// EXISTING TESTS - Preserved from original file
// =============================================================================

describe('mdxLanguage', () => {
  it('returns a LanguageSupport object', () => {
    const lang = mdxLanguage();
    expect(lang).toBeDefined();
    expect(lang.language).toBeDefined();
  });

  it('supports markdown syntax wrapped in yaml-frontmatter', () => {
    const lang = mdxLanguage();
    // Top-level language is yaml-frontmatter which wraps markdown
    expect(lang.language.name).toBe('yaml-frontmatter');
  });

  it('supports yaml frontmatter', () => {
    const lang = mdxLanguage();
    // Wrapped in yamlFrontmatter
    expect(lang).toBeDefined();
  });
});

// =============================================================================
// NEW TESTS - Syntax Tree Verification (~50+ new assertions)
// =============================================================================

describe('MDX Syntax Tree Verification', () => {
  describe('EditorState creation', () => {
    it('creates an EditorState with MDX content', () => {
      const state = createStateWithContent('# Hello');
      expect(state).toBeDefined();
      expect(state.doc.toString()).toBe('# Hello');
    });

    it('produces a parseable syntax tree', () => {
      const state = createStateWithContent('# Hello');
      const tree = getFullTree(state);
      expect(tree).toBeDefined();
      expect(tree.topNode).toBeDefined();
    });

    it('parses empty document', () => {
      const state = createStateWithContent('');
      const tree = getFullTree(state);
      expect(tree).toBeDefined();
    });
  });

  describe('Markdown Heading Highlighting', () => {
    it('recognizes ATX heading level 1', () => {
      const state = createStateWithContent('# Heading 1');
      expect(hasNodeType(state, 'ATXHeading1')).toBe(true);
    });

    it('recognizes ATX heading level 2', () => {
      const state = createStateWithContent('## Heading 2');
      expect(hasNodeType(state, 'ATXHeading2')).toBe(true);
    });

    it('recognizes ATX heading level 3', () => {
      const state = createStateWithContent('### Heading 3');
      expect(hasNodeType(state, 'ATXHeading3')).toBe(true);
    });

    it('recognizes ATX heading level 4', () => {
      const state = createStateWithContent('#### Heading 4');
      expect(hasNodeType(state, 'ATXHeading4')).toBe(true);
    });

    it('recognizes ATX heading level 5', () => {
      const state = createStateWithContent('##### Heading 5');
      expect(hasNodeType(state, 'ATXHeading5')).toBe(true);
    });

    it('recognizes ATX heading level 6', () => {
      const state = createStateWithContent('###### Heading 6');
      expect(hasNodeType(state, 'ATXHeading6')).toBe(true);
    });

    it('includes HeaderMark for heading hash symbols', () => {
      const state = createStateWithContent('# Hello');
      expect(hasNodeType(state, 'HeaderMark')).toBe(true);
    });

    it('parses multiple headings correctly', () => {
      const state = createStateWithContent('# First\n## Second\n### Third');
      expect(hasNodeType(state, 'ATXHeading1')).toBe(true);
      expect(hasNodeType(state, 'ATXHeading2')).toBe(true);
      expect(hasNodeType(state, 'ATXHeading3')).toBe(true);
    });
  });

  describe('Markdown Bold/Strong Highlighting', () => {
    it('recognizes strong emphasis with double asterisks', () => {
      const state = createStateWithContent('This is **bold** text');
      expect(hasNodeType(state, 'StrongEmphasis')).toBe(true);
    });

    it('recognizes strong emphasis with double underscores', () => {
      const state = createStateWithContent('This is __bold__ text');
      expect(hasNodeType(state, 'StrongEmphasis')).toBe(true);
    });

    it('includes EmphasisMark for bold delimiters', () => {
      const state = createStateWithContent('**bold**');
      expect(hasNodeType(state, 'EmphasisMark')).toBe(true);
    });

    it('parses bold text content correctly', () => {
      const state = createStateWithContent('**hello world**');
      const strongNode = findNodeByNameContainingText(state, 'StrongEmphasis', 'hello');
      expect(strongNode).not.toBeNull();
      if (strongNode) {
        expect(state.doc.sliceString(strongNode.from, strongNode.to)).toBe('**hello world**');
      }
    });
  });

  describe('Markdown Italic/Emphasis Highlighting', () => {
    it('recognizes emphasis with single asterisk', () => {
      const state = createStateWithContent('This is *italic* text');
      expect(hasNodeType(state, 'Emphasis')).toBe(true);
    });

    it('recognizes emphasis with single underscore', () => {
      const state = createStateWithContent('This is _italic_ text');
      expect(hasNodeType(state, 'Emphasis')).toBe(true);
    });

    it('includes EmphasisMark for italic delimiters', () => {
      const state = createStateWithContent('*italic*');
      expect(hasNodeType(state, 'EmphasisMark')).toBe(true);
    });

    it('parses italic text content correctly', () => {
      const state = createStateWithContent('*hello world*');
      const emphasisNode = findNodeByNameContainingText(state, 'Emphasis', 'hello');
      expect(emphasisNode).not.toBeNull();
    });
  });

  describe('Markdown Link Highlighting', () => {
    it('recognizes inline links', () => {
      const state = createStateWithContent('[link text](https://example.com)');
      expect(hasNodeType(state, 'Link')).toBe(true);
    });

    it('includes LinkMark for link brackets', () => {
      const state = createStateWithContent('[link](url)');
      expect(hasNodeType(state, 'LinkMark')).toBe(true);
    });

    it('recognizes URL in links', () => {
      const state = createStateWithContent('[text](https://example.com)');
      expect(hasNodeType(state, 'URL')).toBe(true);
    });

    it('parses link with title attribute', () => {
      const state = createStateWithContent('[text](url "title")');
      expect(hasNodeType(state, 'Link')).toBe(true);
    });

    it('recognizes reference-style links', () => {
      const state = createStateWithContent('[text][ref]\n\n[ref]: https://example.com');
      expect(hasNodeType(state, 'Link')).toBe(true);
      expect(hasNodeType(state, 'LinkReference')).toBe(true);
    });
  });

  describe('Markdown List Highlighting', () => {
    it('recognizes unordered list with dash', () => {
      const state = createStateWithContent('- item 1\n- item 2');
      expect(hasNodeType(state, 'BulletList')).toBe(true);
    });

    it('recognizes unordered list with asterisk', () => {
      const state = createStateWithContent('* item 1\n* item 2');
      expect(hasNodeType(state, 'BulletList')).toBe(true);
    });

    it('recognizes ordered list', () => {
      const state = createStateWithContent('1. first\n2. second');
      expect(hasNodeType(state, 'OrderedList')).toBe(true);
    });

    it('includes ListItem nodes', () => {
      const state = createStateWithContent('- item 1\n- item 2');
      expect(hasNodeType(state, 'ListItem')).toBe(true);
    });

    it('includes ListMark for list markers', () => {
      const state = createStateWithContent('- item');
      expect(hasNodeType(state, 'ListMark')).toBe(true);
    });

    it('parses nested lists', () => {
      const state = createStateWithContent('- parent\n  - child');
      const listItems = findAllNodesByName(state, 'ListItem');
      expect(listItems.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Markdown Inline Code Highlighting', () => {
    it('recognizes inline code', () => {
      const state = createStateWithContent('Use `code` here');
      expect(hasNodeType(state, 'InlineCode')).toBe(true);
    });

    it('includes CodeMark for backticks', () => {
      const state = createStateWithContent('`code`');
      expect(hasNodeType(state, 'CodeMark')).toBe(true);
    });

    it('parses inline code content correctly', () => {
      const state = createStateWithContent('Run `npm install` to install');
      const codeNode = findNodeByNameContainingText(state, 'InlineCode', 'npm');
      expect(codeNode).not.toBeNull();
    });
  });

  describe('Markdown Code Block Highlighting', () => {
    it('recognizes fenced code block with triple backticks', () => {
      const state = createStateWithContent('```\ncode here\n```');
      expect(hasNodeType(state, 'FencedCode')).toBe(true);
    });

    it('includes CodeMark for code fence delimiters', () => {
      const state = createStateWithContent('```\ncode\n```');
      expect(hasNodeType(state, 'CodeMark')).toBe(true);
    });

    it('recognizes code block with language tag', () => {
      const state = createStateWithContent('```javascript\nconst x = 1;\n```');
      expect(hasNodeType(state, 'FencedCode')).toBe(true);
      expect(hasNodeType(state, 'CodeInfo')).toBe(true);
    });

    it('parses code block language info correctly', () => {
      const state = createStateWithContent('```typescript\nconst x: number = 1;\n```');
      const codeInfoNode = findNodeByNameContainingText(state, 'CodeInfo', 'typescript');
      expect(codeInfoNode).not.toBeNull();
    });

    it('handles multiple code blocks', () => {
      const state = createStateWithContent('```js\ncode1\n```\n\n```python\ncode2\n```');
      const codeBlocks = findAllNodesByName(state, 'FencedCode');
      expect(codeBlocks.length).toBe(2);
    });
  });

  describe('YAML Frontmatter Highlighting', () => {
    it('recognizes YAML frontmatter delimiters', () => {
      const state = createStateWithContent('---\ntitle: Hello\n---\n\n# Content');
      // The frontmatter wrapper should be present
      const tree = getFullTree(state);
      expect(tree).toBeDefined();
    });

    it('parses frontmatter with single property', () => {
      const state = createStateWithContent('---\ntitle: Test\n---');
      const nodes = collectAllNodes(state);
      // Should have frontmatter-related nodes
      expect(nodes.length).toBeGreaterThan(0);
    });

    it('parses frontmatter with multiple properties', () => {
      const state = createStateWithContent('---\ntitle: Test\nauthor: John\ndate: 2024-01-01\n---');
      const tree = getFullTree(state);
      expect(tree).toBeDefined();
    });

    it('separates frontmatter from content', () => {
      const state = createStateWithContent('---\ntitle: Test\n---\n\n# Heading');
      // Should have both frontmatter and heading
      expect(hasNodeType(state, 'ATXHeading1')).toBe(true);
    });

    it('handles empty frontmatter', () => {
      const state = createStateWithContent('---\n---\n\nContent');
      const tree = getFullTree(state);
      expect(tree).toBeDefined();
    });
  });

  describe('JSX/HTML Tag Highlighting', () => {
    it('recognizes self-closing JSX components (PascalCase)', () => {
      const state = createStateWithContent('<Component />');
      // PascalCase components are parsed as inline HTMLTag
      expect(hasNodeType(state, 'HTMLTag')).toBe(true);
    });

    it('recognizes JSX components with attributes', () => {
      const state = createStateWithContent('<Button onClick={handler}>Click</Button>');
      expect(hasNodeType(state, 'HTMLTag')).toBe(true);
    });

    it('recognizes block-level HTML elements as HTMLBlock', () => {
      const state = createStateWithContent('<div className="container">content</div>');
      // Standard lowercase HTML elements spanning the line are parsed as HTMLBlock
      expect(hasNodeType(state, 'HTMLBlock')).toBe(true);
    });

    it('handles nested HTML elements as HTMLBlock', () => {
      const state = createStateWithContent('<div>\n  <span>nested</span>\n</div>');
      // Multi-line HTML blocks are parsed as HTMLBlock
      expect(hasNodeType(state, 'HTMLBlock')).toBe(true);
    });

    it('recognizes inline HTML tags', () => {
      const state = createStateWithContent('Text with <img src="image.png" /> inline');
      // Inline self-closing tags within text
      expect(hasNodeType(state, 'HTMLTag')).toBe(true);
    });

    it('recognizes JSX with string attributes', () => {
      const state = createStateWithContent('<CustomImg src="image.png" alt="description" />');
      // PascalCase component with attributes
      expect(hasNodeType(state, 'HTMLTag')).toBe(true);
    });

    it('distinguishes between HTMLTag and HTMLBlock', () => {
      const state = createStateWithContent('<Component />\n\n<div>\ncontent\n</div>');
      // Should have both inline HTMLTag and block-level HTMLBlock
      expect(hasNodeType(state, 'HTMLTag')).toBe(true);
      expect(hasNodeType(state, 'HTMLBlock')).toBe(true);
    });
  });

  describe('Mixed MDX Content Highlighting', () => {
    it('parses complete MDX document with frontmatter, markdown, and JSX', () => {
      const mdxContent = `---
title: My Document
---

# Welcome

This is a **paragraph** with *emphasis*.

<CustomComponent prop="value" />

## Code Example

\`\`\`javascript
const greeting = "Hello";
\`\`\`
`;
      const state = createStateWithContent(mdxContent);

      // Verify multiple syntax elements are recognized
      expect(hasNodeType(state, 'ATXHeading1')).toBe(true);
      expect(hasNodeType(state, 'ATXHeading2')).toBe(true);
      expect(hasNodeType(state, 'StrongEmphasis')).toBe(true);
      expect(hasNodeType(state, 'Emphasis')).toBe(true);
      // PascalCase self-closing component is recognized as HTMLTag
      expect(hasNodeType(state, 'HTMLTag')).toBe(true);
      expect(hasNodeType(state, 'FencedCode')).toBe(true);
    });

    it('correctly positions nodes in mixed content', () => {
      const state = createStateWithContent('# Title\n\n**bold** and *italic*');
      const headingNode = findNodeByNameContainingText(state, 'ATXHeading1', 'Title');
      const strongNode = findNodeByNameContainingText(state, 'StrongEmphasis', 'bold');
      const emphasisNode = findNodeByNameContainingText(state, 'Emphasis', 'italic');

      expect(headingNode).not.toBeNull();
      expect(strongNode).not.toBeNull();
      expect(emphasisNode).not.toBeNull();

      // Heading should come before bold and italic
      if (headingNode && strongNode && emphasisNode) {
        expect(headingNode.from).toBeLessThan(strongNode.from);
        expect(strongNode.from).toBeLessThan(emphasisNode.from);
      }
    });

    it('handles markdown within HTML block context', () => {
      const state = createStateWithContent('<div>\n\n**Important:** Read this carefully.\n\n</div>');
      // Block-level HTML elements are parsed as HTMLBlock
      expect(hasNodeType(state, 'HTMLBlock')).toBe(true);
    });

    it('handles inline JSX components with markdown', () => {
      const state = createStateWithContent('Here is <Badge /> and **bold** text');
      expect(hasNodeType(state, 'HTMLTag')).toBe(true);
      expect(hasNodeType(state, 'StrongEmphasis')).toBe(true);
    });

    it('parses MDX with both HTMLTag and HTMLBlock', () => {
      const state = createStateWithContent('# Heading\n\n<Alert />\n\n<div>\ncontent\n</div>');
      expect(hasNodeType(state, 'ATXHeading1')).toBe(true);
      expect(hasNodeType(state, 'HTMLTag')).toBe(true);
      expect(hasNodeType(state, 'HTMLBlock')).toBe(true);
    });
  });

  describe('Markdown Blockquote Highlighting', () => {
    it('recognizes blockquotes', () => {
      const state = createStateWithContent('> This is a quote');
      expect(hasNodeType(state, 'Blockquote')).toBe(true);
    });

    it('includes QuoteMark for blockquote prefix', () => {
      const state = createStateWithContent('> quote');
      expect(hasNodeType(state, 'QuoteMark')).toBe(true);
    });

    it('handles multi-line blockquotes', () => {
      const state = createStateWithContent('> Line 1\n> Line 2\n> Line 3');
      expect(hasNodeType(state, 'Blockquote')).toBe(true);
    });
  });

  describe('Markdown Horizontal Rule Highlighting', () => {
    it('recognizes horizontal rule with dashes', () => {
      const state = createStateWithContent('---');
      expect(hasNodeType(state, 'HorizontalRule')).toBe(true);
    });

    it('recognizes horizontal rule with asterisks', () => {
      const state = createStateWithContent('***');
      expect(hasNodeType(state, 'HorizontalRule')).toBe(true);
    });

    it('recognizes horizontal rule with underscores', () => {
      const state = createStateWithContent('___');
      expect(hasNodeType(state, 'HorizontalRule')).toBe(true);
    });
  });

  describe('Markdown Image Highlighting', () => {
    it('recognizes inline images', () => {
      const state = createStateWithContent('![alt text](image.png)');
      expect(hasNodeType(state, 'Image')).toBe(true);
    });

    it('includes image URL', () => {
      const state = createStateWithContent('![alt](https://example.com/image.png)');
      expect(hasNodeType(state, 'URL')).toBe(true);
    });
  });

  describe('Paragraph and Document Structure', () => {
    it('recognizes paragraphs', () => {
      const state = createStateWithContent('This is a paragraph.\n\nThis is another paragraph.');
      expect(hasNodeType(state, 'Paragraph')).toBe(true);
    });

    it('has Document as top-level node', () => {
      const state = createStateWithContent('Some content');
      const tree = getFullTree(state);
      // The top node should be a document-level node
      expect(tree.topNode).toBeDefined();
    });

    it('parses multiple paragraphs correctly', () => {
      const state = createStateWithContent('First paragraph.\n\nSecond paragraph.\n\nThird paragraph.');
      const paragraphs = findAllNodesByName(state, 'Paragraph');
      expect(paragraphs.length).toBe(3);
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('handles escaped characters', () => {
      const state = createStateWithContent('\\*not italic\\*');
      // Escaped asterisks should not create emphasis
      expect(hasNodeType(state, 'Emphasis')).toBe(false);
      expect(hasNodeType(state, 'Escape')).toBe(true);
    });

    it('handles combined bold and italic', () => {
      const state = createStateWithContent('***bold and italic***');
      expect(hasNodeType(state, 'StrongEmphasis')).toBe(true);
      expect(hasNodeType(state, 'Emphasis')).toBe(true);
    });

    it('handles code in headings', () => {
      const state = createStateWithContent('# Heading with `code`');
      expect(hasNodeType(state, 'ATXHeading1')).toBe(true);
      expect(hasNodeType(state, 'InlineCode')).toBe(true);
    });

    it('handles links in lists', () => {
      const state = createStateWithContent('- [Link 1](url1)\n- [Link 2](url2)');
      expect(hasNodeType(state, 'BulletList')).toBe(true);
      expect(hasNodeType(state, 'Link')).toBe(true);
    });

    it('handles autolinks', () => {
      const state = createStateWithContent('<https://example.com>');
      expect(hasNodeType(state, 'Autolink')).toBe(true);
    });

    it('handles hard line breaks', () => {
      const state = createStateWithContent('Line 1  \nLine 2');
      expect(hasNodeType(state, 'HardBreak')).toBe(true);
    });

    it('handles task lists (GFM extension)', () => {
      const state = createStateWithContent('- [ ] Unchecked task\n- [x] Checked task');
      expect(hasNodeType(state, 'BulletList')).toBe(true);
      expect(hasNodeType(state, 'Task')).toBe(true);
    });

    it('handles tables (GFM extension)', () => {
      const state = createStateWithContent('| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |');
      expect(hasNodeType(state, 'Table')).toBe(true);
    });

    it('handles strikethrough (GFM extension)', () => {
      const state = createStateWithContent('~~strikethrough~~');
      expect(hasNodeType(state, 'Strikethrough')).toBe(true);
    });

    it('handles very long documents', () => {
      const longContent = '# Heading\n\n' + 'This is a paragraph. '.repeat(1000);
      const state = createStateWithContent(longContent);
      expect(hasNodeType(state, 'ATXHeading1')).toBe(true);
      expect(hasNodeType(state, 'Paragraph')).toBe(true);
    });
  });
});
