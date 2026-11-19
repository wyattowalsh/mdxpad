import { sanitizeExportedHtml } from './markdown-export-address';

export interface HtmlBlock {
  readonly html: string;
  readonly nextIndex: number;
}

const RAW_TAG = /^ {0,3}<(script|pre|style|textarea)(?=[\s/>]|$)/i;
const BLOCK_START = /^ {0,3}<\/?([A-Za-z][A-Za-z0-9-]*)(?=[\s/>]|$)/;

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'base',
  'basefont',
  'blockquote',
  'body',
  'caption',
  'center',
  'col',
  'colgroup',
  'dd',
  'details',
  'dialog',
  'dir',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'frame',
  'frameset',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hr',
  'html',
  'iframe',
  'legend',
  'li',
  'link',
  'main',
  'menu',
  'menuitem',
  'nav',
  'noframes',
  'ol',
  'optgroup',
  'option',
  'p',
  'param',
  'search',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'title',
  'tr',
  'track',
  'ul',
]);

function readThrough(lines: readonly string[], index: number, end: RegExp): HtmlBlock {
  const collected = [lines[index] ?? ''];
  if (end.test(collected[0] ?? '')) {
    return { html: collected[0] ?? '', nextIndex: index };
  }
  let cursor = index + 1;
  while (cursor < lines.length && !end.test(lines[cursor] ?? '')) {
    collected.push(lines[cursor] ?? '');
    cursor += 1;
  }
  if (cursor < lines.length) {
    collected.push(lines[cursor] ?? '');
    return { html: collected.join('\n'), nextIndex: cursor };
  }
  return { html: collected.join('\n'), nextIndex: Math.max(index, lines.length - 1) };
}

function readUntilBlank(lines: readonly string[], index: number): HtmlBlock {
  const collected = [lines[index] ?? ''];
  let cursor = index;
  while (cursor + 1 < lines.length && (lines[cursor + 1] ?? '').trim().length > 0) {
    cursor += 1;
    collected.push(lines[cursor] ?? '');
  }
  return { html: collected.join('\n'), nextIndex: cursor };
}

/** Read a CommonMark HTML block. An autolink or ordinary text returns null. */
export function readHtmlBlock(lines: readonly string[], index: number): HtmlBlock | null {
  const line = lines[index] ?? '';
  const raw = RAW_TAG.exec(line);
  if (raw?.[1]) {
    return readThrough(lines, index, new RegExp(`</${raw[1]}>`, 'i'));
  }
  const block = BLOCK_START.exec(line);
  const name = block?.[1]?.toLowerCase() ?? '';
  if (!BLOCK_TAGS.has(name)) {
    return null;
  }
  return readUntilBlank(lines, index);
}

/** Sanitize HTML blocks and leave the surrounding Markdown in place. */
export function sanitizeMarkdownHtmlBlocks(content: string): string {
  const lines = content.split('\n');
  const out: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const block = readHtmlBlock(lines, index);
    if (!block) {
      out.push(lines[index] ?? '');
      continue;
    }
    const sanitized = sanitizeExportedHtml(block.html);
    if (sanitized.length > 0) {
      out.push(sanitized);
    }
    index = block.nextIndex;
  }
  return out.join('\n');
}
