import { mapFencedProse } from '@shared/lib/markdown-math';
import { promoteInlineHtml } from '@shared/lib/inline-html';
import { readAngleTag } from '@shared/lib/markdown-tags';

import { readCodeSpan } from './markdown-escape';
import { plainFootnoteMarkers } from './markdown-footnote';
import { expandLinkReferences } from './markdown-reference';

const UNWRAP = new Set([
  'article',
  'aside',
  'div',
  'figcaption',
  'figure',
  'footer',
  'header',
  'main',
  'nav',
  'p',
  'section',
]);

interface HtmlElement {
  readonly name: string;
  readonly innerStart: number;
  readonly innerEnd: number;
  readonly end: number;
}

function simpleName(name: string): boolean {
  return (
    UNWRAP.has(name) ||
    name === 'ul' ||
    name === 'ol' ||
    name === 'li' ||
    name === 'blockquote' ||
    name === 'pre' ||
    name === 'span' ||
    /^h[1-6]$/.test(name)
  );
}

function closingTag(value: string, index: number): { name: string; end: number } | null {
  const match = /^<\/([A-Za-z][\w:-]*)\s*>/.exec(value.slice(index));
  const name = match?.[1]?.toLowerCase();
  if (!match || name === undefined) {
    return null;
  }
  return { name, end: index + match[0].length };
}

function elementBounds(value: string, name: string, openEnd: number): HtmlElement | null {
  let depth = 1;
  let cursor = openEnd;
  while (cursor < value.length) {
    if (value[cursor] !== '<') {
      cursor += 1;
      continue;
    }
    const close = closingTag(value, cursor);
    if (close) {
      if (close.name === name) {
        depth -= 1;
        if (depth === 0) {
          return { name, innerStart: openEnd, innerEnd: cursor, end: close.end };
        }
      }
      cursor = close.end;
      continue;
    }
    const open = readAngleTag(value, cursor);
    if (open && !open.closing && !open.selfClosing && open.name.toLowerCase() === name) {
      depth += 1;
    }
    const next = open && !open.closing ? open.end : cursor + 1;
    cursor = next > cursor ? next : cursor + 1;
  }
  return null;
}

function readSimpleElement(value: string, index: number): HtmlElement | null {
  const open = readAngleTag(value, index);
  if (!open || open.closing || open.fragment) {
    return null;
  }
  const name = open.name.toLowerCase();
  if (!simpleName(name)) {
    return null;
  }
  if (open.selfClosing) {
    return { name, innerStart: open.end, innerEnd: open.end, end: open.end };
  }
  return elementBounds(value, name, open.end);
}

function blockWrap(text: string): string {
  const trimmed = text.trim();
  return trimmed.length === 0 ? '' : `\n\n${trimmed}\n\n`;
}

function markerBlock(marker: string, body: string): string {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return marker.trimEnd();
  }
  const [first, ...rest] = trimmed.split('\n');
  const head = `${marker}${first ?? ''}`;
  const tail = rest.map((line) => (line.length === 0 ? '' : `  ${line}`)).join('\n');
  return tail.length > 0 ? `${head}\n${tail}` : head;
}

function listBodies(inner: string): string[] {
  const bodies: string[] = [];
  let index = 0;
  while (index < inner.length) {
    const element = inner[index] === '<' ? readSimpleElement(inner, index) : null;
    if (element?.name === 'li') {
      bodies.push(inner.slice(element.innerStart, element.innerEnd));
      index = element.end;
      continue;
    }
    index = element ? element.end : index + 1;
  }
  return bodies;
}

function renderList(inner: string, ordered: boolean): string {
  const items = listBodies(inner).map((body, index) =>
    markerBlock(ordered ? `${index + 1}. ` : '- ', convertHtml(body))
  );
  return blockWrap(items.join('\n'));
}

function renderHeading(level: number, inner: string): string {
  const text = convertHtml(inner)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/[ \t]*\n[ \t]*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return blockWrap(`${'#'.repeat(level)} ${text}`);
}

function renderQuote(inner: string): string {
  const text = convertHtml(inner).trim();
  if (text.length === 0) {
    return '';
  }
  const quoted = text
    .split('\n')
    .map((line) => (line.length === 0 ? '>' : `> ${line}`))
    .join('\n');
  return blockWrap(quoted);
}

function renderPre(inner: string): string {
  const text = inner.replace(/^\n/, '').replace(/\n$/, '');
  return `\n\n\`\`\`\n${text}\n\`\`\`\n\n`;
}

function renderElement(element: HtmlElement, value: string): string {
  const inner = value.slice(element.innerStart, element.innerEnd);
  switch (element.name) {
    case 'ul':
      return renderList(inner, false);
    case 'ol':
      return renderList(inner, true);
    case 'li':
      return blockWrap(markerBlock('- ', convertHtml(inner)));
    case 'blockquote':
      return renderQuote(inner);
    case 'pre':
      return renderPre(inner);
    case 'span':
      return convertHtml(inner);
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return renderHeading(Number(element.name.slice(1)), inner);
    default:
      return blockWrap(convertHtml(inner));
  }
}

function convertHtml(value: string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    if (value[index] === '`') {
      const code = readCodeSpan(value, index);
      if (code && code.end > index) {
        result += value.slice(index, code.end);
        index = code.end;
        continue;
      }
      result += '`';
      index += 1;
      continue;
    }
    const element = value[index] === '<' ? readSimpleElement(value, index) : null;
    if (!element) {
      result += value[index] ?? '';
      index += 1;
      continue;
    }
    result += renderElement(element, value);
    index = element.end;
  }
  return result;
}

function promoteOutsideCode(value: string): string {
  let result = '';
  let index = 0;
  while (index < value.length) {
    if (value[index] === '`') {
      const code = readCodeSpan(value, index);
      if (code && code.end > index) {
        result += value.slice(index, code.end);
        index = code.end;
        continue;
      }
      result += '`';
      index += 1;
      continue;
    }
    const nextTick = value.indexOf('`', index + 1);
    const end = nextTick === -1 ? value.length : nextTick;
    result += promoteInlineHtml(value.slice(index, end));
    index = end;
  }
  return result;
}

/** Turn simple HTML into Markdown for exporters that do not render tags. */
export function rewriteSimpleHtml(content: string): string {
  return mapFencedProse(content, (prose) =>
    promoteOutsideCode(convertHtml(prose)).replace(/\n{3,}/g, '\n\n')
  );
}

/** Markdown shared by Word and LaTeX after the common source preparation. */
export function preparedExportSource(prepared: string): string {
  return plainFootnoteMarkers(expandLinkReferences(rewriteSimpleHtml(prepared)));
}
