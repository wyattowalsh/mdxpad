import { NodeSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/** The first image on a clipboard or drop, when one is present. */
export function clipboardImage(data: DataTransfer | null): File | null {
  if (!data) {
    return null;
  }
  for (const item of Array.from(data.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }
  const file = data.files.item(0);
  return file?.type.startsWith('image/') ? file : null;
}

function imageAlt(file: File): string {
  const name = file.name.replace(/\.[^.]+$/, '').trim();
  return name.length > 0 ? name : 'image';
}

export interface ClipboardPicture {
  readonly src: string;
  readonly alt: string;
}

/** Read a picture file into a data URL the document can store. */
export function readClipboardImage(file: File): Promise<ClipboardPicture | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => {
      resolve(null);
    };
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      resolve(src.startsWith('data:image/') ? { src, alt: imageAlt(file) } : null);
    };
    reader.readAsDataURL(file);
  });
}

function positionAfterCode(view: EditorView): number | null {
  const { selection } = view.state;
  if (selection instanceof NodeSelection && selection.node.type.spec.code === true) {
    return selection.to;
  }
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.spec.code === true) {
      return $from.after(depth);
    }
  }
  return null;
}

/** Read a pasted picture and insert it at the caret. */
export function insertPastedImage(view: EditorView, file: File): Promise<boolean> {
  return readClipboardImage(file).then((picture) => {
    const image = picture ? view.state.schema.nodes.image?.create(picture) : null;
    const paragraph = image ? view.state.schema.nodes.paragraph?.create(null, image) : null;
    if (!image || !paragraph) {
      return false;
    }
    const afterCode = positionAfterCode(view);
    const tr =
      afterCode === null
        ? view.state.tr.replaceSelectionWith(image)
        : view.state.tr.insert(afterCode, paragraph);
    view.dispatch(tr.scrollIntoView());
    view.focus();
    return true;
  });
}
