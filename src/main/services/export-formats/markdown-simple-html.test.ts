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

  it('turns a definition list, a disclosure, a key, and an abbreviation into text', () => {
    expect(rewriteSimpleHtml('<dl><dt>Term</dt><dd>definition</dd></dl>').trim()).toBe(
      '**Term**\n\ndefinition'
    );
    expect(rewriteSimpleHtml('<details><summary>More</summary>\nHidden\n</details>').trim()).toBe(
      '**More**\n\nHidden'
    );
    expect(rewriteSimpleHtml('Press <kbd>Cmd</kbd> now')).toBe('Press `Cmd` now');
    expect(rewriteSimpleHtml('See <ins>added</ins> now')).toBe('See <u>added</u> now');
    expect(rewriteSimpleHtml('<abbr title="Hypertext">HTML</abbr>')).toBe('HTML (Hypertext)');
  });

  it('turns a ruby annotation into the character and its reading', () => {
    expect(rewriteSimpleHtml('<ruby>漢<rt>kan</rt></ruby>')).toBe('漢 (kan)');
    expect(rewriteSimpleHtml('<ruby>漢<rp>(</rp><rt>kan</rt><rp>)</rp></ruby>')).toBe('漢 (kan)');
    expect(rewriteSimpleHtml('<ruby>漢<rt>kan</rt>字<rt>ji</rt></ruby>')).toBe('漢 (kan) 字 (ji)');
  });

  it('turns a quotation, a citation, a sample, and a time into text', () => {
    expect(rewriteSimpleHtml('See <q>quoted</q> now')).toBe('See “quoted” now');
    expect(rewriteSimpleHtml('Read <cite>Title</cite> and <var>x</var>')).toBe(
      'Read *Title* and *x*'
    );
    expect(rewriteSimpleHtml('<samp>ok</samp>')).toBe('`ok`');
    expect(rewriteSimpleHtml('Price <small>was $5</small>')).toBe('Price was $5');
    expect(rewriteSimpleHtml('<time datetime="2020-01-01">then</time>')).toBe(
      'then (2020-01-01)'
    );
  });

  it('keeps a table caption with the table', () => {
    const html = '<table><caption>Prices</caption><tr><td>A</td></tr></table>';
    expect(rewriteSimpleHtml(html).trim()).toBe('Prices\n\n| A |\n| --- |');
  });

  it('turns an HTML table into a markdown table', () => {
    const html = [
      '<table>',
      '<tr><th>Name</th><th align="right">Amount</th></tr>',
      '<tr><td>A | B</td><td>2</td></tr>',
      '</table>',
    ].join('');
    expect(rewriteSimpleHtml(html).trim()).toBe(
      ['| Name | Amount |', '| --- | ---: |', '| A \\| B | 2 |'].join('\n')
    );
  });
});
