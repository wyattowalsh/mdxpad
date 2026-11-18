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

/** Read a pasted picture and insert it at the caret. */
export function insertPastedImage(view: EditorView, file: File): Promise<boolean> {
  return readClipboardImage(file).then((picture) => {
    const image = picture ? view.state.schema.nodes.image?.create(picture) : null;
    if (!image) {
      return false;
    }
    view.dispatch(view.state.tr.replaceSelectionWith(image).scrollIntoView());
    view.focus();
    return true;
  });
}
