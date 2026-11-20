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
import {
  FOOTNOTE_MARK,
  protectFootnoteBlocks,
  protectFootnoteMarkers,
} from './prosemirror-footnote-block';
import { linkBareAddresses } from './prosemirror-autolink';
import { liftFootnoteLabels, liftFootnoteRefs } from './prosemirror-footnote-ref';
import { shieldCellPipes } from './prosemirror-cell-pipe';
import { restoreMathMarkupNode } from './prosemirror-math-restore';
import { indentListMarkerFences } from './indent-list-fence';
import { liftTaskItems } from './prosemirror-task-item';
import { enableStrikethrough } from './prosemirror-strikethrough';
import { keepBackslashSpaces } from './prosemirror-backslash-space';
import { retainNestedEmphasis } from './prosemirror-nested-marks';
import { tableCellAttrs } from './prosemirror-mdx-table';
import {
  protectTexDelimiters,
  restoreMathMarkup,
  shieldMathMarkup,
  TEX_DISPLAY_CLOSE,
  TEX_DISPLAY_OPEN,
  TEX_INLINE_CLOSE,
  TEX_INLINE_OPEN,
} from './prosemirror-tex-protect';
import { Fragment, type Node as ProseMirrorNode, type Attrs } from 'prosemirror-model';

import { splitLeadingFrontmatter } from '@shared/lib/frontmatter';

export { splitLeadingFrontmatter };

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
    getAttrs: (token, tokens, index) => ({
      tight: listIsTight(tokens, index),
      marker: token.markup === '+' || token.markup === '*' ? token.markup : '-',
    }),
  },
  ordered_list: {
    block: 'ordered_list',
    getAttrs: (tok: MarkdownToken, tokens, index) => ({
      order: Number(tok.attrGet('start') ?? 1),
      tight: listIsTight(tokens, index),
      delimiter: tok.markup === ')' ? ')' : '.',
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
      href: restoredAddress(tok.attrGet('href')),
      title: restoredTitle(tok.attrGet('title')),
    }),
  },
  image: {
    node: 'image',
    getAttrs: (tok: MarkdownToken) => ({
      src: restoredAddress(tok.attrGet('src')),
      alt: imageAlt(tok),
      title: restoredTitle(tok.attrGet('title')),
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

function unescapeMarkdown(value: string): string {
  return value.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1');
}

function restoredTitle(value: string | null): string | null {
  return value === null ? null : restoreTexDelimiters(restoreMathMarkup(value));
}

function restoredAddress(value: string | null): string {
  if (value === null || value.length === 0) {
    return '';
  }
  const decoded = value
    .replaceAll(/%EE%80%93/gi, TEX_INLINE_OPEN)
    .replaceAll(/%EE%80%94/gi, TEX_INLINE_CLOSE)
    .replaceAll(/%EE%80%95/gi, TEX_DISPLAY_OPEN)
    .replaceAll(/%EE%80%96/gi, TEX_DISPLAY_CLOSE);
  return unescapeMarkdown(restoreTexDelimiters(restoreMathMarkup(decoded)))
    .replaceAll('[', '%5B')
    .replaceAll(']', '%5D');
}

function imageAlt(token: MarkdownToken): string {
  const raw =
    token.content.length > 0
      ? token.content
      : (token.children?.find((child) => child.type === 'text')?.content ?? '');
  return restoreTexDelimiters(restoreMathMarkup(unescapeMarkdown(raw)));
}

const LINK_DEFINITION = /^\s{0,3}\[(?!\^)[^\]]+\]:\s+\S/;

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
keepBackslashSpaces(markdownTokenizer);
enableStrikethrough(markdownTokenizer);

retainNestedEmphasis(markdownTokenizer);

export const mdxParser = new MarkdownParser(mdxSchema, markdownTokenizer, MDX_TOKENS);

/**
 * Parse MDX/Markdown content into a ProseMirror document.
 * Extracts JSX blocks first, parses the markdown, then produces a ProseMirror doc.
 *
 * @param content - Raw MDX/Markdown string
 * @returns ProseMirror Node representing the document
 */
function keepEmptyLinkLabels(value: string): string {
  return value.replace(/(?<!!)\[\](?=\()/g, '[\u200b]');
}

export function parseMdxContent(content: string): ProseMirrorNode | null {
  const { frontmatter, body: sourceBody } = splitLeadingFrontmatter(content);
  const body = indentListMarkerFences(sourceBody);
  const definitions = extractLinkDefinitions(body);
  const protectedNotes = protectFootnoteBlocks(body);
  const { processedText } = extractJsxBlocks(
    protectTexDelimiters(shieldCellPipes(shieldMathMarkup(protectFootnoteMarkers(protectedNotes))))
  );
  const restored = restoreMathMarkupNode(
    liftFootnoteLabels(
      liftFootnoteRefs(
        linkBareAddresses(
          liftTaskItems(
            restoreFootnoteMarkers(
              restoreJsxFences(mdxParser.parse(keepEmptyLinkLabels(processedText)))
            )
          )
        )
      )
    )
  );
  if (frontmatter.length === 0 && definitions.length === 0) {
    return restored;
  }
  return restored.type.create(
    { ...restored.attrs, frontmatter, linkDefinitions: definitions },
    restored.content,
    restored.marks
  );
}
