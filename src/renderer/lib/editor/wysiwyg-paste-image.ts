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

function placeImage(view: EditorView, file: File, result: string | ArrayBuffer | null): boolean {
  const src = typeof result === 'string' ? result : '';
  const image = src.startsWith('data:image/')
    ? view.state.schema.nodes.image?.create({ src, alt: imageAlt(file) })
    : null;
  if (!image) {
    return false;
  }
  view.dispatch(view.state.tr.replaceSelectionWith(image).scrollIntoView());
  view.focus();
  return true;
}

/** Read a pasted picture and insert it at the caret. */
export function insertPastedImage(view: EditorView, file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => {
      resolve(false);
    };
    reader.onload = () => {
      resolve(placeImage(view, file, reader.result));
    };
    reader.readAsDataURL(file);
  });
}
