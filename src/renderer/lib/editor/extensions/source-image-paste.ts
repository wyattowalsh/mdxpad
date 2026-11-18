import { EditorView } from '@codemirror/view';

import { clipboardImage, readClipboardImage } from '../wysiwyg-paste-image';

function imageMarkdown(alt: string, src: string): string {
  const safe = alt.replaceAll(']', '\\]').replaceAll('\n', ' ');
  return `![${safe}](${src})`;
}

/** Insert a picture's Markdown at the source caret. */
export async function insertSourceImage(view: EditorView, file: File): Promise<boolean> {
  const picture = await readClipboardImage(file);
  if (!picture) {
    return false;
  }
  const selection = view.state.selection.main;
  const markdown = imageMarkdown(picture.alt, picture.src);
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: markdown },
    selection: { anchor: selection.from + markdown.length },
  });
  view.focus();
  return true;
}

function takeImage(view: EditorView, data: DataTransfer | null): boolean {
  const file = clipboardImage(data);
  if (!file) {
    return false;
  }
  void insertSourceImage(view, file);
  return true;
}

/** Paste or drop a picture into the source editor as Markdown. */
export function sourceImagePasteExtension() {
  return EditorView.domEventHandlers({
    paste(event, view) {
      if (!takeImage(view, event.clipboardData)) {
        return false;
      }
      event.preventDefault();
      return true;
    },
    drop(event, view) {
      if (!takeImage(view, event.dataTransfer)) {
        return false;
      }
      event.preventDefault();
      return true;
    },
  });
}
