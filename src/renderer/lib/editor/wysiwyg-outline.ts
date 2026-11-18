import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import type { OutlineItem } from '@shared/types/outline';
import { useOutlineStore } from '@renderer/stores/outline-store';

let focusOutline: ((item: OutlineItem) => boolean) | null = null;

/** The visual editor registers this while it is on screen. */
export function registerWysiwygOutline(focus: ((item: OutlineItem) => boolean) | null): void {
  focusOutline = focus;
}

/** Move the visual caret to an outline item. Returns false when that editor is closed. */
export function focusWysiwygOutline(item: OutlineItem): boolean {
  return focusOutline?.(item) ?? false;
}

function headingLevel(node: ProseMirrorNode): number {
  const raw: unknown = node.attrs.level;
  return typeof raw === 'number' ? raw : 0;
}

function labelsMatch(text: string, label: string): boolean {
  const trimmed = text.trim();
  if (label.endsWith('...')) {
    const prefix = label.slice(0, -3).trim();
    return prefix.length > 0 && trimmed.startsWith(prefix);
  }
  return trimmed === label;
}

function flatten(items: readonly OutlineItem[]): OutlineItem[] {
  const result: OutlineItem[] = [];
  for (const item of items) {
    result.push(item);
    if (item.children.length > 0) {
      result.push(...flatten(item.children));
    }
  }
  return result;
}

function occurrence(item: OutlineItem, sectionId: 'headings' | 'components'): number {
  const section = useOutlineStore.getState().sections.find((entry) => entry.id === sectionId);
  let count = 0;
  for (const entry of flatten(section?.items ?? [])) {
    if (entry.id === item.id) {
      return count;
    }
    if (entry.level === item.level && entry.label === item.label) {
      count += 1;
    }
  }
  return 0;
}

function focusAt(view: EditorView, pos: number): boolean {
  const selection = TextSelection.near(view.state.doc.resolve(pos));
  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
  view.focus();
  return true;
}

/** Move the caret to the heading that matches this outline entry. */
function matchingPositions(
  doc: ProseMirrorNode,
  matches: (node: ProseMirrorNode) => boolean
): number[] {
  const positions: number[] = [];
  doc.descendants((node, pos) => {
    if (matches(node)) {
      positions.push(pos + 1);
    }
    return true;
  });
  return positions;
}

/** Move the caret to the heading that matches this outline entry. */
export function focusHeadingInView(
  view: EditorView,
  level: number,
  label: string,
  index: number
): boolean {
  const target = matchingPositions(
    view.state.doc,
    (node) =>
      node.type.name === 'heading' &&
      headingLevel(node) === level &&
      labelsMatch(node.textContent, label)
  )[index];
  return target === undefined ? false : focusAt(view, target);
}

function focusComponentInView(view: EditorView, name: string, index: number): boolean {
  const target = matchingPositions(
    view.state.doc,
    (node) =>
      (node.type.name === 'jsx_block' || node.type.name === 'jsx_inline') &&
      node.textContent.includes(name)
  )[index];
  return target === undefined ? false : focusAt(view, target);
}

/** Move the caret to the outline entry in this visual document. */
export function focusOutlineInView(view: EditorView, item: OutlineItem): boolean {
  switch (item.type) {
    case 'frontmatter':
      return focusAt(view, 0);
    case 'component':
      return focusComponentInView(view, item.label, occurrence(item, 'components'));
    case 'heading':
      return focusHeadingInView(view, item.level, item.label, occurrence(item, 'headings'));
    default: {
      const unreachable: never = item.type;
      return unreachable;
    }
  }
}
