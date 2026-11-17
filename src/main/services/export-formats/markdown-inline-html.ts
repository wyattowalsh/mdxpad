import katex from 'katex';

import { expandAutolinkText, protectAutolinks } from './markdown-autolink';
import { protectEscapes, restoreEscapes } from './markdown-escape';
import { linkDestination } from './markdown-link';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function isCurrencySpan(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (/\d/.test(trimmed) && /^[\d\s.,:;]+$/.test(trimmed)) {
    return true;
  }
  return /\s/.test(value) && /[A-Za-z]{2,}/.test(trimmed) && !/[\\^_{}=+*/<>]/.test(value);
}

function takeMath(raw: string, start: number, delimiter: '$' | '$$'): number {
  const end = raw.indexOf(delimiter, start + delimiter.length);
  if (end === -1) {
    return -1;
  }
  const interior = raw.slice(start + delimiter.length, end);
  if (interior.length === 0 || isCurrencySpan(interior)) {
    return -1;
  }
  return end + delimiter.length;
}

function renderKatex(interior: string, display: boolean): string {
  try {
    return katex.renderToString(interior, {
      throwOnError: false,
      displayMode: display,
      output: 'mathml',
    });
  } catch {
    const source = display ? `$$${interior}$$` : `$${interior}$`;
    return escapeHtml(source);
  }
}

const HTML_MARK = '\uE012';

function inlineTagEnd(value: string, index: number): number {
  const open = /^<\/?[A-Za-z][A-Za-z0-9-]*/.exec(value.slice(index));
  if (!open) {
    return -1;
  }
  const after = value[index + open[0].length] ?? '';
  if (after !== '>' && after !== '/' && !/\s/.test(after)) {
    return -1;
  }
  let quote: '"' | "'" | null = null;
  for (let cursor = index + open[0].length; cursor < value.length; cursor += 1) {
    const char = value[cursor];
    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') {
      return cursor + 1;
    }
    if (char === '<') {
      return -1;
    }
  }
  return -1;
}

function inlineHtmlEnd(value: string, index: number): number {
  if (value.startsWith('<!--', index)) {
    const end = value.indexOf('-->', index + 4);
    return end === -1 ? -1 : end + 3;
  }
  if (value.startsWith('<?', index)) {
    const end = value.indexOf('?>', index + 2);
    return end === -1 ? -1 : end + 2;
  }
  if (value.startsWith('<![CDATA[', index)) {
    const end = value.indexOf(']]>', index + 9);
    return end === -1 ? -1 : end + 3;
  }
  if (/^<![A-Za-z]/.test(value.slice(index))) {
    const end = value.indexOf('>', index + 2);
    return end === -1 ? -1 : end + 1;
  }
  return inlineTagEnd(value, index);
}

function protectInlineHtml(raw: string): { text: string; tags: string[] } {
  const tags: string[] = [];
  let text = '';
  let index = 0;
  let inCode = false;
  while (index < raw.length) {
    const char = raw[index] ?? '';
    if (char === '`') {
      inCode = !inCode;
      text += char;
      index += 1;
      continue;
    }
    const end = !inCode && char === '<' ? inlineHtmlEnd(raw, index) : -1;
    if (end !== -1) {
      tags.push(raw.slice(index, end));
      text += `${HTML_MARK}${tags.length - 1}${HTML_MARK}`;
      index = end;
      continue;
    }
    text += char;
    index += 1;
  }
  return { text, tags };
}

function restoreInlineHtml(html: string, tags: readonly string[]): string {
  return html.replace(
    new RegExp(`${HTML_MARK}(\\d+)${HTML_MARK}`, 'g'),
    (_match, index: string) => tags[Number(index)] ?? ''
  );
}

function restoreAutolinks(
  html: string,
  links: ReturnType<typeof protectAutolinks>['links']
): string {
  return expandAutolinkText(html, links)
    .map((part) =>
      part.href ? `<a href="${escapeHtml(part.href)}">${escapeHtml(part.text)}</a>` : part.text
    )
    .join('');
}

/** Escape text, then apply emphasis, code, and links. Underscores inside words stay plain. */
function renderText(value: string): string {
  const escaped = protectEscapes(value);
  const protectedLinks = protectAutolinks(escaped.text);
  const protectedHtml = protectInlineHtml(protectedLinks.text);
  return restoreInlineHtml(
    restoreEscapes(
      restoreAutolinks(
        escapeHtml(protectedHtml.text)
          .replace(/`([^`]+)`/g, '<code>$1</code>')
          .replace(/~~(.+?)~~/g, '<del>$1</del>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/(?<![\w])__(.+?)__(?![\w])/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/(?<![\w])_(.+?)_(?![\w])/g, '<em>$1</em>')
          .replace(
            /!\[([^\]]*)\]\(((?:[^()]|\([^()]*\))+)\)/g,
            (_match, alt: string, src: string) =>
              `<img src="${linkDestination(src)}" alt="${alt}" />`
          )
          .replace(
            /\[([^\]]+)\]\(((?:[^()]|\([^()]*\))+)\)/g,
            (_match, text: string, href: string) => {
              return `<a href="${linkDestination(href)}">${text}</a>`;
            }
          ),
        protectedLinks.links
      ),
      escaped.chars,
      escapeHtml
    ),
    protectedHtml.tags
  );
}

function appendMath(
  html: string,
  raw: string,
  start: number,
  end: number,
  display: boolean
): string {
  const interior = raw.slice(start + (display ? 2 : 1), end - (display ? 2 : 1));
  return html + renderKatex(interior, display);
}

/** Escape text, then apply emphasis, code, links, and formulas. Prices stay text. */
export function renderMarkdownInline(value: string): string {
  let html = '';
  let index = 0;
  let textStart = 0;
  let inCode = false;
  while (index < value.length) {
    if (value[index] === '`') {
      inCode = !inCode;
      index += 1;
      continue;
    }
    const delimiter =
      !inCode && value.startsWith('$$', index)
        ? '$$'
        : !inCode && value[index] === '$'
          ? '$'
          : null;
    const end = delimiter === null ? -1 : takeMath(value, index, delimiter);
    if (delimiter !== null && end !== -1) {
      html += renderText(value.slice(textStart, index));
      html = appendMath(html, value, index, end, delimiter === '$$');
      index = end;
      textStart = index;
      continue;
    }
    index += 1;
  }
  return html + renderText(value.slice(textStart));
}

export function renderDisplayMathBlock(lines: readonly string[]): string {
  return renderKatex(lines.join('\n'), true);
}
