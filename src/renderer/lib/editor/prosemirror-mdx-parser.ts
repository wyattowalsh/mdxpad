/**
 * ProseMirror MDX Parser
 *
 * Parses Markdown/MDX text into a ProseMirror document.
 * Handles standard markdown, GFM extensions, and preserves JSX blocks
 * as opaque nodes.
 *
 * @module renderer/lib/editor/prosemirror-mdx-parser
 */

import MarkdownIt from 'markdown-it';
import { MarkdownParser } from 'prosemirror-markdown';
import { mdxSchema } from './prosemirror-mdx-schema';
import { tableCellAttrs } from './prosemirror-mdx-table';
import { Fragment, type Node as ProseMirrorNode, type Attrs } from 'prosemirror-model';

/**
 * Minimal markdown-it Token interface matching what prosemirror-markdown expects.
 */
interface MarkdownToken {
  readonly type: string;
  readonly tag: string;
  readonly attrs: readonly (readonly [string, string])[] | null;
  readonly map: readonly [number, number] | null;
  readonly nesting: 1 | 0 | -1;
  readonly level: number;
  readonly children: readonly MarkdownToken[] | null;
  readonly content: string;
  readonly markup: string;
  readonly info: string;
  readonly meta: unknown;
  readonly block: boolean;
  readonly hidden: boolean;
  attrGet(name: string): string | null;
  attrIndex(name: string): number;
}

/**
 * Pattern matching JSX block elements (opening tags on their own line).
 * Matches both self-closing and paired JSX tags.
 */
const JSX_BLOCK_REGEX =
  /^(<[A-Z][a-zA-Z0-9]*(?:\s[^>]*)?\/>|<[A-Z][a-zA-Z0-9]*(?:\s[^>]*)?>[\s\S]*?<\/[A-Z][a-zA-Z0-9]*>)$/gm;

/**
 * Placeholder used to preserve JSX blocks during markdown parsing.
 */
const JSX_FENCE_LANGUAGE = 'mdxpad-jsx';

interface JsxExtraction {
  readonly processedText: string;
  readonly jsxBlocks: readonly string[];
}

/**
 * Extract JSX blocks from MDX content, replacing them with placeholders.
 * This allows the markdown parser to handle the remaining content normally.
 */
export function extractJsxBlocks(content: string): JsxExtraction {
  const jsxBlocks: string[] = [];

  const processedText = content.replace(JSX_BLOCK_REGEX, (match) => {
    jsxBlocks.push(match);
    const fence = '`'.repeat(Math.max(3, longestBacktickRun(match) + 1));
    return `\n\n${fence}${JSX_FENCE_LANGUAGE}\n${match}\n${fence}\n\n`;
  });

  return { processedText, jsxBlocks };
}

// =============================================================================
// TOKEN SPECS
// =============================================================================

/**
 * Token specification for prosemirror-markdown's MarkdownParser.
 * Maps markdown-it token types to ProseMirror node/mark types.
 * Extends the default parser with MDX-specific handling.
 */
const MDX_TOKENS: Record<
  string,
  {
    node?: string;
    block?: string;
    mark?: string;
    getAttrs?: (token: MarkdownToken, tokenStream: MarkdownToken[], index: number) => Attrs | null;
    noCloseToken?: boolean;
    ignore?: boolean;
  }
