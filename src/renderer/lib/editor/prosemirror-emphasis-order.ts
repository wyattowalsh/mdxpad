/**
 * The markdown serializer stores bold before italic and closes marks from
 * the end of that list. A mark that continues onto the next word has to be
 * opened first, so closing the inner mark leaves the outer one in place.
 * A link that contains code or emphasis stays outside those marks.
 *
 * @module renderer/lib/editor/prosemirror-emphasis-order
 */

import type { Mark, Node as ProseMirrorNode } from 'prosemirror-model';

interface NodeWithText {
  withText(text: string): ProseMirrorNode;
}

function replaceText(node: ProseMirrorNode, text: string): ProseMirrorNode {
  return (node as ProseMirrorNode & NodeWithText).withText(text);
}

function readProperty(target: ProseMirrorNode, prop: string | symbol): unknown {
  return Reflect.get(target, prop) as unknown;
}

function markReach(parent: ProseMirrorNode, index: number, mark: Mark): number {
  let next = index + 1;
  while (next < parent.childCount && mark.isInSet(parent.child(next).marks)) {
    next += 1;
  }
  return next;
}

function strikeOutsideCode(marks: readonly Mark[]): readonly Mark[] {
  const code = marks.findIndex((mark) => mark.type.name === 'code');
  const strike = marks.findIndex((mark) => mark.type.name === 'strikethrough');
  if (code === -1 || strike === -1 || strike < code) {
    return marks;
  }
  const next = [...marks];
  const struck = next[strike];
  if (!struck) {
    return marks;
  }
  next.splice(strike, 1);
  next.splice(code, 0, struck);
  return next;
}

function emphasisMarks(
  parent: ProseMirrorNode,
  index: number,
  marks: readonly Mark[]
): readonly Mark[] {
  const emphasis = marks.filter((mark) => mark.type.name === 'bold' || mark.type.name === 'italic');
  if (emphasis.length < 2) {
    return marks;
  }
  const sorted = [...emphasis].sort(
    (left, right) => markReach(parent, index, right) - markReach(parent, index, left)
  );
  let cursor = 0;
  return marks.map((mark) => {
    if (mark.type.name !== 'bold' && mark.type.name !== 'italic') {
      return mark;
    }
    const next = sorted[cursor];
    cursor += 1;
    return next ?? mark;
  });
}

function markSpan(parent: ProseMirrorNode, index: number, mark: Mark): number {
  let start = index;
  while (start > 0 && mark.isInSet(parent.child(start - 1).marks)) {
    start -= 1;
  }
  return markReach(parent, index, mark) - start;
}

function belongsInsideLink(mark: Mark, span: number, linkSpan: number): boolean {
  if (span < linkSpan) {
    return true;
  }
  if (span > linkSpan) {
    return false;
  }
  return mark.type.name === 'code' || mark.type.name === 'strikethrough';
}

function linkOutside(
  parent: ProseMirrorNode,
  index: number,
  marks: readonly Mark[]
): readonly Mark[] {
  const link = marks.find((mark) => mark.type.name === 'link');
  if (!link) {
    return marks;
  }
  const linkSpan = markSpan(parent, index, link);
  const inside = marks.filter(
    (mark) => mark !== link && belongsInsideLink(mark, markSpan(parent, index, mark), linkSpan)
  );
  if (inside.length === 0) {
    return marks;
  }
  return [...marks.filter((mark) => !inside.includes(mark)), ...inside];
}

const NBSP_MARK = '\uE030';
const TAB_MARK = '\uE031';
const LINE_MARK = '\uE032';

function shieldWhitespace(node: ProseMirrorNode): ProseMirrorNode {
  if (!node.isText || node.marks.some((mark) => mark.type.name === 'code')) {
    return node;
  }
  const text = node.text ?? '';
  if (!/[\u00A0\t\n]/.test(text)) {
    return node;
  }
  const shielded = text
    .replaceAll('\u00A0', NBSP_MARK)
    .replaceAll('\t', TAB_MARK)
    .replaceAll('\n', LINE_MARK);
  return replaceText(node, shielded);
}

export function restorePreservedWhitespace(text: string): string {
  return text
    .replaceAll(NBSP_MARK, '&nbsp;')
    .replaceAll(TAB_MARK, '&#9;')
    .replaceAll(LINE_MARK, '&#10;');
}

function presentChild(
  parent: ProseMirrorNode,
  index: number,
  node: ProseMirrorNode
): ProseMirrorNode {
  const source = shieldWhitespace(node);
  const ordered = emphasisMarks(parent, index, strikeOutsideCode(source.marks));
  const marks = linkOutside(parent, index, ordered);
  const handler: ProxyHandler<ProseMirrorNode> = {
    get(target, prop) {
      if (prop === 'marks') {
        return marks;
      }
      if (prop === 'withText') {
        return (text: string) => presentChild(parent, index, replaceText(target, text));
      }
      return readProperty(target, prop);
    },
  };
  return new Proxy(source, handler);
}

export function emphasizeOutside(parent: ProseMirrorNode): ProseMirrorNode {
  const handler: ProxyHandler<ProseMirrorNode> = {
    get(target, prop) {
      if (prop === 'child') {
        return (index: number) => presentChild(target, index, target.child(index));
      }
      if (prop === 'forEach') {
        return (visit: (node: ProseMirrorNode, offset: number, index: number) => void) => {
          target.forEach((node, offset, index) => {
            visit(presentChild(target, index, node), offset, index);
          });
        };
      }
      return readProperty(target, prop);
    },
  };
  return new Proxy(parent, handler);
}
