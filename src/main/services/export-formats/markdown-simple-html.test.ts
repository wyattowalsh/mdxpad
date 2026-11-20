import { describe, expect, it } from 'vitest';

import { prepareMarkdownSource } from '@shared/lib/markdown-math';

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
    expect(rewriteSimpleHtml('<time datetime="2020-01-01">then</time>')).toBe('then (2020-01-01)');
  });

  it('hides an HTML comment and keeps the words around it', () => {
    expect(rewriteSimpleHtml('See <!-- secret note --> this')).toBe('See this');
    expect(rewriteSimpleHtml('<svg><text>Hello<!-- secret --> there</text></svg>').trim()).toBe(
      'Hello there'
    );
    expect(rewriteSimpleHtml('<ruby>漢<!-- x --><rt>kan</rt></ruby>')).toBe('漢 (kan)');
    expect(rewriteSimpleHtml('See <!-- forever this')).toBe('See <!-- forever this');
    expect(rewriteSimpleHtml('`<!-- keep -->`')).toBe('`<!-- keep -->`');
    expect(rewriteSimpleHtml('```\n<!-- keep -->\n```')).toBe('```\n<!-- keep -->\n```');
  });

  it('shows a canvas fallback and joins a word break', () => {
    expect(rewriteSimpleHtml('<canvas>Chart of sales</canvas>').trim()).toBe('Chart of sales');
    expect(rewriteSimpleHtml('super<wbr>cali')).toBe('supercali');
  });

  it('links the words inside a block link', () => {
    expect(rewriteSimpleHtml('<a href="https://example.com"><div>Docs</div></a>').trim()).toBe(
      '[Docs](https://example.com)'
    );
    expect(
      rewriteSimpleHtml('<a href="https://example.com"><p>Read the guide</p></a>').trim()
    ).toBe('[Read the guide](https://example.com)');
    expect(rewriteSimpleHtml('<a href="file:///etc/passwd"><div>Docs</div></a>')).not.toContain(
      '](file:'
    );
  });

  it('shows a MathML formula as text', () => {
    expect(rewriteSimpleHtml('<math><mi>x</mi><mo>+</mo><mn>2</mn></math>')).toBe('x + 2');
    expect(rewriteSimpleHtml('<math><mfrac><mi>a</mi><mi>b</mi></mfrac></math>')).toBe('a/b');
    expect(rewriteSimpleHtml('<math><msup><mi>x</mi><mn>2</mn></msup></math>')).toBe('x^2^');
    expect(rewriteSimpleHtml('<math><msub><mi>H</mi><mn>2</mn></msub><mi>O</mi></math>')).toBe(
      'H~2~ O'
    );
    expect(
      rewriteSimpleHtml(
        '<math><semantics><mi>x</mi><annotation>secret</annotation></semantics></math>'
      )
    ).toBe('x');
  });

  it('shows the words inside an MDX component', () => {
    expect(rewriteSimpleHtml('<Callout>Remember the ice</Callout>').trim()).toBe(
      'Remember the ice'
    );
    expect(rewriteSimpleHtml('<Button>Save</Button> now')).toBe('Save now');
    expect(rewriteSimpleHtml('<Callout><strong>Remember</strong> the ice</Callout>').trim()).toBe(
      '**Remember** the ice'
    );
    expect(rewriteSimpleHtml('Hello<br class="soft">World')).toBe('Hello<br class="soft">World');
    expect(rewriteSimpleHtml('<img alt="Cat" src="cat.png" />')).toBe('![Cat](cat.png)');
  });

  it('keeps a wrapped definition, an open list, and a linked picture', () => {
    expect(
      rewriteSimpleHtml('<dl><div><dt>Term</dt><dd>The definition</dd></div></dl>').trim()
    ).toBe('**Term**\n\nThe definition');
    expect(rewriteSimpleHtml('<ul><li>Alpha<li>Beta</ul>').trim()).toBe('- Alpha\n- Beta');
    expect(rewriteSimpleHtml('<table><tr><td>Left<td>Right</tr></table>').trim()).toBe(
      '| Left | Right |\n| --- | --- |'
    );
    expect(rewriteSimpleHtml('<table><tr><td>Left<td>Right<tr><td>A<td>B</table>').trim()).toBe(
      '| Left | Right |\n| --- | --- |\n| A | B |'
    );
    expect(
      rewriteSimpleHtml('<ul><li>Outer<ul><li>Inner</li></ul></li><li>Next</li></ul>')
    ).toContain('Inner');
    expect(
      rewriteSimpleHtml(
        '<a href="https://example.com"><img alt="Cat photo" src="cat.png"></a>'
      ).trim()
    ).toBe('[![Cat photo](cat.png)](https://example.com)');
    expect(
      rewriteSimpleHtml('<a href="file:///etc/passwd"><img alt="Cat" src="cat.png"></a>').trim()
    ).toBe('![Cat](cat.png)');
  });

  it('shows a noscript fallback and the words in a drawing', () => {
    expect(rewriteSimpleHtml('<noscript>Need script</noscript>')).toBe('Need script');
    expect(
      rewriteSimpleHtml('<svg><title>Chart</title><path d="M0 0"/><text>Label</text></svg>').trim()
    ).toBe('Chart Label');
    expect(rewriteSimpleHtml('<template><p>Hidden</p></template>Shown')).toBe('Shown');
    expect(rewriteSimpleHtml('<script>alert(1)</script>Hello')).toBe('Hello');
    expect(rewriteSimpleHtml('<style>body{color:red}</style>Hello')).toBe('Hello');
  });

  it('shows presentational HTML and an HTML code sample', () => {
    expect(rewriteSimpleHtml('<font color="red">Hello</font>')).toBe('Hello');
    expect(rewriteSimpleHtml('<big>Hello</big>')).toBe('Hello');
    expect(rewriteSimpleHtml('Type <tt>ls</tt> now')).toBe('Type `ls` now');
    expect(rewriteSimpleHtml('<acronym title="Hypertext">HTML</acronym>')).toBe('HTML (Hypertext)');
    expect(rewriteSimpleHtml('<marquee>News</marquee>')).toBe('News');
    expect(rewriteSimpleHtml('<nobr>keep together</nobr>')).toBe('keep together');
    expect(
      rewriteSimpleHtml(
        '<dl><dt>Term <em>x</em></dt><dd>See <strong>this</strong></dd></dl>'
      ).trim()
    ).toBe('Term *x*\n\nSee **this**');
    expect(rewriteSimpleHtml('<blockquote><p>One</p><p>Two</p></blockquote>').trim()).toBe(
      '> One\n>\n> Two'
    );
    expect(
      rewriteSimpleHtml('<pre><code class="language-ts">const x = 1</code></pre>').trim()
    ).toBe('```ts\nconst x = 1\n```');
    expect(rewriteSimpleHtml('<pre>plain</pre>').trim()).toBe('```\nplain\n```');
  });

  it('shows the text inside an HTML grouping', () => {
    expect(rewriteSimpleHtml('<fieldset><legend>Name</legend>Ada</fieldset>').trim()).toBe(
      '**Name**\n\nAda'
    );
    expect(rewriteSimpleHtml('<address>Ada Lovelace<br>London</address>').trim()).toBe(
      'Ada Lovelace<br>London'
    );
    expect(rewriteSimpleHtml('<menu><li>Cut</li><li>Copy</li></menu>').trim()).toBe(
      '- Cut\n- Copy'
    );
    expect(rewriteSimpleHtml('<menu>Cut</menu>').trim()).toBe('Cut');
    expect(rewriteSimpleHtml('Hello <bdo dir="rtl">Ada</bdo> there')).toBe('Hello Ada there');
    expect(rewriteSimpleHtml('<data value="42">forty-two</data>')).toBe('forty-two (42)');
    expect(rewriteSimpleHtml('<center>Hello</center>').trim()).toBe('Hello');
    expect(rewriteSimpleHtml('<dialog open><p>Saved</p></dialog>').trim()).toBe('Saved');
    expect(rewriteSimpleHtml('<video src="clip.mp4">Watch the clip</video>').trim()).toBe(
      'Watch the clip'
    );
    expect(rewriteSimpleHtml('<audio src="song.mp3">Hear the song</audio>').trim()).toBe(
      'Hear the song'
    );
    expect(rewriteSimpleHtml('<video src="file:///tmp/clip.mp4"></video>').trim()).toBe('');
    expect(
      rewriteSimpleHtml('<video><source src="https://example.com/a.mp4"></video>').trim()
    ).toBe('https://example.com/a.mp4');
    expect(
      rewriteSimpleHtml(
        '<video><source src="file:///tmp/a.mp4"><source src="https://example.com/a.mp4"></video>'
      ).trim()
    ).toBe('https://example.com/a.mp4');
    expect(rewriteSimpleHtml('<video><source src="file:///tmp/a.mp4"></video>').trim()).toBe('');
    expect(rewriteSimpleHtml('Hello <bdi>Ada</bdi> there')).toBe('Hello Ada there');
    expect(rewriteSimpleHtml('Name: <slot>Fallback</slot>')).toBe('Name: Fallback');
    expect(
      rewriteSimpleHtml(
        '<picture><source srcset="a.webp"><img alt="Cat" src="cat.png"></picture>'
      ).trim()
    ).toBe('![Cat](cat.png)');
    expect(
      rewriteSimpleHtml('<picture><source srcset="https://example.com/a.webp"></picture>').trim()
    ).toBe('![](https://example.com/a.webp)');
    expect(
      rewriteSimpleHtml(
        '<picture><source srcset="file:///tmp/a.webp 1x, https://example.com/a.webp 2x"><img alt="Cat" src="file:///tmp/a.png"></picture>'
      ).trim()
    ).toBe('![Cat](https://example.com/a.webp)');
    expect(
      rewriteSimpleHtml('<picture><source srcset="file:///tmp/a.webp"></picture>').trim()
    ).toBe('');
    expect(
      rewriteSimpleHtml(
        '<map name="m"><area alt="Top" href="https://example.com/top"></map>'
      ).trim()
    ).toBe('[Top](https://example.com/top)');
    expect(rewriteSimpleHtml('<area alt="Secret" href="javascript:alert(1)">')).toBe('Secret');
    expect(
      rewriteSimpleHtml(
        '<input value="Red"><datalist><option>Red</option><option>Blue</option></datalist>'
      )
    ).toBe('Red');
    expect(
      rewriteSimpleHtml('<details><summary>More <b>info</b></summary>\nHidden\n</details>').trim()
    ).toBe('More **info**\n\nHidden');
  });

  it('shows text typed into a form control', () => {
    expect(rewriteSimpleHtml('Name <input type="text" value="Ada">')).toBe('Name Ada');
    expect(rewriteSimpleHtml('<textarea>Hello</textarea>').trim()).toBe('Hello');
    expect(rewriteSimpleHtml('<textarea placeholder="Notes"></textarea>').trim()).toBe('Notes');
    expect(
      rewriteSimpleHtml(
        '<select><optgroup label="Warm"><option>Red</option></optgroup></select>'
      ).trim()
    ).toBe('Warm, Red');
    expect(
      rewriteSimpleHtml(
        '<select><option>Red</option><option selected>Blue</option></select>'
      ).trim()
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
    expect(rewriteSimpleHtml('<ol type="i" start="4"><li>Four</li></ol>').trim()).toBe(
      '- iv. Four'
    );
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

  it('keeps each item of a list inside a table cell', () => {
    const html = '<table><tr><td><ul><li>One</li><li>Two</li></ul></td><td>B</td></tr></table>';
    expect(rewriteSimpleHtml(html).trim()).toBe('| - One<br>- Two | B |\n| --- | --- |');
    const paragraphs = '<table><tr><td><p>Hello</p><p>World</p></td></tr></table>';
    expect(rewriteSimpleHtml(paragraphs).trim()).toBe('| Hello<br>World |\n| --- |');
  });

  it('keeps the words of a table nested in a cell', () => {
    const html =
      '<table><tr><td>Out<table><tr><td>In</td></tr></table></td><td>Side</td></tr></table>';
    expect(rewriteSimpleHtml(html).trim()).toBe('| Out<br>In | Side |\n| --- | --- |');
    const piped = '<table><tr><td><table><tr><td>A | B</td></tr></table></td></tr></table>';
    expect(rewriteSimpleHtml(piped).trim()).toBe('| A \\| B |\n| --- |');
  });

  it('keeps a cell beside a cell that spans rows', () => {
    const rowspan =
      '<table><tr><td rowspan="2">Tall</td><td>A</td></tr><tr><td>B</td></tr></table>';
    expect(rewriteSimpleHtml(rowspan).trim()).toBe('| Tall | A |\n| --- | --- |\n|  | B |');
    const colspan =
      '<table><tr><th colspan="2">Wide</th></tr><tr><td>A</td><td>B</td></tr></table>';
    expect(rewriteSimpleHtml(colspan).trim()).toBe('| Wide |  |\n| --- | --- |\n| A | B |');
  });

  it('shows the words of older HTML and a video poster', () => {
    expect(rewriteSimpleHtml('<blink>Look here</blink>')).toBe('Look here');
    expect(rewriteSimpleHtml('<noframes>Read the frames</noframes>').trim()).toBe(
      'Read the frames'
    );
    expect(rewriteSimpleHtml('A<spacer>B</spacer>C')).toBe('ABC');
    expect(rewriteSimpleHtml('<xmp>a < b</xmp>').trim()).toBe('```\na < b\n```');
    expect(rewriteSimpleHtml('<listing>a < b</listing>').trim()).toBe('```\na < b\n```');
    expect(
      rewriteSimpleHtml(
        prepareMarkdownSource('<listing>a < b</listing>', { preserveHtml: true })
      ).trim()
    ).toBe('```\na < b\n```');
    expect(rewriteSimpleHtml('<plaintext>a < b')).toBe('a < b');
    expect(
      rewriteSimpleHtml(
        '<menu><menuitem>Cut</menuitem><menuitem label="Copy"></menuitem></menu>'
      ).trim()
    ).toBe('- Cut\n- Copy');
    expect(rewriteSimpleHtml('<applet alt="Run the applet"></applet>')).toBe('Run the applet');
    expect(rewriteSimpleHtml('<isindex prompt="Search the notes">')).toBe('Search the notes');
    expect(rewriteSimpleHtml('<bgsound src="file:///tmp/a.mp3">')).toBe('');
    expect(rewriteSimpleHtml('<param name="autoplay" value="true">The report')).toBe('The report');
    expect(rewriteSimpleHtml('<video poster="https://example.com/a.png"></video>').trim()).toBe(
      '![](https://example.com/a.png)'
    );
    expect(rewriteSimpleHtml('<video poster="/etc/passwd.png"></video>').trim()).toBe('');
    expect(
      rewriteSimpleHtml('<svg><metadata>secret meta</metadata><text>Box</text></svg>').trim()
    ).toBe('Box');
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
