import { Fragment, type Node as ProseMirrorNode } from 'prosemirror-model';

import {
  expandAutolinkText,
  protectAutolinks,
} from '../../../main/services/export-formats/markdown-autolink';

function linkedText(node: ProseMirrorNode): readonly ProseMirrorNode[] {
  const text = node.text ?? '';
  const marked = node.marks.some((mark) => mark.type.name === 'link' || mark.type.name === 'code');
  if (marked || text.length === 0) {
    return [node];
  }
  const protectedText = protectAutolinks(text);
  if (protectedText.links.length === 0) {
    return [node];
  }
  const link = node.type.schema.marks.link;
  if (!link) {
    return [node];
  }
  return expandAutolinkText(protectedText.text, protectedText.links).flatMap((part) => {
    if (part.text.length === 0) {
      return [];
    }
    const marks = part.href ? link.create({ href: part.href }).addToSet(node.marks) : node.marks;
    return [node.type.schema.text(part.text, marks)];
  });
}

function mapNode(node: ProseMirrorNode): ProseMirrorNode {
  if (node.isText || node.childCount === 0 || node.type.spec.code === true) {
    return node;
  }
  const children: ProseMirrorNode[] = [];
  node.forEach((child) => {
    if (child.isText) {
      children.push(...linkedText(child));
      return;
    }
    children.push(mapNode(child));
  });
  return node.copy(Fragment.from(children));
}

/** Turn bare web addresses and email addresses into links, matching export. */
export function linkBareAddresses(doc: ProseMirrorNode): ProseMirrorNode {
  return mapNode(doc);
}
