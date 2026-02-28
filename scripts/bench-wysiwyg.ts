/**
 * WYSIWYG Parse/Serialize Benchmark
 *
 * Measures ProseMirror MDX roundtrip performance:
 * - Parse: Markdown text -> ProseMirror document
 * - Serialize: ProseMirror document -> Markdown text
 * - JSX extraction (pre-processing step)
 *
 * Target: < 100ms for parse, < 100ms for serialize on 100KB input.
 *
 * @module scripts/bench-wysiwyg
 */

import { runBenchmarkSuite } from './bench-harness';
import {
  MarkdownParser,
  MarkdownSerializer,
  defaultMarkdownParser,
  defaultMarkdownSerializer,
} from 'prosemirror-markdown';
import { mdxSchema } from '../src/renderer/lib/editor/prosemirror-mdx-schema';
import { extractJsxBlocks } from '../src/renderer/lib/editor/prosemirror-mdx-parser';
import type { Node as ProseMirrorNode } from 'prosemirror-model';

// =============================================================================
// PARSER SETUP
// =============================================================================

/**
 * Corrected token spec (keys without _open suffix, matching prosemirror-markdown
 * convention where the library appends _open/_close automatically).
 */
const MDX_TOKENS: Record<
  string,
  {
    node?: string;
    block?: string;
    mark?: string;
    getAttrs?: (
      token: { attrGet(name: string): string | null; markup: string; info: string },
      tokenStream: unknown[],
      index: number
    ) => Record<string, unknown> | null;
    noCloseToken?: boolean;
    ignore?: boolean;
  }
> = {
  blockquote: { block: 'blockquote' },
  paragraph: { block: 'paragraph' },
  list_item: { block: 'list_item' },
  bullet_list: { block: 'bullet_list' },
  ordered_list: {
    block: 'ordered_list',
    getAttrs: (tok) => ({ order: Number(tok.attrGet('start') ?? 1) }),
  },
  heading: {
    block: 'heading',
    getAttrs: (tok) => ({ level: tok.markup.length }),
  },
  code_block: { block: 'code_block', noCloseToken: true },
  fence: {
    block: 'code_block',
    getAttrs: (tok) => ({ language: tok.info }),
    noCloseToken: true,
  },
  hr: { node: 'horizontal_rule' },
  hardbreak: { node: 'hard_break' },
  image: {
    node: 'image',
    getAttrs: (tok) => ({
      src: tok.attrGet('src') ?? '',
      alt: null,
      title: tok.attrGet('title') ?? null,
    }),
  },
  em: { mark: 'italic' },
  strong: { mark: 'bold' },
  code_inline: { mark: 'code', noCloseToken: true },
  s: { mark: 'strikethrough' },
  link: {
    mark: 'link',
    getAttrs: (tok) => ({
      href: tok.attrGet('href') ?? '',
      title: tok.attrGet('title') ?? null,
    }),
  },
  html_block: { ignore: true },
  html_inline: { ignore: true },
  softbreak: { node: 'hard_break' },
};

const benchParser = new MarkdownParser(mdxSchema, defaultMarkdownParser.tokenizer, MDX_TOKENS);

function parseMdx(content: string) {
  const { processedText } = extractJsxBlocks(content);
  return benchParser.parse(processedText);
}

// =============================================================================
// SERIALIZER SETUP
// =============================================================================

/**
 * Build a serializer from the default prosemirror-markdown serializer, extended
 * with MDX JSX node handlers. Uses the default text handler which the source
 * serializer is currently missing.
 */
const defaultMarks = defaultMarkdownSerializer.marks;
const benchSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    jsx_block(state, node) {
      const value = (node.attrs.value as string) || node.textContent;
      state.write(value);
      state.closeBlock(node);
    },
    jsx_inline(state, node) {
      const value = (node.attrs.value as string) || node.textContent;
      state.write(value);
    },
  },
  {
    // Map our schema's mark names to the default serializer specs
    /* eslint-disable @typescript-eslint/no-non-null-assertion -- defaultMarkdownSerializer always has these marks */
    bold: defaultMarks.strong!,
    italic: defaultMarks.em!,
    code: defaultMarks.code!,
    link: defaultMarks.link!,
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    strikethrough: {
      open: '~~',
      close: '~~',
      mixable: true,
      expelEnclosingWhitespace: true,
    },
  }
);

function serializeMdx(doc: ProseMirrorNode): string {
  return benchSerializer.serialize(doc);
}

// =============================================================================
// TEST DATA GENERATION
// =============================================================================

const TARGET_SIZE_KB = 100;

/**
 * Generate a realistic Markdown document of approximately the target size.
 * Includes headings, paragraphs, lists, code blocks, links, bold, italic.
 */
function generateMarkdown(targetBytes: number): string {
  const blocks: string[] = [];
  let currentSize = 0;

  const paragraphs = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    'The **quick brown fox** jumps over the *lazy dog*. This sentence contains `inline code` and a [link](https://example.com) for testing mark serialization.',
    'Here is some ~~strikethrough text~~ and more **bold** mixed with *italic* formatting that exercises the mark serializer thoroughly.',
  ];

  let sectionIdx = 0;
  while (currentSize < targetBytes) {
    sectionIdx++;
    const level = ((sectionIdx - 1) % 3) + 1;
    const heading = `${'#'.repeat(level)} Section ${sectionIdx}\n\n`;
    blocks.push(heading);
    currentSize += heading.length;

    const paraText = paragraphs[sectionIdx % paragraphs.length] ?? '';
    const para = paraText + '\n\n';
    blocks.push(para);
    currentSize += para.length;

    if (sectionIdx % 3 === 0 && currentSize < targetBytes) {
      const list =
        '- Item one with **bold**\n- Item two with *italic*\n- Item three with `code`\n\n';
      blocks.push(list);
      currentSize += list.length;
    }

    if (sectionIdx % 5 === 0 && currentSize < targetBytes) {
      const codeBlock = '```typescript\nconst x = 42;\nconsole.log(x);\n```\n\n';
      blocks.push(codeBlock);
      currentSize += codeBlock.length;
    }

    if (sectionIdx % 7 === 0 && currentSize < targetBytes) {
      const quote =
        '> This is a blockquote with important information.\n> It spans multiple lines.\n\n';
      blocks.push(quote);
      currentSize += quote.length;
    }
  }

  return blocks.join('');
}

// =============================================================================
// BENCHMARK
// =============================================================================

const markdown100kb = generateMarkdown(TARGET_SIZE_KB * 1024);

const parsedDoc = parseMdx(markdown100kb);

console.error(`Generated test document: ${(markdown100kb.length / 1024).toFixed(1)}KB`);

runBenchmarkSuite('WYSIWYG Parse/Serialize', [
  {
    name: `Parse ${TARGET_SIZE_KB}KB Markdown -> ProseMirror`,
    thresholdMs: 100,
    iterations: 50,
    warmupIterations: 5,
    fn: () => {
      parseMdx(markdown100kb);
    },
  },
  {
    name: `Serialize ProseMirror -> Markdown (from ${TARGET_SIZE_KB}KB)`,
    thresholdMs: 100,
    iterations: 50,
    warmupIterations: 5,
    fn: () => {
      serializeMdx(parsedDoc);
    },
  },
  {
    name: `Extract JSX blocks from ${TARGET_SIZE_KB}KB`,
    thresholdMs: 100,
    iterations: 100,
    warmupIterations: 10,
    fn: () => {
      extractJsxBlocks(markdown100kb);
    },
  },
]).catch((err: unknown) => {
  console.error('Benchmark suite failed:', err);
  process.exit(1);
});
