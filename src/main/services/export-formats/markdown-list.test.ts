import { describe, expect, it } from 'vitest';

import {
  closeHtmlLists,
  parseListItem,
  pushHtmlListItem,
  shouldOpenListItem,
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
    expect(parseListItem('3. third')).toEqual({
      level: 0,
      ordered: true,
      start: 3,
      text: 'third',
      delimiter: '.',
    });
    expect(parseListItem('1) one')).toEqual({
      level: 0,
      ordered: true,
      start: 1,
      text: 'one',
      delimiter: ')',
    });
    expect(parseListItem('0. zero')).toEqual({
      level: 0,
      ordered: true,
      start: 0,
      text: 'zero',
      delimiter: '.',
    });
    expect(parseListItem('not a list')).toBeNull();
    const third = parseListItem('14. doors');
    expect(third && shouldOpenListItem(third, [], false, true)).toBe(false);
    const first = parseListItem('1. doors');
    expect(first && shouldOpenListItem(first, [], false, true)).toBe(true);
    const nested = parseListItem('  2. bar');
    expect(
      nested &&
        shouldOpenListItem(nested, [{ level: 0, kind: 'ul', delimiter: '' }], false, false)
    ).toBe(false);
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
