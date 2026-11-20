import { describe, expect, it } from 'vitest';

import { markdownToPdfHtml } from './pdf-exporter';

describe('printed html', () => {
  it('shows words a canvas, a dialog, and a disclosure would hide', () => {
    expect(markdownToPdfHtml('<canvas>Chart of sales</canvas>\n')).toBe('<p>Chart of sales</p>');
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
    expect(markdownToPdfHtml('<time datetime="2020-01-01"></time>\n')).toContain('(2020-01-01)');
    expect(markdownToPdfHtml('<abbr title="Hypertext Markup"></abbr>\n')).toContain(
      '(Hypertext Markup)'
    );
    expect(markdownToPdfHtml('<data value="forty-two"></data>\n')).toContain('forty-two');
    expect(markdownToPdfHtml('<time datetime="2020-01-01">then</time>\n')).toContain('then');
    expect(markdownToPdfHtml('<meter value="4" max="10"></meter>\n')).toContain('4');
    expect(markdownToPdfHtml('<progress value="3" max="10"></progress>\n')).toContain('3/10');
    expect(markdownToPdfHtml('<meter value="4" max="10">half</meter>\n')).toContain('half');
    expect(markdownToPdfHtml('<input type="file" aria-label="Upload the paper">\n')).toContain(
      'Upload the paper'
    );
    expect(markdownToPdfHtml('<input type="radio" value="Morning" />\n')).toContain('Morning');
    expect(markdownToPdfHtml('<input type="radio" value="file:///etc/passwd" />\n')).toBe(
      '<p><input type="radio" value="file:///etc/passwd" /></p>'
    );
    expect(markdownToPdfHtml('- [x] done\n')).toContain(
      '<input type="checkbox" disabled checked />'
    );
  });

  it('leaves a formula inside a code sample alone', () => {
    const code = markdownToPdfHtml('```\n<canvas>Chart of sales</canvas>\n```\n');
    expect(code).toContain('&lt;canvas&gt;Chart of sales&lt;/canvas&gt;');
    expect(code).not.toContain('<p>Chart of sales</p>');
  });
});
