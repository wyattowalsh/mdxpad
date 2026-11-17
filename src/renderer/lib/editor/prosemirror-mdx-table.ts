import type { MarkdownSerializerState } from 'prosemirror-markdown';
import type { Node as ProseMirrorNode, NodeSpec } from 'prosemirror-model';

interface AlignToken {
  attrGet(name: string): string | null;
}

type Align = 'left' | 'center' | 'right' | null;

function storedAlign(value: unknown): Align {
  return value === 'left' || value === 'center' || value === 'right' ? value : null;
}

function readAlign(style: string): Align {
  return storedAlign(/text-align:\s*(left|center|right)/.exec(style)?.[1]);
}

export function tableCellAttrs(token: AlignToken): { align: Align } {
  return { align: readAlign(token.attrGet('style') ?? '') };
}

function cellSpec(tag: 'th' | 'td'): NodeSpec {
  return {
    content: 'inline*',
    attrs: { align: { default: null } },
    isolating: true,
    parseDOM: [
      {
        tag,
        getAttrs(dom) {
          return { align: readAlign(dom.style.textAlign) };
        },
      },
    ],
    toDOM(node) {
      const align = storedAlign(node.attrs.align);
      return [tag, align ? { style: `text-align: ${align}` } : {}, 0];
    },
  };
}

export const tableNodes: Record<string, NodeSpec> = {
  table: {
    content: 'table_row+',
    group: 'block',
    isolating: true,
    parseDOM: [{ tag: 'table' }],
    toDOM() {
      return ['table', ['tbody', 0]];
    },
  },
  table_row: {
    content: '(table_cell | table_header)+',
    parseDOM: [{ tag: 'tr' }],
    toDOM() {
      return ['tr', 0];
    },
  },
  table_header: cellSpec('th'),
  table_cell: cellSpec('td'),
};

function inlineMarkdown(state: MarkdownSerializerState, node: ProseMirrorNode): string {
  const writable = state as MarkdownSerializerState & { out: string };
  const start = writable.out.length;
  state.renderInline(node);
  const text = writable.out.slice(start).replaceAll('\n', ' ').trim().replaceAll('|', '\\|');
  writable.out = writable.out.slice(0, start);
  return text;
}

function alignmentMarker(align: Align): string {
  if (align === 'center') {
    return ':---:';
  }
  if (align === 'right') {
    return '---:';
  }
  return '---';
}

function tableLine(cells: readonly string[]): string {
  return `| ${cells.join(' | ')} |`;
}

export function serializeTable(state: MarkdownSerializerState, node: ProseMirrorNode): void {
  const rows: string[][] = [];
  const aligns: Align[] = [];
  node.forEach((row, _offset, rowIndex) => {
    const cells: string[] = [];
    row.forEach((cell, _cellOffset, cellIndex) => {
      cells.push(inlineMarkdown(state, cell));
      if (rowIndex === 0) {
        aligns[cellIndex] = storedAlign(cell.attrs.align);
      }
    });
    rows.push(cells);
  });
  const width = rows.reduce((count, row) => Math.max(count, row.length), 0);
  const padded = rows.map((row) => {
    const cells = row.slice();
    while (cells.length < width) {
      cells.push('');
    }
    return tableLine(cells);
  });
  const markers = Array.from({ length: width }, (_item, index) =>
    alignmentMarker(aligns[index] ?? null)
  );
  const [header = '', ...body] = padded;
  state.write([header, tableLine(markers), ...body].filter((line) => line.length > 0).join('\n'));
  state.closeBlock(node);
}
