/**
 * Cmd/Ctrl-click an import path or a component in the visual editor.
 */

import type { EditorView } from 'prosemirror-view';

import { findImportForComponent, parseImports } from './extensions/go-to-definition';
import { sourceOffsetAt } from './wysiwyg-cursor';
import { serializeMdxContent } from './prosemirror-mdx-serializer';
import { openImportSpecifier } from '@renderer/lib/open-import';

function wordAt(text: string, offset: number): string | null {
  let from = offset;
  let to = offset;
  while (from > 0 && /[A-Za-z0-9.]/.test(text[from - 1] ?? '')) {
    from -= 1;
  }
  while (to < text.length && /[A-Za-z0-9.]/.test(text[to] ?? '')) {
    to += 1;
  }
  const word = text.slice(from, to);
  return word.length > 0 ? word : null;
}

/** The relative import path under this source offset, when one is known. */
export function importTargetAt(markdown: string, offset: number): string | null {
  const imports = parseImports(markdown);
  for (const item of imports) {
    if (offset >= item.pathFrom && offset <= item.pathTo) {
      return item.path;
    }
  }
  const word = wordAt(markdown, offset);
  if (!word) {
    return null;
  }
  return findImportForComponent(imports, word)?.path ?? null;
}

/** Open the import under a modifier click. Plain clicks stay in the editor. */
export function handleVisualImportClick(view: EditorView, pos: number, event: MouseEvent): boolean {
  if (!event.metaKey && !event.ctrlKey) {
    return false;
  }
  const markdown = serializeMdxContent(view.state.doc);
  const offset = sourceOffsetAt(view.state.doc, pos);
  if (offset === null) {
    return false;
  }
  const target = importTargetAt(markdown, offset);
  if (!target) {
    return false;
  }
  event.preventDefault();
  openImportSpecifier(target);
  return true;
}
