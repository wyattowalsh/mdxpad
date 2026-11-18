import { describe, expect, it } from 'vitest';

import {
  listFenceOnMarker,
  openListFence,
  readListFenceLine,
  readListQuoteLine,
  readOpenListQuote,
} from './markdown-list-fence';

describe('list fences', () => {
  it('reads a fence indented to the list content column', () => {
    const opened = openListFence('  ```js', 2);
    expect(opened).toEqual({ marker: '```', language: 'js', indent: 2 });
    const state = { marker: '```', language: 'js', indent: 2, lines: [] as string[] };
    expect(readListFenceLine(state, '  const x = 1', 2)).toBe('open');
    expect(readListFenceLine(state, '  ```', 2)).toBe('closed');
    expect(state.lines).toEqual(['const x = 1']);
    expect(listFenceOnMarker('- ```js', 2)?.indent).toBe(2);
    expect(listFenceOnMarker('1) ```js', 3)?.indent).toBe(3);
    expect(listFenceOnMarker('10) ```python', 4)?.language).toBe('python');
    expect(openListFence('```js', 2)).toBeNull();
    expect(readOpenListQuote('  > quoted', 2)).toBe('quoted');
    expect(readListQuoteLine('  line', 2)).toBe('line');
    expect(readOpenListQuote('> quoted', 2)).toBeNull();
  });
});
