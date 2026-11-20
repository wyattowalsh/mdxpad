/**
 * HTML to MDX converter.
 * Turns HTML into Markdown while keeping formulas, drawings, captions, and pictures.
 *
 * @module html-to-mdx-converter
 */

import { htmlBreakPattern, rewriteSimpleHtml } from '../export-formats/markdown-simple-html';

/**
 * Convert HTML string to MDX/Markdown.
 * Uses the same HTML reading as export so words and pictures are not dropped.
 */
export function convertHtmlToMdx(html: string): Promise<string> {
  const markdown =
    html.trim().length === 0
      ? ''
      : rewriteSimpleHtml(html).replace(htmlBreakPattern(), '\\\n').trim();
  return Promise.resolve(markdown);
}
