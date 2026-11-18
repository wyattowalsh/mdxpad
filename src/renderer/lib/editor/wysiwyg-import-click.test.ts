import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { openImportSpecifier } from '@renderer/lib/open-import';
import { mdxSchema } from './prosemirror-mdx-schema';
import { documentFromMarkdown } from './wysiwyg-document';
import { handleVisualImportClick, importTargetAt } from './wysiwyg-import-click';

vi.mock('@renderer/lib/open-import', () => ({
  openImportSpecifier: vi.fn(),
}));

const SOURCE = "import Button from './Button'\n\n<Button />\n";

describe('visual import clicks', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    vi.mocked(openImportSpecifier).mockClear();
    for (const view of views.splice(0)) {
      view.dom.parentElement?.remove();
      view.destroy();
    }
  });

  it('finds the path under the specifier and under the component', () => {
    expect(importTargetAt(SOURCE, SOURCE.indexOf('./Button') + 2)).toBe('./Button');
    expect(importTargetAt(SOURCE, SOURCE.indexOf('<Button') + 2)).toBe('./Button');
    expect(importTargetAt(SOURCE, 0)).toBeNull();
  });

  it('opens the import on a modifier click and ignores a plain click', () => {
    const doc = documentFromMarkdown(SOURCE);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, {
      state: EditorState.create({ doc, schema: mdxSchema }),
    });
    views.push(view);
    let pos = 0;
    view.state.doc.descendants((node, position) => {
      if (node.isText && node.text?.includes('./Button')) {
        pos = position + (node.text.indexOf('./Button') + 2);
      }
    });
    expect(pos).toBeGreaterThan(0);
    const plain = new MouseEvent('click', { bubbles: true, cancelable: true });
    expect(handleVisualImportClick(view, pos, plain)).toBe(false);
    expect(openImportSpecifier).not.toHaveBeenCalled();
    const modified = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      metaKey: true,
    });
    expect(handleVisualImportClick(view, pos, modified)).toBe(true);
    expect(openImportSpecifier).toHaveBeenCalledWith('./Button');
  });
});