> = {
  // Block tokens
  paragraph: { block: 'paragraph' },
  blockquote: { block: 'blockquote' },
  bullet_list: {
    block: 'bullet_list',
    getAttrs: (_token, tokens, index) => ({ tight: listIsTight(tokens, index) }),
  },
  ordered_list: {
    block: 'ordered_list',
    getAttrs: (tok: MarkdownToken, tokens, index) => ({
      order: Number(tok.attrGet('start') ?? 1),
      tight: listIsTight(tokens, index),
    }),
  },
  list_item: { block: 'list_item' },
  heading: {
    block: 'heading',
    getAttrs: (tok: MarkdownToken) => ({
      level: Number(tok.tag.slice(1)) || tok.markup.length,
    }),
  },
  code_block: {
    block: 'code_block',
    getAttrs: () => ({ language: '', indented: true }),
    noCloseToken: true,
  },
  fence: {
    block: 'code_block',
    getAttrs: (tok: MarkdownToken) => ({ language: tok.info, indented: false }),
    noCloseToken: true,
  },
  hr: {
    node: 'horizontal_rule',
    getAttrs: (tok: MarkdownToken) => ({
      markup: tok.markup === '***' || tok.markup === '___' ? tok.markup : '---',
    }),
  },
  table: { block: 'table' },
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: 'table_row' },
  th: { block: 'table_header', getAttrs: tableCellAttrs },
  td: { block: 'table_cell', getAttrs: tableCellAttrs },

  // Inline marks
  em: { mark: 'italic' },
  strong: { mark: 'bold' },
  code_inline: { mark: 'code', noCloseToken: true },
  s: { mark: 'strikethrough' },

  // Links and images
  link: {
    mark: 'link',
    getAttrs: (tok: MarkdownToken) => ({
      href: tok.attrGet('href') ?? '',
      title: tok.attrGet('title') ?? null,
    }),
  },
  image: {
    node: 'image',
    getAttrs: (tok: MarkdownToken) => ({
      src: tok.attrGet('src') ?? '',
      alt: imageAlt(tok),
      title: tok.attrGet('title') ?? null,
    }),
  },

  html_block: {
    block: 'jsx_block',
    noCloseToken: true,
    getAttrs: (tok: MarkdownToken) => ({
      value: tok.content.endsWith('\n') ? tok.content.slice(0, -1) : tok.content,
    }),
  },
  html_inline: {
    node: 'jsx_inline',
    noCloseToken: true,
    getAttrs: (tok: MarkdownToken) => ({ value: tok.content }),
  },
  hardbreak: { node: 'hard_break', getAttrs: () => ({ hard: true }) },
  softbreak: { node: 'hard_break', getAttrs: () => ({ hard: false }) },
};

function listIsTight(tokens: readonly MarkdownToken[], index: number): boolean {
  let cursor = index;
  while (cursor + 1 < tokens.length) {
    cursor += 1;
    const token = tokens[cursor];
    if (token?.type !== 'list_item_open') {
      return token?.hidden === true;
    }
  }
  return false;
}

function imageAlt(token: MarkdownToken): string {
  if (token.content.length > 0) {
    return token.content;
  }
  const text = token.children?.find((child) => child.type === 'text');
  return text?.content ?? '';
}

const LEADING_FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const LINK_DEFINITION = /^\s{0,3}\[(?!\^)[^\]]+\]:\s+\S/;
const FOOTNOTE_MARK = '\uE010';
const TEX_INLINE_OPEN = '\uE013';
const TEX_INLINE_CLOSE = '\uE014';
const TEX_DISPLAY_OPEN = '\uE015';
const TEX_DISPLAY_CLOSE = '\uE016';

export function protectFootnoteMarkers(value: string): string {
  return value.replaceAll('[^', `${FOOTNOTE_MARK}^`);
}

export function protectTexDelimiters(value: string): string {
  return value
    .replaceAll('\\[', TEX_DISPLAY_OPEN)
    .replaceAll('\\]', TEX_DISPLAY_CLOSE)
    .replaceAll('\\(', TEX_INLINE_OPEN)
    .replaceAll('\\)', TEX_INLINE_CLOSE);
}

function restoreTexDelimiters(value: string): string {
  return value
    .replaceAll(TEX_DISPLAY_OPEN, '\\[')
    .replaceAll(TEX_DISPLAY_CLOSE, '\\]')
    .replaceAll(TEX_INLINE_OPEN, '\\(')
    .replaceAll(TEX_INLINE_CLOSE, '\\)');
}

function hasProtectedMarks(text: string): boolean {
  return (
    text.includes(FOOTNOTE_MARK) ||
    text.includes(TEX_INLINE_OPEN) ||
    text.includes(TEX_INLINE_CLOSE) ||
    text.includes(TEX_DISPLAY_OPEN) ||
    text.includes(TEX_DISPLAY_CLOSE)
  );
}

