import { Fragment, type Attrs, type Mark, type Node as ProseMirrorNode } from 'prosemirror-model';

import { restoreMathMarkup } from './prosemirror-tex-protect';

function restoredAttrs(attrs: Attrs): Attrs | null {
  const next: Record<string, unknown> = {};
  let changed = false;
  for (const key of Object.keys(attrs)) {
    const value: unknown = attrs[key];
    if (typeof value === 'string') {
      const restored = restoreMathMarkup(value);
      next[key] = restored;
      changed = changed || restored !== value;
    } else {
      next[key] = value;
    }
  }
  return changed ? next : null;
}

function restoredMarks(marks: readonly Mark[]): readonly Mark[] {
  return marks.map((mark) => {
    const attrs = restoredAttrs(mark.attrs);
    return attrs ? mark.type.create(attrs) : mark;
  });
}

function restoredMathText(node: ProseMirrorNode): ProseMirrorNode | null {
  const restored = restoreMathMarkup(node.text ?? '');
  if (restored.length === 0) {
    return null;
  }
  const marks = restoredMarks(node.marks);
  const sameMarks = marks.every((mark, index) => mark === node.marks[index]);
  if (restored === node.text && sameMarks) {
    return node;
  }
  return node.type.schema.text(restored, marks);
}

export function restoreMathMarkupNode(node: ProseMirrorNode): ProseMirrorNode {
  if (node.isText) {
    return restoredMathText(node) ?? node;
  }
  const children: ProseMirrorNode[] = [];
  node.forEach((child) => {
    if (child.isText) {
      const text = restoredMathText(child);
      if (text) {
        children.push(text);
      }
      return;
    }
    children.push(restoreMathMarkupNode(child));
  });
  const attrs = restoredAttrs(node.attrs);
  const sameChildren =
    children.length === node.childCount &&
    children.every((child, index) => child === node.child(index));
  if (!attrs && sameChildren) {
    return node;
  }
  return node.type.create(attrs ?? node.attrs, Fragment.from(children), node.marks);
}
