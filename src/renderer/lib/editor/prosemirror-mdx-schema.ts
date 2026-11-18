/**
 * ProseMirror Schema for MDX
 *
 * Defines node and mark types for MDX/Markdown editing in WYSIWYG mode.
 * Includes standard markdown nodes, GFM extensions, and MDX-specific
 * JSX block/inline nodes that are preserved as opaque content.
 *
 * @module renderer/lib/editor/prosemirror-mdx-schema
 */

import { Schema } from 'prosemirror-model';
import type { NodeSpec, MarkSpec } from 'prosemirror-model';

import { FOOTNOTE_LABEL_NODE, FOOTNOTE_REF_NODE } from './prosemirror-footnote-ref';

import { tableNodes } from './prosemirror-mdx-table';

// =============================================================================
// NODE SPECS
// =============================================================================

const DOC_NODE: NodeSpec = {
  content: 'block+',
  attrs: { frontmatter: { default: '' }, linkDefinitions: { default: '' } },
};

const PARAGRAPH_NODE: NodeSpec = {
  content: 'inline*',
  group: 'block',
  parseDOM: [{ tag: 'p' }],
  toDOM() {
    return ['p', 0];
  },
};

const HEADING_NODE: NodeSpec = {
  attrs: { level: { default: 1 } },
  content: 'inline*',
  group: 'block',
  defining: true,
  parseDOM: [
    { tag: 'h1', attrs: { level: 1 } },
    { tag: 'h2', attrs: { level: 2 } },
    { tag: 'h3', attrs: { level: 3 } },
    { tag: 'h4', attrs: { level: 4 } },
    { tag: 'h5', attrs: { level: 5 } },
    { tag: 'h6', attrs: { level: 6 } },
  ],
  toDOM(node) {
    return [`h${node.attrs.level as number}`, 0];
  },
};

const CODE_BLOCK_NODE: NodeSpec = {
  content: 'text*',
  marks: '',
  group: 'block',
  code: true,
  defining: true,
  attrs: { language: { default: '' }, indented: { default: false } },
  parseDOM: [
    {
      tag: 'pre',
      preserveWhitespace: 'full' as const,
      getAttrs(dom) {
        const code = dom.querySelector('code');
        const className = code?.className ?? '';
        const match = /language-(\w+)/.exec(className);
        return { language: match?.[1] ?? '', indented: false };
      },
    },
  ],
  toDOM(node) {
    const lang = node.attrs.language as string;
    return ['pre', ['code', lang ? { class: `language-${lang}` } : {}, 0]];
  },
};

const BLOCKQUOTE_NODE: NodeSpec = {
  content: 'block+',
  group: 'block',
  defining: true,
  parseDOM: [{ tag: 'blockquote' }],
  toDOM() {
    return ['blockquote', 0];
  },
};

const HORIZONTAL_RULE_NODE: NodeSpec = {
  group: 'block',
  attrs: { markup: { default: '---' } },
  parseDOM: [{ tag: 'hr', getAttrs: () => ({ markup: '---' }) }],
  toDOM() {
    return ['hr'];
  },
};

const ORDERED_LIST_NODE: NodeSpec = {
  content: 'list_item+',
  group: 'block',
  attrs: { order: { default: 1 }, tight: { default: true }, delimiter: { default: '.' } },
  parseDOM: [
    {
      tag: 'ol',
      getAttrs(dom) {
        const start = dom.getAttribute('start');
        return { order: start ? Number(start) : 1, tight: true };
      },
    },
  ],
  toDOM(node) {
    const order = node.attrs.order as number;
    return order === 1 ? ['ol', 0] : ['ol', { start: String(order) }, 0];
  },
};

const BULLET_LIST_NODE: NodeSpec = {
  content: 'list_item+',
  group: 'block',
  attrs: { tight: { default: true }, marker: { default: '-' } },
  parseDOM: [{ tag: 'ul', getAttrs: () => ({ tight: true }) }],
  toDOM() {
    return ['ul', 0];
  },
};

const LIST_ITEM_NODE: NodeSpec = {
  content: 'block+',
  attrs: { task: { default: null } },
  parseDOM: [{ tag: 'li' }],
  toDOM(node) {
    const task = node.attrs.task as string | null;
    return task ? ['li', { 'data-task': task }, 0] : ['li', 0];
  },
  defining: true,
};

const IMAGE_NODE: NodeSpec = {
  inline: true,
  attrs: {
    src: { default: '' },
    alt: { default: null },
    title: { default: null },
  },
  group: 'inline',
  draggable: true,
  parseDOM: [
    {
      tag: 'img[src]',
      getAttrs(dom) {
        const el = dom;
        return {
          src: el.getAttribute('src'),
          alt: el.getAttribute('alt'),
          title: el.getAttribute('title'),
        };
      },
    },
  ],
  toDOM(node) {
    const { src, alt, title } = node.attrs as {
      src: string;
      alt: string | null;
      title: string | null;
    };
    return ['img', { src, alt: alt ?? undefined, title: title ?? undefined }];
  },
};

