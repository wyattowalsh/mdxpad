import { describe, expect, it } from 'vitest';

import {
  closeHtmlLists,
  parseListItem,
  pushHtmlListItem,
  type HtmlListFrame,
} from './markdown-list';

describe('parseListItem', () => {
  it('reads a nested item and a plain line', () => {
    expect(parseListItem('- parent')).toEqual({ level: 0, ordered: false, text: 'parent' });
    expect(parseListItem('  - child')).toEqual({ level: 1, ordered: false, text: 'child' });
    expect(parseListItem('1. first')).toEqual({ level: 0, ordered: true, text: 'first' });
    expect(parseListItem('not a list')).toBeNull();
  });

  it('nests a child list inside its parent', () => {
    const parts: string[] = [];
    const stack: HtmlListFrame[] = [];
    pushHtmlListItem(parts, stack, { level: 0, ordered: false, text: 'parent' }, 'parent');
    pushHtmlListItem(parts, stack, { level: 1, ordered: false, text: 'child' }, 'child');
    closeHtmlLists(parts, stack);
    expect(parts.join('\n')).toBe('<ul>\n<li>parent</li>\n<ul>\n<li>child</li>\n</ul>\n</ul>');
  });
});
