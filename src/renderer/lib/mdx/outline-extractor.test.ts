/**
 * Outline Extractor Tests
 *
 * Tests for extractOutline function that extracts headings, components,
 * and frontmatter from MDAST trees.
 *
 * @module renderer/lib/mdx/outline-extractor.test
 */

import { describe, it, expect } from 'vitest';
import type { Root, Heading, Paragraph, Text } from 'mdast';
import { extractOutline, createEmptyOutline } from './outline-extractor';
import type { OutlineAST } from '@shared/types/outline';

// ============================================================================
// Test Helpers - MDAST Node Builders
// ============================================================================

/**
 * Create a text node.
 */
function text(value: string): Text {
  return { type: 'text', value };
}

/**
 * Create a heading node with text content.
 */
function heading(
  depth: 1 | 2 | 3 | 4 | 5 | 6,
  textContent: string,
  line = 1,
  column = 1
): Heading {
  return {
    type: 'heading',
    depth,
    children: [text(textContent)],
    position: {
      start: { line, column, offset: 0 },
      end: { line, column: column + textContent.length, offset: 0 },
    },
  };
}

/**
 * Create a paragraph node.
 */
function paragraph(textContent: string): Paragraph {
  return {
    type: 'paragraph',
    children: [text(textContent)],
  };
}

/**
 * Create a YAML frontmatter node.
 */
function yaml(value: string, startLine = 1, endLine = 3): {
  type: 'yaml';
  value: string;
  position: { start: { line: number; column: number }; end: { line: number; column: number } };
} {
  return {
    type: 'yaml',
    value,
    position: {
      start: { line: startLine, column: 1 },
      end: { line: endLine, column: 1 },
    },
  };
}

/**
 * Create an MDX JSX flow element node.
 */
function mdxJsxFlowElement(
  name: string | null,
  line = 1,
  column = 1,
  children: unknown[] = []
): {
  type: 'mdxJsxFlowElement';
  name: string | null;
  attributes: unknown[];
  children: unknown[];
  position: { start: { line: number; column: number }; end: { line: number; column: number } };
} {
  return {
    type: 'mdxJsxFlowElement',
    name,
    attributes: [],
    children,
    position: {
      start: { line, column },
      end: { line, column: column + 10 },
    },
  };
}

/**
 * Create an MDX JSX text element node.
 */
function mdxJsxTextElement(
  name: string | null,
  line = 1,
  column = 1
): {
  type: 'mdxJsxTextElement';
  name: string | null;
  attributes: unknown[];
  children: unknown[];
  position: { start: { line: number; column: number }; end: { line: number; column: number } };
} {
  return {
    type: 'mdxJsxTextElement',
    name,
    attributes: [],
    children: [],
    position: {
      start: { line, column },
      end: { line, column: column + 10 },
    },
  };
}

/**
 * Create a root node with children.
 */
