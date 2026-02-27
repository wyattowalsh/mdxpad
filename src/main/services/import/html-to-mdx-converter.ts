/**
 * HTML to MDX converter.
 * Parses HTML and converts it to MDX/Markdown using rehype and remark.
 *
 * @module html-to-mdx-converter
 */

import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';

/**
 * Convert HTML string to MDX/Markdown.
 * Uses rehype-parse -> rehype-remark -> remark-gfm -> remark-stringify pipeline.
 */
export async function convertHtmlToMdx(html: string): Promise<string> {
  if (!html.trim()) {
    return '';
  }

  const processor = unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeRemark)
    .use(remarkGfm)
    .use(remarkStringify);

  const result = await processor.process(html);
  return String(result).trim();
}
