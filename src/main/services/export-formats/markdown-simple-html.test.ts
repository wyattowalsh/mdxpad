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

  it('shows text typed into a form control', () => {
    expect(rewriteSimpleHtml('Name <input type="text" value="Ada">')).toBe('Name Ada');
    expect(rewriteSimpleHtml('<textarea>Hello</textarea>').trim()).toBe('Hello');
    expect(
      rewriteSimpleHtml('<select><option>Red</option><option selected>Blue</option></select>').trim()
    ).toBe('Red, **Blue**');
    expect(rewriteSimpleHtml('<button>Save</button>').trim()).toBe('Save');
    expect(rewriteSimpleHtml('<input type="hidden" value="secret">')).toBe('');
    expect(rewriteSimpleHtml('<progress value="3" max="10">3/10</progress>').trim()).toBe('3/10');
  });

  it('turns HTML checkboxes into task markers', () => {
    const html = [
      '<ul>',
      '<li><input type="checkbox" checked> done</li>',
      '<li><input type="checkbox" checked="checked" /> also</li>',
      '<li><input type="checkbox"> todo</li>',
      '</ul>',
    ].join('');
    expect(rewriteSimpleHtml(html).trim()).toBe('- [x] done\n- [x] also\n- [ ] todo');
  });

  it('keeps letters, roman numerals, and a reversed list', () => {
    expect(rewriteSimpleHtml('<ol type="a"><li>One</li><li>Two</li></ol>').trim()).toBe(
      '- a. One\n- b. Two'
    );
    expect(rewriteSimpleHtml('<ol type="i" start="4"><li>Four</li></ol>').trim()).toBe('- iv. Four');
    expect(
      rewriteSimpleHtml('<ol reversed><li>One</li><li>Two</li><li>Three</li></ol>').trim()
    ).toBe('- 3. One\n- 2. Two\n- 1. Three');
    expect(rewriteSimpleHtml('<ol><li>One</li><li value="5">Five</li></ol>').trim()).toBe(
      '- 1. One\n- 5. Five'
    );
  });

  it('keeps an ordered list start and a footer after the body', () => {
    expect(rewriteSimpleHtml('<ol start="3"><li>Three</li><li>Four</li></ol>').trim()).toBe(
      '3. Three\n4. Four'
    );
    const table = [
      '<table>',
      '<tfoot><tr><td>Total</td><td>9</td></tr></tfoot>',
      '<tbody><tr><td>A</td><td>1</td></tr></tbody>',
      '</table>',
    ].join('');
    expect(rewriteSimpleHtml(table).trim()).toBe('| A | 1 |\n| --- | --- |\n| Total | 9 |');
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
