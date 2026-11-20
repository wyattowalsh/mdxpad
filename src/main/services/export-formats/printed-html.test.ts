import { describe, expect, it } from 'vitest';

import { markdownToPdfHtml } from './pdf-exporter';

describe('printed html', () => {
  it('shows words a canvas, a dialog, and a disclosure would hide', () => {
    expect(markdownToPdfHtml('<canvas>Chart of sales</canvas>\n')).toBe('<p>Chart of sales</p>');
    expect(markdownToPdfHtml('<canvas aria-label="Sketchname"></canvas>\n')).toContain(
      'Sketchname'
    );
    expect(markdownToPdfHtml('<strong></strong>\n')).not.toContain('<hr');
    expect(markdownToPdfHtml('<b></b>\n')).not.toContain('<hr');
    expect(markdownToPdfHtml('<strong>*</strong>\n')).toBe('<p>*</p>');
    expect(
      markdownToPdfHtml('<picture><source srcset="https://example.com/a.png"></picture>\n')
    ).toContain('<img src="https://example.com/a.png"');
    expect(
      markdownToPdfHtml('<picture><source srcset="file:///tmp/a.png"></picture>\n')
    ).not.toContain('file:');
    expect(markdownToPdfHtml('<dialog><p>Saved</p></dialog>\n')).toContain('<p>Saved</p>');
    expect(markdownToPdfHtml('<dialog><p>Saved</p></dialog>\n')).not.toContain('<dialog');
    const details = markdownToPdfHtml(
      '<details><summary>More</summary>\nHidden note\n</details>\n'
    );
    expect(details).toContain('<details open>');
    expect(details).toContain('Hidden note');
  });

  it('shows a suggestion, a button name, a caption, and a formula source', () => {
    expect(
      markdownToPdfHtml('<datalist><option label="Shown">Hidden</option></datalist>\n')
    ).toContain('Shown');
    expect(
      markdownToPdfHtml('<datalist><option label="Shown">Hidden</option></datalist>\n')
    ).not.toContain('Hidden');
    expect(markdownToPdfHtml('<button aria-label="Save the file"></button>\n')).toContain(
      'Save the file'
    );
    const video = markdownToPdfHtml('<video src="clip.mp4">Watch the clip</video>\n');
    expect(video).toContain('<video src="clip.mp4">');
    expect(video).toContain('</video>Watch the clip');
    const caption = markdownToPdfHtml(
      '<video src="clip.mp4"><track label="English captions"></video>\n'
    );
    expect(caption).toContain('English captions');
    const lyrics = markdownToPdfHtml(
      '<audio src="song.mp3"><track label="Lyrics"></track></audio>\n'
    );
    expect(lyrics).toContain('Lyrics');
    expect(lyrics).not.toContain('</track>');
    expect(
      markdownToPdfHtml('<math><semantics><annotation>x^2 + 1</annotation></semantics></math>\n')
    ).toContain('x^2 + 1');
    expect(markdownToPdfHtml('<math><mglyph alt="plus"></mglyph></math>\n')).toContain('plus');
    const shown = markdownToPdfHtml(
      '<math><semantics><mi>x</mi><annotation>secret</annotation></semantics></math>\n'
    );
    expect(shown).toContain('<mi>x</mi>');
    expect(shown).not.toContain('</math>secret');
  });

  it('shows a popover and the words of a noscript block', () => {
    expect(markdownToPdfHtml('<div popover>Popover words</div>\n')).toBe(
      '<div>Popover words</div>'
    );
    expect(markdownToPdfHtml('<div popover="auto">More words</div>\n')).not.toContain('popover');
    expect(markdownToPdfHtml('<noscript>Need script</noscript>\n')).toBe('<p>Need script</p>');
    expect(markdownToPdfHtml('<noscript><p>Enable the page</p></noscript>\n')).toContain(
      'Enable the page'
    );
    expect(markdownToPdfHtml('<noscript><p>Enable the page</p></noscript>\n')).not.toContain(
      '<noscript'
    );
    expect(markdownToPdfHtml('<p hidden>Hidden words</p>\n')).toContain('hidden');
    expect(markdownToPdfHtml('<table><tr><th abbr="Quantity">Qty</th></tr></table>\n')).toContain(
      'Qty (Quantity)'
    );
    expect(
      markdownToPdfHtml('<select><option>Red</option><option>Blue</option></select>\n')
    ).toContain('Red, Blue');
    expect(
      markdownToPdfHtml('<select aria-label="Colorname"><option>Red</option></select>\n')
    ).toContain('Colorname: Red');
    expect(markdownToPdfHtml('<time datetime="2020-01-01"></time>\n')).toContain('(2020-01-01)');
    expect(markdownToPdfHtml('<abbr title="Hypertext Markup"></abbr>\n')).toContain(
      '(Hypertext Markup)'
    );
    expect(markdownToPdfHtml('<data value="forty-two"></data>\n')).toContain('forty-two');
    expect(markdownToPdfHtml('<time datetime="2020-01-01">then</time>\n')).toContain('then');
    expect(markdownToPdfHtml('<meter value="4" max="10"></meter>\n')).toContain('4');
    expect(markdownToPdfHtml('<progress value="3" max="10"></progress>\n')).toContain('3/10');
    expect(markdownToPdfHtml('<meter value="4" max="10">half</meter>\n')).toContain('half');
    expect(markdownToPdfHtml('<meter value="4" max="10" title="Halfway"></meter>\n')).toContain(
      '4 (Halfway)'
    );
    expect(
      markdownToPdfHtml('<progress value="3" max="10" title="Loading"></progress>\n')
    ).toContain('3/10 (Loading)');
    expect(markdownToPdfHtml('<input type="file" aria-label="Upload the paper">\n')).toContain(
      'Upload the paper'
    );
    expect(
      markdownToPdfHtml('<input type="color" value="#112233" aria-label="Colorpick">\n')
    ).toContain('#112233 (Colorpick)');
    expect(markdownToPdfHtml('<input type="checkbox" aria-label="Agreed" checked>\n')).toContain(
      'Agreed'
    );
    expect(
      markdownToPdfHtml('<input type="checkbox" aria-label="Agreed" checked> Agreed\n')
    ).not.toContain('Agreed Agreed');
    expect(markdownToPdfHtml('<input type="radio" value="Morning" />\n')).toContain('Morning');
    expect(markdownToPdfHtml('<input type="radio" value="file:///etc/passwd" />\n')).toBe(
      '<p><input type="radio" value="file:///etc/passwd" /></p>'
    );
    expect(markdownToPdfHtml('- [x] done\n')).toContain(
      '<input type="checkbox" disabled checked />'
    );
  });

  it('shows a table summary and an image description', () => {
    const table = markdownToPdfHtml(
      '<table summary="Sales table"><tr><td>Cellword</td></tr></table>\n'
    );
    expect(table.replace(/<[^>]+>/g, '')).toContain('Sales table');
    expect(table).toContain('Cellword');
    const image = markdownToPdfHtml(
      '<img src="https://example.com/a.png" alt="Altice" longdesc="A long description of ice">\n'
    );
    expect(image.replace(/<[^>]+>/g, '')).toContain('A long description of ice');
    expect(image).not.toContain('file:');
  });

  it('shows a result name and a deletion date', () => {
    expect(
      markdownToPdfHtml('<output aria-label="Runningtotal">Fortytwo</output>\n').replace(
        /<[^>]+>/g,
        ''
      )
    ).toContain('Fortytwo (Runningtotal)');
    expect(
      markdownToPdfHtml('<del datetime="2020-01-02">Removedwords</del>\n').replace(/<[^>]+>/g, '')
    ).toContain('Removedwords (2020-01-02)');
    const dated = markdownToPdfHtml('<del datetime="2020-01-02"></del>\n');
    expect(dated).toContain('2020-01-02');
    expect(dated).not.toContain('<pre>');
    expect(markdownToPdfHtml('<s></s>\n')).not.toContain('<pre>');
    const blocked = markdownToPdfHtml('<ins cite="file:///etc/passwd">Addedwords</ins>\n');
    expect(blocked).toContain('Addedwords');
    expect(blocked).not.toContain('file:');
  });

  it('shows an image description', () => {
    expect(
      markdownToPdfHtml('<img src="https://example.com/a.png" alt="Altice">\n').replace(
        /<[^>]+>/g,
        ''
      )
    ).toContain('Altice');
  });

  it('shows a typed value', () => {
    expect(
      markdownToPdfHtml('Name <input type="text" value="Ada">\n').replace(/<[^>]+>/g, '')
    ).toContain('Ada');
    expect(
      markdownToPdfHtml('<label>Citylabel<input value="Boston"></label>\n').replace(/<[^>]+>/g, '')
    ).toContain('Boston');
    expect(
      markdownToPdfHtml('<input type="text" value="Ada" aria-label="Givenname">\n').replace(
        /<[^>]+>/g,
        ''
      )
    ).toContain('Ada (Givenname)');
  });

  it('shows a masked value, a placeholder, and an expansion', () => {
    expect(markdownToPdfHtml('<input type="password" value="Secretword">\n')).toContain(
      'Secretword'
    );
    expect(markdownToPdfHtml('<input type="search" value="Icequery">\n')).toContain('Icequery');
    expect(markdownToPdfHtml('<textarea placeholder="Notewords"></textarea>\n')).toContain(
      'Notewords'
    );
    expect(markdownToPdfHtml('<abbr title="Worldhealth">WHO</abbr>\n')).toContain(
      'WHO (Worldhealth)'
    );
    expect(
      markdownToPdfHtml('<area alt="Northregion" href="https://example.com" />\n').replace(
        /<[^>]+>/g,
        ''
      )
    ).toContain('Northregion');
    expect(
      markdownToPdfHtml('<option label="Visibleopt">Inneropt</option>\n').replace(/<[^>]+>/g, '')
    ).toContain('Visibleopt');
    const blocked = markdownToPdfHtml('<area alt="Secret" href="file:///etc/passwd">\n');
    expect(blocked).toContain('Secret');
    expect(blocked).not.toContain('file:');
    expect(markdownToPdfHtml('<summary title="Therest">Moreword</summary>\n')).toContain(
      'Moreword (Therest)'
    );
    expect(
      markdownToPdfHtml('<input type="submit" value="Sendform" aria-label="Sendlabel">\n')
    ).toContain('Sendform (Sendlabel)');
    expect(
      markdownToPdfHtml(
        '<video src="https://example.com/a.mp4" title="Lecturetitle">Watchice</video>\n'
      )
    ).toContain('Watchice (Lecturetitle)');
  });

  it('shows a date, a time, a week, and a month', () => {
    expect(
      markdownToPdfHtml('<input type="date" value="2020-01-02" aria-label="Birthdate">\n')
    ).toContain('2020-01-02 (Birthdate)');
    expect(markdownToPdfHtml('<input type="time" value="09:30">\n')).toContain('09:30');
    expect(
      markdownToPdfHtml('<input type="week" value="2020-W01" aria-label="Weekone">\n')
    ).toContain('2020-W01 (Weekone)');
    expect(markdownToPdfHtml('<input type="month" value="2020-01">\n')).toContain('2020-01');
    expect(markdownToPdfHtml('<input type="datetime-local" value="2020-01-02T09:30">\n')).toContain(
      '2020-01-02T09:30'
    );
  });

  it('shows an image button, a command, a quotation source, and an applet name', () => {
    const visible = (html: string): string => html.replace(/<[^>]+>/g, '');
    expect(
      visible(markdownToPdfHtml('<input type="image" alt="Searchgo" src="go.png">\n'))
    ).toContain('Searchgo');
    expect(
      visible(
        markdownToPdfHtml('<input type="image" alt="Searchgo" title="Findnotes" src="go.png">\n')
      )
    ).toContain('Searchgo');
    expect(
      visible(
        markdownToPdfHtml('<input type="image" aria-label="Search" src="file:///tmp/go.png">\n')
      )
    ).toContain('Search');
    const menu = visible(
      markdownToPdfHtml('<menu><menuitem>Cut</menuitem><menuitem label="Copy"></menuitem></menu>\n')
    );
    expect(menu).toContain('Cut');
    expect(menu).toContain('Copy');
    const quote = visible(markdownToPdfHtml('<q cite="https://example.com/source">quoted</q>\n'));
    expect(quote).toContain('quoted');
    expect(quote).toContain('https://example.com/source');
    const blocked = markdownToPdfHtml('<q cite="file:///etc/passwd">quoted</q>\n');
    expect(visible(blocked)).toContain('quoted');
    expect(blocked).not.toContain('file:');
    expect(
      visible(
        markdownToPdfHtml(
          '<blockquote cite="https://example.com/source"><p>Quote</p></blockquote>\n'
        )
      )
    ).toContain('https://example.com/source');
    expect(
      visible(markdownToPdfHtml('<applet alt="Gameword" code="Game.class"></applet>\n'))
    ).toContain('Gameword');
    const named = visible(markdownToPdfHtml('<applet alt="Gameword">Innergame</applet>\n'));
    expect(named).toContain('Innergame');
    expect(named).not.toContain('Gameword');
    expect(
      visible(
        markdownToPdfHtml(
          '<applet alt="Gameword" code="Game.class"><param name="a" value="b"></applet>\n'
        )
      )
    ).toContain('Gameword');
  });

  it('leaves a formula inside a code sample alone', () => {
    const code = markdownToPdfHtml('```\n<canvas>Chart of sales</canvas>\n```\n');
    expect(code).toContain('&lt;canvas&gt;Chart of sales&lt;/canvas&gt;');
    expect(code).not.toContain('<p>Chart of sales</p>');
  });
});
