import { Fragment, type Node as ProseMirrorNode } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';

const TASK_MARKER = /^\[([ xX])\](?:[ \t]+|$)/;

function mapChildren(node: ProseMirrorNode): ProseMirrorNode {
  if (node.childCount === 0) {
    return node;
  }
  const children: ProseMirrorNode[] = [];
  node.forEach((child) => {
    children.push(liftTaskNode(child));
  });
  return node.copy(Fragment.from(children));
}

function taskState(node: ProseMirrorNode): 'open' | 'done' | null {
  const attrs: { readonly task?: unknown } = node.attrs;
  const raw = attrs.task;
  return raw === 'open' || raw === 'done' ? raw : null;
}

function liftItem(node: ProseMirrorNode): ProseMirrorNode {
  const paragraph = node.firstChild;
  const text = paragraph?.firstChild;
  const value = text?.isText === true ? (text.text ?? '') : '';
  const match = paragraph?.type.name === 'paragraph' ? TASK_MARKER.exec(value) : null;
  if (paragraph?.type.name !== 'paragraph' || text?.isText !== true || match?.index !== 0) {
    return node;
  }
  const rest = value.slice(match[0].length);
  const kept: ProseMirrorNode[] = [];
  if (rest.length > 0) {
    kept.push(node.type.schema.text(rest, text.marks));
  }
  for (let index = 1; index < paragraph.childCount; index += 1) {
    kept.push(paragraph.child(index));
  }
  const task = match[1] === ' ' ? 'open' : 'done';
  const itemChildren: ProseMirrorNode[] = [paragraph.copy(Fragment.from(kept))];
  for (let index = 1; index < node.childCount; index += 1) {
    itemChildren.push(node.child(index));
  }
  return node.type.create({ ...node.attrs, task }, Fragment.from(itemChildren), node.marks);
}

function liftTaskNode(node: ProseMirrorNode): ProseMirrorNode {
  const mapped = mapChildren(node);
  return mapped.type.name === 'list_item' ? liftItem(mapped) : mapped;
}

/** Store `[ ]` and `[x]` on the list item instead of as paragraph text. */
export function liftTaskItems(doc: ProseMirrorNode): ProseMirrorNode {
  return liftTaskNode(doc);
}

export function taskMarker(item: ProseMirrorNode): string {
  const task = taskState(item);
  if (task === 'done') {
    return '[x] ';
  }
  if (task === 'open') {
    return '[ ] ';
  }
  return '';
}

/** Checkbox for a task item. The markdown marker stays on the node attribute. */
export class TaskListItemView implements NodeView {
  readonly dom: HTMLLIElement;
  readonly contentDOM: HTMLDivElement;
  private box: HTMLInputElement | null = null;

  constructor(
    private node: ProseMirrorNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined
  ) {
    this.dom = document.createElement('li');
    this.contentDOM = document.createElement('div');
    this.dom.append(this.contentDOM);
    this.sync(node);
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type.name !== 'list_item') {
      return false;
    }
    this.node = node;
    this.sync(node);
    return true;
  }

  stopEvent(event: Event): boolean {
    return event.target === this.box;
  }

  private sync(node: ProseMirrorNode): void {
    const task = taskState(node);
    this.dom.dataset.task = task ?? '';
    if (!task) {
      this.box?.remove();
      this.box = null;
      return;
    }
    if (!this.box) {
      this.box = document.createElement('input');
      this.box.type = 'checkbox';
      this.box.addEventListener('change', () => {
        this.toggle();
      });
      this.dom.insertBefore(this.box, this.contentDOM);
    }
    this.box.checked = task === 'done';
  }

  private toggle(): void {
    const pos = this.getPos();
    const current = typeof pos === 'number' ? this.view.state.doc.nodeAt(pos) : null;
    if (typeof pos !== 'number' || !current || !this.box) {
      return;
    }
    const task = this.box.checked ? 'done' : 'open';
    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, task })
    );
  }
}
