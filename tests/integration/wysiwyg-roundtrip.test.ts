/**
 * ProseMirror MDX Schema Structure, JSX Extraction, and Parse/Serialize Tests
 *
 * Tests the ProseMirror MDX schema node types, mark types, document
 * structure constraints, the `extractJsxBlocks` utility, and one
 * `mdxParser.parse` / `serializeMdxContent` round-trip.
 *
 * Schema and JSX cases exercise the schema object and the extractor
 * directly. The parse/serialize case uses the same pair `useEditorView`
 * calls. No ProseMirror EditorView is instantiated and WYSIWYG is not
 * mounted. Lists serialize tight, so idempotence is checked on the
 * serialized text rather than the original source bytes.
 *
 * @vitest-environment happy-dom
 * @module tests/integration/wysiwyg-roundtrip.test
 */

import { describe, it, expect } from 'vitest';

import { extractJsxBlocks, mdxParser } from '@renderer/lib/editor/prosemirror-mdx-parser';
import { mdxSchema } from '@renderer/lib/editor/prosemirror-mdx-schema';
import { serializeMdxContent } from '@renderer/lib/editor/prosemirror-mdx-serializer';

// ---------------------------------------------------------------------------
// Schema structure tests
// ---------------------------------------------------------------------------

describe('WYSIWYG Schema Structure', () => {
  describe('node types', () => {
    it('should define all expected node types', () => {
      const nodeTypes = Object.keys(mdxSchema.nodes);
      expect(nodeTypes).toContain('doc');
      expect(nodeTypes).toContain('paragraph');
      expect(nodeTypes).toContain('heading');
      expect(nodeTypes).toContain('code_block');
      expect(nodeTypes).toContain('blockquote');
      expect(nodeTypes).toContain('horizontal_rule');
      expect(nodeTypes).toContain('ordered_list');
      expect(nodeTypes).toContain('bullet_list');
      expect(nodeTypes).toContain('list_item');
      expect(nodeTypes).toContain('image');
      expect(nodeTypes).toContain('hard_break');
      expect(nodeTypes).toContain('jsx_block');
      expect(nodeTypes).toContain('jsx_inline');
      expect(nodeTypes).toContain('text');
    });

    it('should have heading node with level attribute defaulting to 1', () => {
      const headingType = mdxSchema.nodes.heading;
      expect(headingType).toBeDefined();
      expect(headingType?.spec.attrs?.level?.default).toBe(1);
    });

    it('should have code_block node with language attribute', () => {
      const codeBlockType = mdxSchema.nodes.code_block;
      expect(codeBlockType).toBeDefined();
      expect(codeBlockType?.spec.attrs?.language?.default).toBe('');
    });

    it('should have image node with src, alt, title attributes', () => {
      const imageType = mdxSchema.nodes.image;
      expect(imageType).toBeDefined();
      expect(imageType?.spec.attrs?.src?.default).toBe('');
      expect(imageType?.spec.attrs?.alt?.default).toBeNull();
      expect(imageType?.spec.attrs?.title?.default).toBeNull();
    });

    it('should have ordered_list node with order attribute', () => {
      const olType = mdxSchema.nodes.ordered_list;
      expect(olType).toBeDefined();
      expect(olType?.spec.attrs?.order?.default).toBe(1);
    });

    it('should have jsx_block and jsx_inline nodes with value attribute', () => {
      const jsxBlock = mdxSchema.nodes.jsx_block;
      const jsxInline = mdxSchema.nodes.jsx_inline;
      expect(jsxBlock?.spec.attrs?.value?.default).toBe('');
      expect(jsxInline?.spec.attrs?.value?.default).toBe('');
    });

    it('should mark jsx_block as code (non-editable inline)', () => {
      const jsxBlock = mdxSchema.nodes.jsx_block;
      expect(jsxBlock?.spec.code).toBe(true);
      expect(jsxBlock?.spec.defining).toBe(true);
    });

    it('should mark jsx_inline as inline', () => {
      const jsxInline = mdxSchema.nodes.jsx_inline;
      expect(jsxInline?.spec.inline).toBe(true);
    });

    it('should mark code_block as code', () => {
      const codeBlock = mdxSchema.nodes.code_block;
      expect(codeBlock?.spec.code).toBe(true);
    });

    it('should make image node draggable', () => {
      const imageType = mdxSchema.nodes.image;
      expect(imageType?.spec.draggable).toBe(true);
    });
  });

  describe('mark types', () => {
    it('should define all expected mark types', () => {
      const markTypes = Object.keys(mdxSchema.marks);
      expect(markTypes).toContain('bold');
      expect(markTypes).toContain('italic');
      expect(markTypes).toContain('code');
      expect(markTypes).toContain('link');
      expect(markTypes).toContain('strikethrough');
    });

    it('should have link mark with href and title attributes', () => {
      const linkMark = mdxSchema.marks.link;
      expect(linkMark).toBeDefined();
      expect(linkMark?.spec.attrs?.href?.default).toBe('');
      expect(linkMark?.spec.attrs?.title?.default).toBeNull();
    });

    it('should make link mark non-inclusive', () => {
      const linkMark = mdxSchema.marks.link;
      expect(linkMark?.spec.inclusive).toBe(false);
    });
  });

  describe('document structure constraints', () => {
    it('should allow doc to contain block+ nodes', () => {
      expect(mdxSchema.nodes.doc?.spec.content).toBe('block+');
    });

    it('should mark paragraph as block group', () => {
      expect(mdxSchema.nodes.paragraph?.spec.group).toBe('block');
    });

    it('should mark heading as block group', () => {
      expect(mdxSchema.nodes.heading?.spec.group).toBe('block');
    });

    it('should mark text as inline group', () => {
      expect(mdxSchema.nodes.text?.spec.group).toBe('inline');
    });

    it('should require list_item content to start with paragraph', () => {
      const listItemContent = mdxSchema.nodes.list_item?.spec.content;
      expect(listItemContent).toContain('paragraph');
    });
  });
});

