/**
 * ProseMirror MDX Serializer
 *
 * Serializes a ProseMirror document back to Markdown/MDX text.
 * Preserves JSX blocks as-is during round-trip editing.
 *
 * @module renderer/lib/editor/prosemirror-mdx-serializer
 */

import { MarkdownSerializer, MarkdownSerializerState } from 'prosemirror-markdown';
import { FOOTNOTE_BLOCK_LANGUAGE } from './prosemirror-footnote-block';
import { Fragment, type Node as ProseMirrorNode, type Mark } from 'prosemirror-model';

import { emphasizeOutside } from './prosemirror-emphasis-order';
import {
  emphasisOpen,
  relaxPunctuationEscapes,
  restoreLiteralDelimiters,
} from './prosemirror-literal-delimiters';
import { serializeTable } from './prosemirror-mdx-table';

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

function bulletMarker(node: ProseMirrorNode): string {
  const marker: unknown = node.attrs.marker;
  return marker === '+' || marker === '*' ? marker : '-';
}

function listStart(node: ProseMirrorNode): number {
  const order: unknown = node.attrs.order;
  return typeof order === 'number' && Number.isInteger(order) && order >= 0 ? order : 1;
}

function orderedIndent(start: number, count: number, delimiter: string): string {
  const last = start + Math.max(count, 1) - 1;
  return ' '.repeat(`${last}${delimiter} `.length);
}

function separateDifferentBullets(state: MarkdownSerializerState, node: ProseMirrorNode): void {
  const writer = state as MarkdownSerializerState & {
    closed: ProseMirrorNode | null;
    flushClose: (size?: number) => void;
  };
  const previous = writer.closed;
  if (previous?.type === node.type && bulletMarker(previous) !== bulletMarker(node)) {
    writer.flushClose(1);
  }
}

function taskPrefix(paragraph: ProseMirrorNode): string | null {
  const match = /^\[([ xX])\]\s*/.exec(paragraph.textContent);
  return match?.[0] ?? null;
}

function paragraphWithoutPrefix(paragraph: ProseMirrorNode, skip: number): ProseMirrorNode {
  const children: ProseMirrorNode[] = [];
  let remaining = skip;
  paragraph.forEach((child) => {
    if (remaining <= 0 || !child.isText) {
      children.push(child);
      return;
    }
    const text = child.text ?? '';
    if (text.length <= remaining) {
      remaining -= text.length;
      return;
    }
    children.push(paragraph.type.schema.text(text.slice(remaining), child.marks));
    remaining = 0;
  });
  return paragraph.copy(Fragment.fromArray(children));
}

