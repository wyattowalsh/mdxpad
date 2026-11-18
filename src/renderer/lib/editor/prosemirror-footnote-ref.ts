import { Fragment, type Node as ProseMirrorNode, type NodeSpec } from 'prosemirror-model';
import type { MarkdownSerializerState } from 'prosemirror-markdown';

const DEFINITION = /\[\^([^\]]+)\]:/g;
const REFERENCE = /\[\^([^\]]+)\](?!:)/g;

export const FOOTNOTE_REF_NODE: NodeSpec = {
  inline: true,
  atom: true,
  group: 'inline',
  attrs: { id: { default: '' } },
  parseDOM: [
    {
      tag: 'sup.footnote-ref',
      getAttrs(dom) {
        return { id: dom.getAttribute('data-id') ?? '' };
      },
    },
  ],
  toDOM(node) {
    const id = footnoteId(node);
    return ['sup', { class: 'footnote-ref', 'data-id': id }, id];
  },
};

export function writeFootnoteRef(state: MarkdownSerializerState, node: ProseMirrorNode): void {
  state.write(`[^${footnoteId(node)}]`);
}

const LABEL = /^\[\^([^\]]+)\]:([ \t]?)/;

export const FOOTNOTE_LABEL_NODE: NodeSpec = {
  inline: true,
  atom: true,
  group: 'inline',
  attrs: {
    id: { default: '' },
    gap: { default: ' ' },
  },
  parseDOM: [
    {
      tag: 'sup.footnote-label',
      getAttrs(dom) {
        return { id: dom.getAttribute('data-id') ?? '', gap: ' ' };
      },
    },
  ],
  toDOM(node) {
    const id = footnoteId(node);
    return ['sup', { class: 'footnote-label', 'data-id': id }, id];
  },
};

export function writeFootnoteLabel(state: MarkdownSerializerState, node: ProseMirrorNode): void {
  state.write(`[^${footnoteId(node)}]:${footnoteGap(node)}`);
}

export function startsFootnoteDefinition(node: ProseMirrorNode | null | undefined): boolean {
  if (!node) {
    return false;
  }
  if (node.type.name === 'footnote_label') {
    return true;
  }
  return node.isText && /^\[\^[^\]]+\]:/.test(node.text ?? '');
}

function footnoteGap(node: ProseMirrorNode): string {
  const raw: unknown = node.attrs.gap;
  return raw === '' || raw === '\t' ? raw : ' ';
}

function footnoteId(node: ProseMirrorNode): string {
  const raw: unknown = node.attrs.id;
  return typeof raw === 'string' ? raw : '';
}

function escaped(text: string, index: number): boolean {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
    slashes += 1;
  }
  return slashes % 2 === 1;
}

function definedIds(doc: ProseMirrorNode): Set<string> {
  const ids = new Set<string>();
  const visit = (node: ProseMirrorNode): void => {
    if (node.type.spec.code === true) {
      return;
    }
    if (node.isText) {
      if (node.marks.some((mark) => mark.type.name === 'code')) {
        return;
      }
      for (const match of (node.text ?? '').matchAll(DEFINITION)) {
        const id = match[1];
        if (id) {
          ids.add(id);
        }
      }
      return;
    }
    node.forEach(visit);
  };
  visit(doc);
  return ids;
}

function splitReferences(
  node: ProseMirrorNode,
  ids: ReadonlySet<string>
): readonly ProseMirrorNode[] {
  const text = node.text ?? '';
  const ref = node.type.schema.nodes.footnote_ref;
  if (!ref || node.marks.some((mark) => mark.type.name === 'code')) {
    return [node];
  }
  const parts: ProseMirrorNode[] = [];
  let last = 0;
  for (const match of text.matchAll(REFERENCE)) {
    const index = match.index;
    const id = match[1];
    if (!id || !ids.has(id) || escaped(text, index)) {
      continue;
    }
    if (index > last) {
      parts.push(node.type.schema.text(text.slice(last, index), node.marks));
    }
    parts.push(ref.create({ id }, null, node.marks));
    last = index + match[0].length;
  }
  if (parts.length === 0) {
    return [node];
  }
  if (last < text.length) {
    parts.push(node.type.schema.text(text.slice(last), node.marks));
  }
  return parts;
}

function mapNode(node: ProseMirrorNode, ids: ReadonlySet<string>): ProseMirrorNode {
  if (node.isText || node.childCount === 0 || node.type.spec.code === true) {
    return node;
  }
  const children: ProseMirrorNode[] = [];
  node.forEach((child) => {
    if (child.isText) {
      children.push(...splitReferences(child, ids));
      return;
    }
    children.push(mapNode(child, ids));
  });
  return node.copy(Fragment.from(children));
}

/** Show a defined `[^id]` as a superscript. The saved markdown keeps the marker. */
export function liftFootnoteRefs(doc: ProseMirrorNode): ProseMirrorNode {
  const ids = definedIds(doc);
  return ids.size === 0 ? doc : mapNode(doc, ids);
}

function splitLabel(node: ProseMirrorNode): readonly ProseMirrorNode[] {
  const text = node.text ?? '';
  const match = LABEL.exec(text);
  const id = match?.[1];
  const label = node.type.schema.nodes.footnote_label;
  if (!match || !id || !label || escaped(text, 0)) {
    return [node];
  }
  const gap = match[2] ?? '';
  const marker = label.create({ id, gap });
  const rest = text.slice(match[0].length);
  return rest.length === 0 ? [marker] : [marker, node.type.schema.text(rest, node.marks)];
}

function mapLabels(node: ProseMirrorNode): ProseMirrorNode {
  if (node.isText || node.childCount === 0 || node.type.spec.code === true) {
    return node;
  }
  const children: ProseMirrorNode[] = [];
  node.forEach((child, _offset, index) => {
    const previous = index > 0 ? node.child(index - 1) : null;
    const atDefinition = index === 0 || previous?.type.name === 'hard_break';
    if (child.isText && atDefinition) {
      children.push(...splitLabel(child));
      return;
    }
    children.push(mapLabels(child));
  });
  return node.copy(Fragment.from(children));
}

/** Show the `[^id]:` in front of a note as the note's superscript. */
export function liftFootnoteLabels(doc: ProseMirrorNode): ProseMirrorNode {
  return mapLabels(doc);
}
