import { describe, expect, it } from 'vitest';

import { rewriteSimpleHtml } from './markdown-simple-html';

describe('rewriteSimpleHtml', () => {
  it('turns an HTML list into a markdown list', () => {
    expect(rewriteSimpleHtml('<ul><li>One</li><li>Two</li></ul>').trim()).toBe('- One\n- Two');
  });

  it('turns a wrapper and bold text into markdown', () => {
    expect(rewriteSimpleHtml('<div>\nHello <b>there</b>\n</div>\n\nAfter').trim()).toBe(
      'Hello **there**\n\nAfter'
    );
  });

  it('turns a heading break into one heading', () => {
    expect(rewriteSimpleHtml('<h1>A<br>B</h1>').trim()).toBe('# A B');
  });

  it('leaves a fenced sample and inline code unchanged', () => {
    expect(rewriteSimpleHtml('```\n<div>x</div>\n```')).toBe('```\n<div>x</div>\n```');
    expect(rewriteSimpleHtml('`<div>x</div>`')).toBe('`<div>x</div>`');
  });

  it('quotes an HTML blockquote', () => {
    expect(rewriteSimpleHtml('<blockquote>Quote</blockquote>').trim()).toBe('> Quote');
  });
});
