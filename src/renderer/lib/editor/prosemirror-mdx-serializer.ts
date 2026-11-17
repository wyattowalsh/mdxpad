/**
 * ProseMirror MDX Serializer
 *
 * Serializes a ProseMirror document back to Markdown/MDX text.
 * Preserves JSX blocks as-is during round-trip editing.
 *
 * @module renderer/lib/editor/prosemirror-mdx-serializer
 */

import { MarkdownSerializer, MarkdownSerializerState } from 'prosemirror-markdown';
import type { Node as ProseMirrorNode, Mark } from 'prosemirror-model';

// =============================================================================
// NODE SERIALIZERS
// =============================================================================

type NodeSerializerMap = Record<
  string,
  (
    state: MarkdownSerializerState,
    node: ProseMirrorNode,
    parent: ProseMirrorNode,
    index: number
  ) => void
>;

const nodeSerializers: NodeSerializerMap = {
  paragraph(state, node) {
    state.renderInline(node);
    state.closeBlock(node);
  },

  heading(state, node) {
    const level = node.attrs.level as number;
    state.write('#'.repeat(level) + ' ');
    state.renderInline(node);
    state.closeBlock(node);
  },

  code_block(state, node) {
    const language = (node.attrs.language as string) || '';
    state.write(`\`\`\`${language}\n`);
    state.text(node.textContent, false);
    state.write('\n```');
    state.closeBlock(node);
  },

  blockquote(state, node) {
    state.wrapBlock('> ', null, node, () => state.renderContent(node));
  },

  horizontal_rule(state, node) {
    state.write('---');
    state.closeBlock(node);
  },

  bullet_list(state, node) {
    state.renderList(node, '  ', () => '- ');
  },

  ordered_list(state, node) {
    const start = (node.attrs.order as number) || 1;
    state.renderList(node, '   ', (i) => `${start + i}. `);
  },

  list_item(state, node) {
    state.renderContent(node);
  },

  image(state, node) {
    const alt = (node.attrs.alt as string) || '';
    const src = node.attrs.src as string;
    const title = node.attrs.title as string | null;
    state.write(`![${state.esc(alt)}](${state.esc(src)}${title ? ` "${state.esc(title)}"` : ''})`);
  },

  hard_break(state) {
    state.write('\\\n');
  },

  text(state, node) {
    state.text(node.text ?? '');
  },

  jsx_block(state, node) {
    const value = (node.attrs.value as string) || node.textContent;
    state.write(value);
    state.closeBlock(node);
  },

  jsx_inline(state, node) {
    const value = (node.attrs.value as string) || node.textContent;
    state.write(value);
  },
};

// =============================================================================
// MARK SERIALIZERS
// =============================================================================

interface MarkSerializerSpec {
  readonly open:
    | string
    | ((
        state: MarkdownSerializerState,
        mark: Mark,
        parent: ProseMirrorNode,
        index: number
      ) => string);
  readonly close:
    | string
    | ((
        state: MarkdownSerializerState,
        mark: Mark,
        parent: ProseMirrorNode,
        index: number
      ) => string);
  readonly mixable?: boolean;
  readonly expelEnclosingWhitespace?: boolean;
  readonly escape?: boolean;
}

const markSerializers: Record<string, MarkSerializerSpec> = {
  bold: {
    open: '**',
    close: '**',
    mixable: true,
    expelEnclosingWhitespace: true,
  },

  italic: {
    open: '*',
    close: '*',
    mixable: true,
    expelEnclosingWhitespace: true,
  },

  code: {
    open(_state, _mark, parent, index) {
      return backticksFor(parent.child(index), -1);
    },
    close(_state, _mark, parent, index) {
      return backticksFor(parent.child(index - 1), 1);
    },
    escape: false,
  },

  link: {
    open: '[',
    close(_state, mark) {
      const href = mark.attrs.href as string;
      const title = mark.attrs.title as string | null;
      return `](${href}${title ? ` "${title}"` : ''})`;
    },
  },

  strikethrough: {
    open: '~~',
    close: '~~',
    mixable: true,
    expelEnclosingWhitespace: true,
  },
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Determine the number of backticks needed for inline code
 * to avoid collisions with backticks in the content.
 */
function backticksFor(node: ProseMirrorNode, side: number): string {
  const ticks = /`+/g;
  let m: RegExpExecArray | null;
  let len = 0;
  if (node.isText) {
    while ((m = ticks.exec(node.text ?? '')) !== null) {
      len = Math.max(len, m[0].length);
    }
  }
  let result = len > 0 && side > 0 ? ' `' : '`';
  for (let i = 0; i < len; i++) result += '`';
  if (len > 0 && side < 0) result += ' ';
  return result;
}

// =============================================================================
// SERIALIZER
// =============================================================================

/**
 * ProseMirror Markdown serializer configured for MDX content.
 * Converts ProseMirror documents back to Markdown/MDX text.
 */
export const mdxSerializer = new MarkdownSerializer(nodeSerializers, markSerializers);

/**
 * Serialize a ProseMirror document to MDX/Markdown string.
 *
 * @param doc - ProseMirror document node
 * @returns Serialized Markdown/MDX string
 */
export function serializeMdxContent(doc: ProseMirrorNode): string {
  return mdxSerializer.serialize(doc);
}
