/**
 * HTML to MDX converter tests.
 * Tests conversion of various HTML patterns to MDX.
 */

import { describe, it, expect } from 'vitest';
import { convertHtmlToMdx } from './html-to-mdx-converter';

describe('html-to-mdx-converter', () => {
  it('should return empty string for empty input', async () => {
    const result = await convertHtmlToMdx('');
    expect(result).toBe('');
  });

  it('should return empty string for whitespace input', async () => {
    const result = await convertHtmlToMdx('   ');
    expect(result).toBe('');
  });

  it('should convert headings', async () => {
    const html = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
    const result = await convertHtmlToMdx(html);
    expect(result).toContain('# Title');
    expect(result).toContain('## Subtitle');
    expect(result).toContain('### Section');
  });

  it('should convert paragraphs', async () => {
    const html = '<p>Hello world</p><p>Another paragraph</p>';
    const result = await convertHtmlToMdx(html);
    expect(result).toContain('Hello world');
    expect(result).toContain('Another paragraph');
  });

  it('should convert bold and italic', async () => {
    const html = '<p><strong>bold</strong> and <em>italic</em></p>';
    const result = await convertHtmlToMdx(html);
    expect(result).toContain('**bold**');
    // remark-stringify uses * for emphasis by default
    expect(result).toMatch(/[_*]italic[_*]/);
  });

  it('should convert links', async () => {
    const html = '<a href="https://example.com">Example</a>';
    const result = await convertHtmlToMdx(html);
    expect(result).toContain('[Example](https://example.com)');
  });

  it('should convert unordered lists', async () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = await convertHtmlToMdx(html);
    // remark-stringify uses * for bullet by default
    expect(result).toMatch(/[*-] Item 1/);
    expect(result).toMatch(/[*-] Item 2/);
  });

  it('should convert ordered lists', async () => {
    const html = '<ol><li>First</li><li>Second</li></ol>';
    const result = await convertHtmlToMdx(html);
    expect(result).toContain('1.');
    expect(result).toContain('First');
  });

  it('should convert code blocks', async () => {
    const html = '<pre><code>const x = 1;</code></pre>';
    const result = await convertHtmlToMdx(html);
    expect(result).toContain('const x = 1;');
  });

  it('should convert inline code', async () => {
    const html = '<p>Use <code>npm install</code> to install</p>';
    const result = await convertHtmlToMdx(html);
    expect(result).toContain('`npm install`');
  });

  it('should convert blockquotes', async () => {
    const html = '<blockquote>A wise quote</blockquote>';
    const result = await convertHtmlToMdx(html);
    expect(result).toContain('> A wise quote');
  });

  it('should convert images', async () => {
    const html = '<img src="photo.jpg" alt="A photo" />';
    const result = await convertHtmlToMdx(html);
    expect(result).toContain('![A photo](photo.jpg)');
  });

  it('should convert tables', async () => {
    const html = `
      <table>
        <thead><tr><th>Name</th><th>Value</th></tr></thead>
        <tbody><tr><td>A</td><td>1</td></tr></tbody>
      </table>
    `;
    const result = await convertHtmlToMdx(html);
    expect(result).toContain('Name');
    expect(result).toContain('Value');
    expect(result).toContain('|');
  });

  it('should convert horizontal rules', async () => {
    const html = '<hr />';
    const result = await convertHtmlToMdx(html);
    // remark-stringify uses *** for thematic breaks by default
    expect(result).toMatch(/[*-]{3}/);
  });

  it('keeps a formula, a drawing, a caption, and a picture', async () => {
    const formula = await convertHtmlToMdx('<math><mi>x</mi><mo>+</mo><mn>2</mn></math>');
    expect(formula).toContain('x');
    expect(formula).toContain('2');
    const drawing = await convertHtmlToMdx('<svg><text>Box</text></svg>');
    expect(drawing).toContain('Box');
    const caption = await convertHtmlToMdx(
      '<table><caption>Prices</caption><tr><td>Tea</td></tr></table>'
    );
    expect(caption).toContain('Prices');
    expect(caption).toContain('Tea');
    const picture = await convertHtmlToMdx(
      '<picture><source srcset="https://example.com/a.webp"></picture>'
    );
    expect(picture).toContain('https://example.com/a.webp');
    const sample = await convertHtmlToMdx('<pre>a < b</pre>');
    expect(sample).toContain('a < b');
    expect(sample).not.toContain('&lt;');
  });

  it('should handle complex nested HTML', async () => {
    const html = `
      <div>
        <h1>Document</h1>
        <p>A paragraph with <strong>bold</strong> text.</p>
        <ul>
          <li>Item with <a href="/link">a link</a></li>
        </ul>
      </div>
    `;
    const result = await convertHtmlToMdx(html);
    expect(result).toContain('# Document');
    expect(result).toContain('**bold**');
    expect(result).toContain('[a link](/link)');
    // Verify list item is present (bullet character may vary)
    expect(result).toContain('a link');
  });
});