const nodeSerializers: NodeSerializerMap = {
  paragraph(state, node, parent) {
    const prefix =
      parent.type.name === 'list_item' && parent.firstChild === node ? taskPrefix(node) : null;
    if (prefix) {
      state.write(prefix);
      state.renderInline(paragraphWithoutPrefix(node, prefix.length), false);
    } else {
      state.renderInline(node);
    }
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
    const text = node.textContent.endsWith('\n') ? node.textContent.slice(0, -1) : node.textContent;
    if (language === FOOTNOTE_BLOCK_LANGUAGE) {
      state.write(text);
      state.closeBlock(node);
      return;
    }
    if (node.attrs.indented === true && language.length === 0) {
      const lines = text.length === 0 ? [] : text.split('\n');
      lines.forEach((line, index) => {
        if (index > 0) {
          state.write('\n');
        }
        state.write(`    ${line}`);
      });
      state.closeBlock(node);
      return;
    }
    state.write(`\`\`\`${language}\n`);
    state.text(text, false);
    state.write('\n');
    state.write('```');
    state.closeBlock(node);
  },

  blockquote(state, node) {
    state.wrapBlock('> ', null, node, () => state.renderContent(node));
  },

  horizontal_rule(state, node) {
    const markup: unknown = node.attrs.markup;
    state.write(markup === '***' || markup === '___' ? markup : '---');
    state.closeBlock(node);
  },

  bullet_list(state, node) {
    separateDifferentBullets(state, node);
    const marker = bulletMarker(node);
    state.renderList(node, '  ', () => `${marker} `);
  },

  ordered_list(state, node) {
    const start = listStart(node);
    const delimiter = node.attrs.delimiter === ')' ? ')' : '.';
    const indent = orderedIndent(start, node.childCount, delimiter);
    state.renderList(node, indent, (index) => `${start + index}${delimiter} `);
  },

  list_item(state, node) {
    state.renderContent(node);
  },

  table(state, node) {
    serializeTable(state, node);
  },

  image(state, node) {
    const alt = (node.attrs.alt as string) || '';
    const src = node.attrs.src as string;
    const title = node.attrs.title as string | null;
    state.write(`![${markdownAlt(alt)}](${markdownTarget(src, title)})`);
  },

  hard_break(state, node, parent, index) {
    const first = parent.firstChild?.isText ? (parent.firstChild.text ?? '') : '';
    const next = index + 1 < parent.childCount ? parent.child(index + 1) : null;
    const nextText = next?.isText ? (next.text ?? '') : '';
    const anotherDefinition = /^\[\^[^\]]+\]:/.test(nextText);
    const footnote =
      parent.type.name === 'paragraph' && /^\[\^[^\]]+\]:/.test(first) && !anotherDefinition;
    const indent = footnote ? '    ' : '';
    state.write(node.attrs.hard === false ? `\n${indent}` : `\\\n${indent}`);
  },

  text(state, node) {
    const writer = state as MarkdownSerializerState & {
      atBlockStart: boolean;
      out: string;
      emphasisOpen: string;
    };
    if (!writer.atBlockStart && writer.out.endsWith('\n')) {
      writer.atBlockStart = true;
    }
    const text = node.text ?? '';
    if (/^\\[[\]()]$/.test(text)) {
      state.text(text, false);
      return;
    }
    writer.emphasisOpen = emphasisOpen(node.marks);
    try {
      writeTextPreservingMath(state, text);
    } finally {
      writer.emphasisOpen = '';
    }
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
      return `](${markdownTarget(href, title)})`;
    },
  },

  strikethrough: {
    open: '~~',
    close: '~~',
    escape: false,
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
function markdownAlt(alt: string): string {
  return alt.replace(/[\\[\]]/g, (char) => `\\${char}`);
}

function localHref(href: string): string {
  if (/^(?:https?:|data:|mailto:)/i.test(href) || href.startsWith('//')) {
    return href;
  }
  try {
    return decodeURI(href);
  } catch {
    return href;
  }
}

function markdownDestination(href: string): string {
  const value = localHref(href);
  const needsAngles = /[()\s]/.test(value) && !value.includes('<') && !value.includes('>');
  return needsAngles ? `<${value}>` : value;
}

function markdownTitle(title: string): string {
  if (!title.includes('"')) {
    return `"${title}"`;
  }
  if (!title.includes("'")) {
    return `'${title}'`;
  }
  return `(${title.replaceAll(')', '\\)')})`;
}

function markdownTarget(href: string, title: string | null): string {
  const destination = markdownDestination(href);
  return title ? `${destination} ${markdownTitle(title)}` : destination;
}

function writeTextPreservingMath(state: MarkdownSerializerState, value: string): void {
  const pattern = /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\[\^[^\]]+\]/g;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index;
    if (index > cursor) {
      state.text(value.slice(cursor, index));
    }
    state.text(match[0], false);
    cursor = index + match[0].length;
  }
  if (cursor < value.length) {
    state.text(value.slice(cursor));
  }
}

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
interface WritableSerializerState {
  out: string;
  esc: (value: string, startOfLine?: boolean) => string;
  renderContent: (content: ProseMirrorNode) => void;
  renderInline: (parent: ProseMirrorNode, fromBlockStart?: boolean) => void;
}

function restoreTildeRuns(escaped: string): string {
  return escaped.replaceAll('\\~', '~').replace(/~{2,}/g, (run) => '\\~'.repeat(run.length));
}

function openSerializerState(
  serializer: MarkdownSerializer,
  options?: { tightLists?: boolean }
): WritableSerializerState {
  const State = MarkdownSerializerState as unknown as new (
    nodes: object,
    marks: object,
    options: object
  ) => WritableSerializerState;
  const state = new State(serializer.nodes, serializer.marks, {
    ...serializer.options,
    ...options,
  });
  const renderInline = state.renderInline.bind(state);
  state.renderInline = (parent, fromBlockStart) => {
    renderInline(emphasizeOutside(parent), fromBlockStart);
  };
  return state;
}

class MdxMarkdownSerializer extends MarkdownSerializer {
  override serialize(content: ProseMirrorNode, options?: { tightLists?: boolean }): string {
    const state = openSerializerState(this, options);
    const writer = state as WritableSerializerState & { emphasisOpen: string };
    writer.emphasisOpen = '';
    const escape = state.esc.bind(state);
    state.esc = (value: string, startOfLine = false) =>
      relaxPunctuationEscapes(
        restoreLiteralDelimiters(
          value,
          restoreTildeRuns(escape(value, startOfLine)),
          startOfLine,
          writer.emphasisOpen
        )
      );
    state.renderContent(content);
    return state.out;
  }
}

export const mdxSerializer = new MdxMarkdownSerializer(nodeSerializers, markSerializers);

/**
 * Serialize a ProseMirror document to MDX/Markdown string.
 *
 * @param doc - ProseMirror document node
 * @returns Serialized Markdown/MDX string
 */
export function serializeMdxContent(doc: ProseMirrorNode): string {
  const body = mdxSerializer.serialize(doc, { tightLists: true });
  const frontmatter = typeof doc.attrs.frontmatter === 'string' ? doc.attrs.frontmatter : '';
  const definitions =
    typeof doc.attrs.linkDefinitions === 'string' ? doc.attrs.linkDefinitions.trim() : '';
  const withFrontmatter =
    frontmatter.length === 0
      ? body
      : frontmatter.endsWith('\n')
        ? `${frontmatter}${body}`
        : `${frontmatter}\n${body}`;
  if (definitions.length === 0 || withFrontmatter.includes(definitions)) {
    return withFrontmatter;
  }
  const separator = withFrontmatter.endsWith('\n') ? '\n' : '\n\n';
  return `${withFrontmatter}${separator}${definitions}\n`;
}
