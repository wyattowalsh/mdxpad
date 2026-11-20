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

  it('leaves a formula inside a code sample alone', () => {
    const code = markdownToPdfHtml('```\n<canvas>Chart of sales</canvas>\n```\n');
    expect(code).toContain('&lt;canvas&gt;Chart of sales&lt;/canvas&gt;');
    expect(code).not.toContain('<p>Chart of sales</p>');
  });
});