// ---------------------------------------------------------------------------
// JSX extraction tests
// ---------------------------------------------------------------------------

describe('JSX Extraction', () => {
  it('should extract self-closing JSX blocks', () => {
    const input = 'Hello\n\n<MyComponent prop="value" />\n\nWorld';
    const { processedText, jsxBlocks } = extractJsxBlocks(input);

    expect(jsxBlocks).toHaveLength(1);
    expect(jsxBlocks[0]).toBe('<MyComponent prop="value" />');
    expect(processedText).toContain('```mdxpad-jsx');
    expect(processedText).toContain('<MyComponent prop="value" />');
  });

  it('should extract paired JSX blocks', () => {
    const input = '<Card title="test">Content here</Card>';
    const { processedText, jsxBlocks } = extractJsxBlocks(input);

    expect(jsxBlocks).toHaveLength(1);
    expect(jsxBlocks[0]).toContain('<Card');
    expect(jsxBlocks[0]).toContain('</Card>');
    expect(processedText).toContain('```mdxpad-jsx');
    expect(processedText).toContain('<Card');
  });

  it('should return empty array for content without JSX', () => {
    const input = '# Hello\n\nJust plain markdown.';
    const { processedText, jsxBlocks } = extractJsxBlocks(input);

    expect(jsxBlocks).toHaveLength(0);
    expect(processedText).toBe(input);
  });

  it('should handle multiple JSX blocks', () => {
    const input = '<Alert />\n\nSome text\n\n<Banner />';
    const { jsxBlocks } = extractJsxBlocks(input);

    expect(jsxBlocks).toHaveLength(2);
  });

  it('should not extract lowercase HTML tags', () => {
    const input = '<div>This is HTML</div>';
    const { jsxBlocks } = extractJsxBlocks(input);

    // Regex only matches uppercase-starting tags (JSX components)
    expect(jsxBlocks).toHaveLength(0);
  });

  it('should preserve placeholder in processed text', () => {
    const input = '<Widget />';
    const { processedText } = extractJsxBlocks(input);

    expect(processedText).toContain('```mdxpad-jsx');
    expect(processedText).toContain('<Widget />');
  });

  it('should extract JSX with attributes spanning text', () => {
    const input = '<Alert type="warning" />';
    const { jsxBlocks } = extractJsxBlocks(input);

    expect(jsxBlocks).toHaveLength(1);
    expect(jsxBlocks[0]).toContain('type="warning"');
  });

  it('should handle empty content', () => {
    const input = '';
    const { processedText, jsxBlocks } = extractJsxBlocks(input);

    expect(jsxBlocks).toHaveLength(0);
    expect(processedText).toBe('');
  });

  it('should preserve order of extracted JSX blocks', () => {
    const input = '<First />\n\nText\n\n<Second />\n\nMore\n\n<Third />';
    const { jsxBlocks } = extractJsxBlocks(input);

    expect(jsxBlocks).toHaveLength(3);
    expect(jsxBlocks[0]).toContain('First');
    expect(jsxBlocks[1]).toContain('Second');
    expect(jsxBlocks[2]).toContain('Third');
  });
});

// ---------------------------------------------------------------------------
// Parse / serialize round-trip
// ---------------------------------------------------------------------------

const ROUND_TRIP_SOURCE = `# Title

Hello **world** and *there* and \`code\`.

[link](https://example.com)

- one
- two

> quote

---

\`\`\`js
const n = 1;
\`\`\`
`;

describe('WYSIWYG parse/serialize', () => {
  it('round-trips the commonmark fixture through mdxParser and serializeMdxContent', () => {
    const doc = mdxParser.parse(ROUND_TRIP_SOURCE);
    const serialized = serializeMdxContent(doc);

    expect(serialized).toContain('# Title');
    expect(serialized).toContain('**world**');
    expect(serialized).toContain('*there*');
    expect(serialized).toContain('`code`');
    expect(serialized).toContain('](https://example.com)');
    expect(serialized).toContain('- one');
    expect(serialized).toContain('> quote');
    expect(serialized).toContain('---');
    expect(serialized).toContain('```js');

    expect(serializeMdxContent(mdxParser.parse(serialized))).toBe(serialized);
  });
});
