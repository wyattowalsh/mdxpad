/**
 * ProseMirror MDX Serializer
 *
 * Serializes a ProseMirror document back to Markdown/MDX text.
 * Preserves JSX blocks as-is during round-trip editing.
 *
 * @module renderer/lib/editor/prosemirror-mdx-serializer
 */

import { MarkdownSerializer, MarkdownSerializerState } from 'prosemirror-markdown';
import { Fragment, type Node as ProseMirrorNode, type Mark } from 'prosemirror-model';

import { nextMathDelimiter, unescapedDelimiterIndex } from '@shared/lib/math-span';

import { FOOTNOTE_BLOCK_LANGUAGE } from './prosemirror-footnote-block';
import { taskMarker } from './prosemirror-task-item';
import {
  startsFootnoteDefinition,
  writeFootnoteLabel,
  writeFootnoteRef,
} from './prosemirror-footnote-ref';
import { emphasizeOutside, restorePreservedWhitespace } from './prosemirror-emphasis-order';
import {
  emphasisOpen,
  linkLabelOpen,
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
    const marker = '`'.repeat(Math.max(3, longestBacktickRun(text) + 1));
    state.write(`${marker}${language}\n`);
    state.text(text, false);
    state.write('\n');
    state.write(marker);
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
    state.renderList(node, '  ', (index) => `${marker} ${taskMarker(node.child(index))}`);
  },

  ordered_list(state, node) {
    const start = listStart(node);
    const delimiter = node.attrs.delimiter === ')' ? ')' : '.';
    const indent = orderedIndent(start, node.childCount, delimiter);
    state.renderList(node, indent, (index) => {
      return `${start + index}${delimiter} ${taskMarker(node.child(index))}`;
    });
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

  footnote_ref: writeFootnoteRef,

  footnote_label: writeFootnoteLabel,

  hard_break(state, node, parent, index) {
    const next = index + 1 < parent.childCount ? parent.child(index + 1) : null;
    const footnote =
      parent.type.name === 'paragraph' &&
      startsFootnoteDefinition(parent.firstChild) &&
      !startsFootnoteDefinition(next);
    const indent = footnote ? '    ' : '';
    state.write(node.attrs.hard === false ? `\n${indent}` : `\\\n${indent}`);
    const carrier = state as MarkdownSerializerState & {
      mathCloser?: string | null;
      mathBreak?: boolean;
    };
    carrier.mathBreak = Boolean(carrier.mathCloser);
  },

  text(state, node, parent, index) {
    const writer = state as MarkdownSerializerState & {
      atBlockStart: boolean;
      out: string;
      emphasisOpen: string;
      strikeLiteral: boolean;
      mathCloser: string | null;
      mathBreak: boolean;
    };
    if (!writer.atBlockStart && writer.out.endsWith('\n')) {
      writer.atBlockStart = true;
    }
    if (writer.mathCloser && !writer.mathBreak) {
      writer.mathCloser = null;
    }
    writer.mathBreak = false;
    const text = restorePreservedWhitespace(shieldEntityAmpersands(node.text ?? ''));
    if (text === '\u200b' && node.marks.some((mark) => mark.type.name === 'link')) {
      return;
    }
    if (/^\\[[\]()]$/.test(text)) {
      state.text(text, false);
      writer.mathCloser = text === '\\[' ? '\\]' : text === '\\(' ? '\\)' : null;
      return;
    }
    writer.emphasisOpen = emphasisOpen(node.marks);
    writer.strikeLiteral = node.marks.some((mark) => mark.type.name === 'strikethrough');
    try {
      writeTextPreservingMath(state, protectTrailingSpaces(text, node, parent, index));
    } finally {
      writer.emphasisOpen = '';
      writer.strikeLiteral = false;
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
      const node = parent.child(index);
      return `${backticksFor(node, -1)}${codePadding(node)}`;
    },
    close(_state, _mark, parent, index) {
      const node = parent.child(index - 1);
      return `${codePadding(node)}${backticksFor(node, 1)}`;
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
    mixable: true,
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
  let result = '';
  for (let index = 0; index < alt.length; index += 1) {
    const char = alt[index] ?? '';
    const next = alt[index + 1] ?? '';
    if (char === '\\' && (next === '(' || next === ')')) {
      result += `${char}${next}`;
      index += 1;
      continue;
    }
    if (char === '\\' || char === '[' || char === ']') {
      result += `\\${char}`;
      continue;
    }
    result += char;
  }
  return result;
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

interface LiteralSpan {
  readonly index: number;
  readonly opener: string;
  readonly closer: string;
  readonly stayOpen: boolean;
}

function closerAt(value: string, from: number, closer: string): number {
  return unescapedDelimiterIndex(value, from, closer);
}

function nextLiteralSpan(value: string, from: number): LiteralSpan | null {
  const options = [
    { token: '\\[', closer: '\\]', stayOpen: true },
    { token: '\\(', closer: '\\)', stayOpen: true },
    { token: '{/*', closer: '*/', stayOpen: true },
    { token: '[^', closer: ']', stayOpen: false },
  ];
  let best: LiteralSpan | null = null;
  for (const option of options) {
    const index = value.indexOf(option.token, from);
    if (index === -1) {
      continue;
    }
    if (!best || index < best.index) {
      best = { index, opener: option.token, closer: option.closer, stayOpen: option.stayOpen };
    }
  }
  const dollar = nextMathDelimiter(value, from);
  if (dollar && (!best || dollar.index < best.index)) {
    best = {
      index: dollar.index,
      opener: dollar.delimiter,
      closer: dollar.delimiter,
      stayOpen: dollar.delimiter === '$$',
    };
  }
  return best;
}

const ENTITY_AMP = '\uE033';

function shieldEntityAmpersands(text: string): string {
  return text.replace(
    /&(?:#\d+|#x[\da-fA-F]+|[A-Za-z][A-Za-z0-9]+);/g,
    (entity) => `${ENTITY_AMP}${entity.slice(1)}`
  );
}

function protectTrailingSpaces(
  value: string,
  node: ProseMirrorNode,
  parent: ProseMirrorNode | undefined,
  index: number
): string {
  if (!parent || node.marks.length > 0 || !value.endsWith(' ')) {
    return value;
  }
  const next = index + 1 < parent.childCount ? parent.child(index + 1) : null;
  const atLineEnd = next === null || (next.type.name === 'hard_break' && next.attrs.hard !== true);
  if (!atLineEnd) {
    return value;
  }
  return value.replace(/ +$/, (spaces) => '&#32;'.repeat(spaces.length));
}

function writeTextPreservingMath(state: MarkdownSerializerState, value: string): void {
  const writer = state as MarkdownSerializerState & { mathCloser?: string | null };
  let cursor = 0;
  let closer = writer.mathCloser ?? null;
  while (cursor < value.length) {
    if (closer) {
      const end = closerAt(value, cursor, closer);
      if (end === -1) {
        state.text(value.slice(cursor), false);
        writer.mathCloser = closer;
        return;
      }
      const closeEnd = end + closer.length;
      state.text(value.slice(cursor, closeEnd), false);
      cursor = closeEnd;
      closer = null;
      continue;
    }
    const open = nextLiteralSpan(value, cursor);
    if (!open) {
      state.text(value.slice(cursor));
      writer.mathCloser = null;
      return;
    }
    if (open.index > cursor) {
      state.text(value.slice(cursor, open.index));
    }
    const closeAt = closerAt(value, open.index + open.opener.length, open.closer);
    if (closeAt === -1) {
      state.text(value.slice(open.index), !open.stayOpen);
      writer.mathCloser = open.stayOpen ? open.closer : null;
      return;
    }
    const closeEnd = closeAt + open.closer.length;
    state.text(value.slice(open.index, closeEnd), false);
    cursor = closeEnd;
  }
  writer.mathCloser = closer;
}

function longestBacktickRun(text: string): number {
  const runs = text.match(/`+/g);
  if (!runs) {
    return 0;
  }
  return runs.reduce((longest, run) => Math.max(longest, run.length), 0);
}

function codePadding(node: ProseMirrorNode): string {
  const text = node.isText ? (node.text ?? '') : '';
  const edged = text.startsWith(' ') && text.endsWith(' ') && text.trim().length > 0;
  return edged && !text.includes('`') ? ' ' : '';
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
    const writer = state as WritableSerializerState & {
      emphasisOpen: string;
      strikeLiteral: boolean;
      mathCloser: string | null;
      mathBreak: boolean;
    };
    writer.emphasisOpen = '';
    writer.strikeLiteral = false;
    writer.mathCloser = null;
    writer.mathBreak = false;
    const escape = state.esc.bind(state);
    state.esc = (value: string, startOfLine = false) =>
      relaxPunctuationEscapes(
        restoreLiteralDelimiters(
          value,
          restoreTildeRuns(escape(value, startOfLine)),
          startOfLine,
          writer.emphasisOpen,
          writer.strikeLiteral
        ),
        linkLabelOpen(state.out)
      );
    state.renderContent(content);
    return state.out.replaceAll(ENTITY_AMP, '\\&');
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