function root(...children: unknown[]): Root {
  return {
    type: 'root',
    children: children as Root['children'],
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('extractOutline', () => {
  describe('empty and minimal documents', () => {
    it('should return empty outline for empty root', () => {
      const tree = root();
      const outline = extractOutline(tree);

      expect(outline.headings).toEqual([]);
      expect(outline.components).toEqual([]);
      expect(outline.frontmatter).toBeNull();
    });

    it('should return empty outline for root with only paragraphs', () => {
      const tree = root(
        paragraph('Some text'),
        paragraph('More text')
      );
      const outline = extractOutline(tree);

      expect(outline.headings).toEqual([]);
      expect(outline.components).toEqual([]);
      expect(outline.frontmatter).toBeNull();
    });
  });

  describe('heading extraction', () => {
    it('should extract a single h1 heading', () => {
      const tree = root(heading(1, 'Title', 1, 1));
      const outline = extractOutline(tree);

      expect(outline.headings).toHaveLength(1);
      expect(outline.headings[0]).toEqual({
        depth: 1,
        text: 'Title',
        position: { line: 1, column: 1 },
      });
    });

    it('should extract headings at all levels (h1-h6)', () => {
      const tree = root(
        heading(1, 'H1', 1, 1),
        heading(2, 'H2', 3, 1),
        heading(3, 'H3', 5, 1),
        heading(4, 'H4', 7, 1),
        heading(5, 'H5', 9, 1),
        heading(6, 'H6', 11, 1)
      );
      const outline = extractOutline(tree);

      expect(outline.headings).toHaveLength(6);
      expect(outline.headings.map((h) => h.depth)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(outline.headings.map((h) => h.text)).toEqual(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
    });

    it('should extract multiple headings in document order', () => {
      const tree = root(
        heading(1, 'Introduction', 1, 1),
        paragraph('Some content'),
        heading(2, 'Background', 5, 1),
        paragraph('More content'),
        heading(2, 'Methods', 10, 1),
        heading(3, 'Data Collection', 12, 1)
      );
      const outline = extractOutline(tree);

      expect(outline.headings).toHaveLength(4);
      expect(outline.headings.map((h) => h.text)).toEqual([
        'Introduction',
        'Background',
        'Methods',
        'Data Collection',
      ]);
    });

    it('should preserve heading positions', () => {
      const tree = root(
        heading(1, 'Title', 5, 3),
        heading(2, 'Section', 10, 5)
      );
      const outline = extractOutline(tree);

      expect(outline.headings[0]?.position).toEqual({ line: 5, column: 3 });
      expect(outline.headings[1]?.position).toEqual({ line: 10, column: 5 });
    });

    it('should handle heading with empty text (skip it)', () => {
      const emptyHeading: Heading = {
        type: 'heading',
        depth: 1,
        children: [],
        position: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
      };
      const tree = root(emptyHeading, heading(2, 'Valid', 3, 1));
      const outline = extractOutline(tree);

      expect(outline.headings).toHaveLength(1);
      expect(outline.headings[0]?.text).toBe('Valid');
    });

    it('should handle heading with whitespace-only text (skip it)', () => {
      const whitespaceHeading: Heading = {
        type: 'heading',
        depth: 1,
        children: [text('   \t\n  ')],
        position: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
      };
      const tree = root(whitespaceHeading, heading(2, 'Valid', 3, 1));
      const outline = extractOutline(tree);

      expect(outline.headings).toHaveLength(1);
      expect(outline.headings[0]?.text).toBe('Valid');
    });

    it('should extract text from nested phrasing content', () => {
      // Heading with emphasis: # Hello *world*
      const headingWithEmphasis: Heading = {
        type: 'heading',
        depth: 1,
        children: [
          text('Hello '),
          {
            type: 'emphasis',
            children: [text('world')],
          },
        ],
        position: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 15, offset: 0 } },
      };
      const tree = root(headingWithEmphasis);
      const outline = extractOutline(tree);

      expect(outline.headings).toHaveLength(1);
      expect(outline.headings[0]?.text).toBe('Hello world');
    });

    it('should handle heading with deeply nested text', () => {
      // Heading with: # **`code` text**
      const complexHeading = {
        type: 'heading' as const,
        depth: 2 as const,
        children: [
          {
            type: 'strong',
            children: [
              { type: 'inlineCode', value: 'code' },
              text(' text'),
            ],
          },
        ],
        position: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 20, offset: 0 } },
      };
      const tree = root(complexHeading);
      const outline = extractOutline(tree);

      expect(outline.headings).toHaveLength(1);
      // Only extracts 'text' nodes, not inlineCode
      expect(outline.headings[0]?.text).toBe('text');
    });
  });

  describe('component extraction', () => {
    it('should extract a single MDX JSX flow element', () => {
      const tree = root(mdxJsxFlowElement('Button', 5, 1));
      const outline = extractOutline(tree);

      expect(outline.components).toHaveLength(1);
      expect(outline.components[0]).toEqual({
        name: 'Button',
        position: { line: 5, column: 1 },
      });
    });

    it('should extract MDX JSX text elements', () => {
      const paragraphWithJsx: Paragraph = {
        type: 'paragraph',
        children: [
          text('Click '),
          mdxJsxTextElement('Link', 3, 7) as unknown as Text,
          text(' here'),
        ],
      };
      const tree = root(paragraphWithJsx);
      const outline = extractOutline(tree);

      expect(outline.components).toHaveLength(1);
      expect(outline.components[0]?.name).toBe('Link');
    });

    it('should extract multiple components in document order', () => {
      const tree = root(
        mdxJsxFlowElement('Header', 1, 1),
        paragraph('content'),
        mdxJsxFlowElement('Card', 5, 1),
        mdxJsxFlowElement('Footer', 10, 1)
      );
      const outline = extractOutline(tree);

      expect(outline.components).toHaveLength(3);
      expect(outline.components.map((c) => c.name)).toEqual(['Header', 'Card', 'Footer']);
    });

    it('should extract nested components', () => {
      const nested = mdxJsxFlowElement('Inner', 3, 5);
      const outer = mdxJsxFlowElement('Outer', 1, 1, [nested]);
      const tree = root(outer);
      const outline = extractOutline(tree);

      expect(outline.components).toHaveLength(2);
      expect(outline.components.map((c) => c.name)).toEqual(['Outer', 'Inner']);
    });

    it('should skip JSX fragments (name is null)', () => {
      const tree = root(
        mdxJsxFlowElement(null, 1, 1), // Fragment
        mdxJsxFlowElement('RealComponent', 5, 1)
      );
      const outline = extractOutline(tree);

      expect(outline.components).toHaveLength(1);
      expect(outline.components[0]?.name).toBe('RealComponent');
    });

    it('should preserve component positions', () => {
      const tree = root(
        mdxJsxFlowElement('First', 10, 5),
        mdxJsxFlowElement('Second', 20, 3)
      );
      const outline = extractOutline(tree);

      expect(outline.components[0]?.position).toEqual({ line: 10, column: 5 });
      expect(outline.components[1]?.position).toEqual({ line: 20, column: 3 });
    });
  });

  describe('frontmatter extraction', () => {
    it('should extract simple key-value frontmatter', () => {
      const tree = root(yaml('title: Hello World\ndate: 2024-01-15', 1, 4));
      const outline = extractOutline(tree);

      expect(outline.frontmatter).not.toBeNull();
      expect(outline.frontmatter?.data).toEqual({
        title: 'Hello World',
        date: '2024-01-15',
      });
      expect(outline.frontmatter?.endLine).toBe(4);
    });

    it('should parse boolean values', () => {
      const tree = root(yaml('published: true\ndraft: false', 1, 4));
      const outline = extractOutline(tree);

      expect(outline.frontmatter?.data).toEqual({
        published: true,
        draft: false,
      });
    });

    it('should parse integer values', () => {
      const tree = root(yaml('count: 42\nnegative: -10', 1, 4));
      const outline = extractOutline(tree);

      expect(outline.frontmatter?.data).toEqual({
        count: 42,
        negative: -10,
      });
    });

    it('should parse float values', () => {
      const tree = root(yaml('price: 19.99\nrate: -0.5', 1, 4));
      const outline = extractOutline(tree);

      expect(outline.frontmatter?.data).toEqual({
        price: 19.99,
        rate: -0.5,
      });
    });

    it('should parse array values', () => {
      const tree = root(yaml('tags:\n- typescript\n- react\n- mdx', 1, 6));
      const outline = extractOutline(tree);

      expect(outline.frontmatter?.data.tags).toEqual(['typescript', 'react', 'mdx']);
    });

    it('should strip quotes from string values', () => {
      const tree = root(yaml('title: "Quoted Title"\nsingle: \'Single Quoted\'', 1, 4));
      const outline = extractOutline(tree);

      expect(outline.frontmatter?.data).toEqual({
        title: 'Quoted Title',
        single: 'Single Quoted',
      });
    });

    it('should merge pre-parsed frontmatter data', () => {
      const tree = root(yaml('title: From YAML', 1, 3));
      const preParsed = { extra: 'pre-parsed value', title: 'Overridden' };
      const outline = extractOutline(tree, preParsed);

      expect(outline.frontmatter?.data).toEqual({
        title: 'Overridden', // Pre-parsed takes precedence
        extra: 'pre-parsed value',
      });
    });

    it('should use pre-parsed frontmatter when no YAML node exists', () => {
      const tree = root(heading(1, 'Title', 1, 1));
      const preParsed = { title: 'Pre-parsed', date: '2024-01-15' };
      const outline = extractOutline(tree, preParsed);

      expect(outline.frontmatter).not.toBeNull();
      expect(outline.frontmatter?.data).toEqual(preParsed);
      expect(outline.frontmatter?.endLine).toBe(0);
    });

    it('should handle empty frontmatter object', () => {
      const tree = root(heading(1, 'Title', 1, 1));
      const outline = extractOutline(tree, {});

      expect(outline.frontmatter).toBeNull();
    });

    it('should handle frontmatter with empty lines', () => {
      const tree = root(yaml('title: Test\n\nauthor: Jane', 1, 5));
      const outline = extractOutline(tree);

      expect(outline.frontmatter?.data).toEqual({
        title: 'Test',
        author: 'Jane',
      });
    });
  });

  describe('combined extraction', () => {
    it('should extract headings, components, and frontmatter together', () => {
      const tree = root(
        yaml('title: My Document\ntags:\n- mdx\n- outline', 1, 6),
        heading(1, 'Introduction', 8, 1),
        paragraph('Some text'),
        mdxJsxFlowElement('Callout', 12, 1),
        heading(2, 'Details', 15, 1),
        mdxJsxFlowElement('CodeBlock', 18, 1)
      );

      const outline = extractOutline(tree);

      // Check frontmatter
      expect(outline.frontmatter?.data).toEqual({
        title: 'My Document',
        tags: ['mdx', 'outline'],
      });

      // Check headings
      expect(outline.headings).toHaveLength(2);
      expect(outline.headings.map((h) => h.text)).toEqual(['Introduction', 'Details']);

      // Check components
      expect(outline.components).toHaveLength(2);
      expect(outline.components.map((c) => c.name)).toEqual(['Callout', 'CodeBlock']);
    });

    it('should handle document with only components', () => {
      const tree = root(
        mdxJsxFlowElement('App', 1, 1),
        mdxJsxFlowElement('Footer', 10, 1)
      );
      const outline = extractOutline(tree);

      expect(outline.headings).toHaveLength(0);
      expect(outline.frontmatter).toBeNull();
      expect(outline.components).toHaveLength(2);
    });

    it('should handle document with only frontmatter', () => {
      const tree = root(yaml('title: Metadata Only', 1, 3));
      const outline = extractOutline(tree);

      expect(outline.headings).toHaveLength(0);
      expect(outline.components).toHaveLength(0);
      expect(outline.frontmatter?.data.title).toBe('Metadata Only');
    });
  });

  describe('position handling', () => {
    it('should use default position when node has no position', () => {
      const headingWithoutPos: Heading = {
        type: 'heading',
        depth: 1,
        children: [text('No Position')],
        // No position property
      };
      const tree = root(headingWithoutPos);
      const outline = extractOutline(tree);

      expect(outline.headings[0]?.position).toEqual({ line: 1, column: 1 });
    });

    it('should handle component without position', () => {
      const jsxWithoutPos = {
        type: 'mdxJsxFlowElement',
        name: 'NoPos',
        attributes: [],
        children: [],
        // No position
      };
      const tree = root(jsxWithoutPos);
      const outline = extractOutline(tree);

      expect(outline.components[0]?.position).toEqual({ line: 1, column: 1 });
    });
  });
});

describe('createEmptyOutline', () => {
  it('should return empty outline structure', () => {
    const outline = createEmptyOutline();

    expect(outline).toEqual({
      headings: [],
      components: [],
      frontmatter: null,
    });
  });

  it('should return a new object each time', () => {
    const outline1 = createEmptyOutline();
    const outline2 = createEmptyOutline();

    expect(outline1).not.toBe(outline2);
  });
});