const HARD_BREAK_NODE: NodeSpec = {
  inline: true,
  group: 'inline',
  selectable: false,
  attrs: { hard: { default: true } },
  parseDOM: [{ tag: 'br', getAttrs: () => ({ hard: true }) }],
  toDOM() {
    return ['br'];
  },
};

const TEXT_NODE: NodeSpec = {
  group: 'inline',
};

/**
 * JSX block node: preserves MDX JSX expressions as opaque content.
 * Not editable inline -- displayed as a code block in WYSIWYG mode.
 */
const JSX_BLOCK_NODE: NodeSpec = {
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  attrs: { value: { default: '' } },
  parseDOM: [
    {
      tag: 'div[data-mdx-jsx]',
      preserveWhitespace: 'full' as const,
      getAttrs(dom) {
        return { value: dom.textContent };
      },
    },
  ],
  toDOM(_node) {
    return ['div', { 'data-mdx-jsx': 'block', class: 'mdx-jsx-block' }, ['code', 0]];
  },
};

/**
 * JSX inline node: preserves inline MDX expressions like {variable}.
 */
const JSX_INLINE_NODE: NodeSpec = {
  group: 'inline',
  inline: true,
  content: 'text*',
  marks: '',
  attrs: { value: { default: '' } },
  parseDOM: [
    {
      tag: 'span[data-mdx-jsx]',
      getAttrs(dom) {
        return { value: dom.textContent };
      },
    },
  ],
  toDOM() {
    return ['span', { 'data-mdx-jsx': 'inline', class: 'mdx-jsx-inline' }, 0];
  },
};

// =============================================================================
// MARK SPECS
// =============================================================================

const BOLD_MARK: MarkSpec = {
  parseDOM: [
    { tag: 'strong' },
    { tag: 'b', getAttrs: (dom) => dom.style.fontWeight !== 'normal' && null },
    {
      style: 'font-weight=400',
      clearMark: (m) => m.type.name === 'bold',
    },
    { style: 'font-weight', getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null },
  ],
  toDOM() {
    return ['strong', 0];
  },
};

const ITALIC_MARK: MarkSpec = {
  parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
  toDOM() {
    return ['em', 0];
  },
};

const CODE_MARK: MarkSpec = {
  parseDOM: [{ tag: 'code' }],
  toDOM() {
    return ['code', 0];
  },
};

const LINK_MARK: MarkSpec = {
  attrs: {
    href: { default: '' },
    title: { default: null },
  },
  inclusive: false,
  parseDOM: [
    {
      tag: 'a[href]',
      getAttrs(dom) {
        const el = dom;
        return {
          href: el.getAttribute('href'),
          title: el.getAttribute('title'),
        };
      },
    },
  ],
  toDOM(node) {
    const { href, title } = node.attrs as { href: string; title: string | null };
    return [
      'a',
      {
        href,
        title: title ?? undefined,
        style: 'text-decoration: underline; text-underline-offset: 2px; cursor: pointer;',
      },
      0,
    ];
  },
};

const STRIKETHROUGH_MARK: MarkSpec = {
  parseDOM: [{ tag: 's' }, { tag: 'del' }, { style: 'text-decoration=line-through' }],
  toDOM() {
    return ['del', 0];
  },
};

// =============================================================================
// SCHEMA
// =============================================================================

/**
 * ProseMirror schema for MDX editing.
 * Supports standard Markdown, GFM extensions, and MDX JSX nodes.
 */
export const mdxSchema = new Schema({
  nodes: {
    doc: DOC_NODE,
    paragraph: PARAGRAPH_NODE,
    heading: HEADING_NODE,
    code_block: CODE_BLOCK_NODE,
    blockquote: BLOCKQUOTE_NODE,
    horizontal_rule: HORIZONTAL_RULE_NODE,
    ordered_list: ORDERED_LIST_NODE,
    bullet_list: BULLET_LIST_NODE,
    list_item: LIST_ITEM_NODE,
    ...tableNodes,
    image: IMAGE_NODE,
    hard_break: HARD_BREAK_NODE,
    footnote_ref: FOOTNOTE_REF_NODE,
    footnote_label: FOOTNOTE_LABEL_NODE,
    jsx_block: JSX_BLOCK_NODE,
    jsx_inline: JSX_INLINE_NODE,
    text: TEXT_NODE,
  },
  marks: {
    bold: BOLD_MARK,
    italic: ITALIC_MARK,
    code: CODE_MARK,
    link: LINK_MARK,
    strikethrough: STRIKETHROUGH_MARK,
  },
});

// =============================================================================
// EXPORTS
// =============================================================================

export type MdxSchemaType = typeof mdxSchema;
