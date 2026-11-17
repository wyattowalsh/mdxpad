import { describe, expect, it } from 'vitest';

import {
  closeHtmlLists,
  parseListItem,
  pushHtmlListItem,
  type HtmlListFrame,
} from './markdown-list';

describe('parseListItem', () => {
  it('reads a nested item and a plain line', () => {
    expect(parseListItem('- parent')).toEqual({
      level: 0,
      ordered: false,
      start: 1,
      text: 'parent',
    });
    expect(parseListItem('  - child')).toEqual({
      level: 1,
      ordered: false,
      start: 1,
      text: 'child',
    });
    expect(parseListItem('3. third')).toEqual({ level: 0, ordered: true, start: 3, text: 'third' });
    expect(parseListItem('not a list')).toBeNull();
  });

  it('nests a child list inside its parent', () => {
    const parts: string[] = [];
    const stack: HtmlListFrame[] = [];
    pushHtmlListItem(
      parts,
      stack,
      { level: 0, ordered: false, start: 1, text: 'parent' },
      'parent'
    );
    pushHtmlListItem(parts, stack, { level: 1, ordered: false, start: 1, text: 'child' }, 'child');
    closeHtmlLists(parts, stack);
    expect(parts.join('\n')).toBe('<ul>\n<li>parent\n<ul>\n<li>child</li>\n</ul>\n</li>\n</ul>');
  });
});
