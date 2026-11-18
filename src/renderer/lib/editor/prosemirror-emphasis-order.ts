/**
 * The markdown serializer stores bold before italic and closes marks from
 * the end of that list. A mark that continues onto the next word has to be
 * opened first, so closing the inner mark leaves the outer one in place.
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

function presentChild(
  parent: ProseMirrorNode,
  index: number,
  node: ProseMirrorNode
): ProseMirrorNode {
  const marks = emphasisMarks(parent, index, strikeOutsideCode(node.marks));
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
  return new Proxy(node, handler);
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
