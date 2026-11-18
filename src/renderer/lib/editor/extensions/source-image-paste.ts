import { EditorView } from '@codemirror/view';

import { clipboardImage, readClipboardImage } from '../wysiwyg-paste-image';

function imageMarkdown(alt: string, src: string): string {
  const safe = alt.replaceAll(']', '\\]').replaceAll('\n', ' ');
  return `![${safe}](${src})`;
}

function positionAfterFence(doc: EditorView['state']['doc'], pos: number): number | null {
  const cursorLine = doc.lineAt(pos).number;
  let marker = '';
  let openAt = 0;
  for (let number = cursorLine; number >= 1; number -= 1) {
    const match = /^(```+|~~~+)/.exec(doc.line(number).text);
    if (!match?.[1]) {
      continue;
    }
    openAt = number;
    marker = match[1];
    break;
  }
  if (openAt === 0) {
    return null;
  }
  for (let number = openAt + 1; number <= doc.lines; number += 1) {
    const line = doc.line(number);
    if (line.text.startsWith(marker) && pos <= line.to) {
      return line.to;
    }
  }
  return null;
}

/** Insert a picture's Markdown at the source caret. */
export async function insertSourceImage(view: EditorView, file: File): Promise<boolean> {
  const picture = await readClipboardImage(file);
  if (!picture) {
    return false;
  }
  const selection = view.state.selection.main;
  const afterFence = positionAfterFence(view.state.doc, selection.from);
  const markdown = imageMarkdown(picture.alt, picture.src);
  const insert = afterFence === null ? markdown : `\n${markdown}`;
  const from = afterFence ?? selection.from;
  const to = afterFence ?? selection.to;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
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