function restoreFootnoteMarkers(node: ProseMirrorNode): ProseMirrorNode {
  if (node.isText) {
    const text = node.text ?? '';
    if (!hasProtectedMarks(text)) {
      return node;
    }
    return node.type.schema.text(
      restoreTexDelimiters(text.replaceAll(`${FOOTNOTE_MARK}^`, '[^')),
      node.marks
    );
  }
  if (node.childCount === 0 || !hasProtectedMarks(node.textContent)) {
    return node;
  }
  const children: ProseMirrorNode[] = [];
  node.forEach((child) => {
    children.push(restoreFootnoteMarkers(child));
  });
  return node.copy(Fragment.fromArray(children));
}
const FENCE_LINE = /^\s{0,3}(`{3,}|~{3,})/;

export function splitLeadingFrontmatter(content: string): {
  frontmatter: string;
  body: string;
} {
  const match = LEADING_FRONTMATTER.exec(content);
  if (match?.index !== 0) {
    return { frontmatter: '', body: content };
  }
  const frontmatter = match[0].endsWith('\n') ? match[0] : `${match[0]}\n`;
  return { frontmatter, body: content.slice(match[0].length) };
}

export function extractLinkDefinitions(body: string): string {
  const definitions: string[] = [];
  let inFence = false;
  for (const line of body.split('\n')) {
    if (FENCE_LINE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && LINK_DEFINITION.test(line)) {
      definitions.push(line.trim());
    }
  }
  return definitions.join('\n');
}

// =============================================================================
// PARSER
// =============================================================================

/**
 * Create a ProseMirror Markdown parser using the default markdown-it tokenizer
 * from prosemirror-markdown, with our custom MDX schema and token specs.
 */
interface InlineParseState {
  src: string;
  pos: number;
  push: (type: string, tag: string, nesting: number) => { content: string };
}

interface MarkdownTokenizer {
  inline: {
    ruler: {
      before: (
        before: string,
        name: string,
        fn: (state: InlineParseState, silent: boolean) => boolean
      ) => void;
    };
  };
}

function strikethroughRule(state: InlineParseState, silent: boolean): boolean {
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 0x7e || state.src.charCodeAt(start + 1) !== 0x7e) {
    return false;
  }
  const end = state.src.indexOf('~~', start + 2);
  if (end <= start + 2 || state.src.slice(start + 2, end).includes('\n')) {
    return false;
  }
  if (!silent) {
    state.push('s_open', 's', 1);
    const text = state.push('text', '', 0);
    text.content = state.src.slice(start + 2, end);
    state.push('s_close', 's', -1);
  }
  state.pos = end + 2;
  return true;
}

function enableStrikethrough(tokenizer: MarkdownTokenizer): void {
  try {
    tokenizer.inline.ruler.before('emphasis', 'mdxpad_strikethrough', strikethroughRule);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('already exists')) {
      throw error;
    }
  }
}

function longestBacktickRun(value: string): number {
  let longest = 0;
  for (const run of value.match(/`+/g) ?? []) {
    longest = Math.max(longest, run.length);
  }
  return longest;
}

function jsxFenceNode(doc: ProseMirrorNode, value: string): ProseMirrorNode {
  const jsxBlock = doc.type.schema.nodes.jsx_block;
  if (jsxBlock === undefined) {
    throw new Error('JSX block node is missing from the schema');
  }
  const text = value.length > 0 ? doc.type.schema.text(value) : null;
  return jsxBlock.create({ value }, text);
}

function restoreJsxFences(doc: ProseMirrorNode): ProseMirrorNode {
  const children: ProseMirrorNode[] = [];
  let replaced = 0;
  doc.forEach((node) => {
    const language = typeof node.attrs.language === 'string' ? node.attrs.language.trim() : '';
    if (node.type.name !== 'code_block' || language !== JSX_FENCE_LANGUAGE) {
      children.push(node);
      return;
    }
    const value = node.textContent.replace(/\n$/, '');
    children.push(jsxFenceNode(doc, value));
    replaced += 1;
  });
  if (replaced === 0) {
    return doc;
  }
  return doc.type.create(doc.attrs, children, doc.marks);
}

const markdownTokenizer = new MarkdownIt('commonmark', { html: false });
markdownTokenizer.enable('table');
enableStrikethrough(markdownTokenizer as unknown as MarkdownTokenizer);

export const mdxParser = new MarkdownParser(mdxSchema, markdownTokenizer, MDX_TOKENS);

/**
 * Parse MDX/Markdown content into a ProseMirror document.
 * Extracts JSX blocks first, parses the markdown, then produces a ProseMirror doc.
 *
 * @param content - Raw MDX/Markdown string
 * @returns ProseMirror Node representing the document
 */
export function parseMdxContent(content: string): ProseMirrorNode | null {
  const { frontmatter, body } = splitLeadingFrontmatter(content);
  const definitions = extractLinkDefinitions(body);
  const { processedText } = extractJsxBlocks(protectTexDelimiters(protectFootnoteMarkers(body)));
  const restored = restoreFootnoteMarkers(restoreJsxFences(mdxParser.parse(processedText)));
  if (frontmatter.length === 0 && definitions.length === 0) {
    return restored;
  }
  return restored.type.create(
    { ...restored.attrs, frontmatter, linkDefinitions: definitions },
    restored.content,
    restored.marks
  );
}
