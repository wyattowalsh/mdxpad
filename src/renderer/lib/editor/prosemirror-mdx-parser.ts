/**
 * ProseMirror MDX Parser
 *
 * Parses Markdown/MDX text into a ProseMirror document.
 * Handles standard markdown, GFM extensions, and preserves JSX blocks
 * as opaque nodes.
 *
 * @module renderer/lib/editor/prosemirror-mdx-parser
 */

import { defaultMarkdownParser, MarkdownParser } from 'prosemirror-markdown';
import { mdxSchema } from './prosemirror-mdx-schema';
import type { Node as ProseMirrorNode, Attrs } from 'prosemirror-model';

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

// =============================================================================
// JSX EXTRACTION
// =============================================================================

/**
 * Pattern matching JSX block elements (opening tags on their own line).
 * Matches both self-closing and paired JSX tags.
 */
const JSX_BLOCK_REGEX =
  /^(<[A-Z][a-zA-Z0-9]*(?:\s[^>]*)?\/>|<[A-Z][a-zA-Z0-9]*(?:\s[^>]*)?>[\s\S]*?<\/[A-Z][a-zA-Z0-9]*>)$/gm;

/**
 * Placeholder used to preserve JSX blocks during markdown parsing.
 */
const JSX_BLOCK_PLACEHOLDER = '<!-- mdx-jsx-block -->';

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
    return JSX_BLOCK_PLACEHOLDER;
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
  bullet_list: { block: 'bullet_list' },
  ordered_list: {
    block: 'ordered_list',
    getAttrs: (tok: MarkdownToken) => ({
      order: Number(tok.attrGet('start') ?? 1),
    }),
  },
  list_item: { block: 'list_item' },
  heading: {
    block: 'heading',
    getAttrs: (tok: MarkdownToken) => ({ level: tok.markup.length }),
  },
  code_block: { block: 'code_block', noCloseToken: true },
  fence: {
    block: 'code_block',
    getAttrs: (tok: MarkdownToken) => ({ language: tok.info }),
    noCloseToken: true,
  },
  hr: { node: 'horizontal_rule' },

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

  // HTML (JSX placeholders) - ignored
  html_block: { ignore: true, noCloseToken: true },
  html_inline: { ignore: true, noCloseToken: true },
  hardbreak: { node: 'hard_break', getAttrs: () => ({ hard: true }) },
  softbreak: { node: 'hard_break', getAttrs: () => ({ hard: false }) },
};

function imageAlt(token: MarkdownToken): string {
  if (token.content.length > 0) {
    return token.content;
  }
  const text = token.children?.find((child) => child.type === 'text');
  return text?.content ?? '';
}

const LEADING_FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

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

// =============================================================================
// PARSER
// =============================================================================

/**
 * Create a ProseMirror Markdown parser using the default markdown-it tokenizer
 * from prosemirror-markdown, with our custom MDX schema and token specs.
 */
export const mdxParser = new MarkdownParser(mdxSchema, defaultMarkdownParser.tokenizer, MDX_TOKENS);

/**
 * Parse MDX/Markdown content into a ProseMirror document.
 * Extracts JSX blocks first, parses the markdown, then produces a ProseMirror doc.
 *
 * @param content - Raw MDX/Markdown string
 * @returns ProseMirror Node representing the document
 */
export function parseMdxContent(content: string): ProseMirrorNode | null {
  const { frontmatter, body } = splitLeadingFrontmatter(content);
  const { processedText } = extractJsxBlocks(body);
  const parsed = mdxParser.parse(processedText);
  if (frontmatter.length === 0) {
    return parsed;
  }
  return parsed.type.create({ ...parsed.attrs, frontmatter }, parsed.content, parsed.marks);
}
