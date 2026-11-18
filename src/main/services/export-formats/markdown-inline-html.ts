import katex from 'katex';

import { protectAutolinks, replaceAutolinks, type Autolink } from './markdown-autolink';
import { decodeHtmlEntities } from './markdown-entity';
import { renderEmphasis } from './markdown-emphasis';
import { findCodeSpan, protectEscapes, readCodeSpan, restoreEscapes } from './markdown-escape';
import { findMarkdownTarget, linkDestination, linkTitle, type MarkdownTarget } from './markdown-link';

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
  while (index < raw.length) {
    const char = raw[index] ?? '';
    if (char === '`') {
      const span = readCodeSpan(raw, index);
      text += span ? raw.slice(index, span.end) : char;
      index = span ? span.end : index + 1;
      continue;
    }
    const end = char === '<' ? inlineHtmlEnd(raw, index) : -1;
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

function autolinkHtml(link: Autolink, nested: boolean): string {
  const text = escapeHtml(link.text);
  return nested ? text : `<a href="${escapeHtml(link.href)}">${text}</a>`;
}

function restoreAutolinks(
  html: string,
  links: ReturnType<typeof protectAutolinks>['links']
): string {
  return replaceAutolinks(html, links, autolinkHtml);
}

function escapeText(value: string): string {
  return escapeHtml(decodeHtmlEntities(value));
}

function titleAttribute(raw: string): string {
  const title = linkTitle(raw);
  return title ? ` title="${escapeText(title)}"` : '';
}

function inlinePlainText(html: string): string {
  const withImages = html.replace(/<img\b([^>]*)>/g, (_tag, attrs: string) => {
    const alt = /\balt="([^"]*)"/.exec(attrs)?.[1] ?? '';
    return decodeHtmlEntities(alt);
  });
  return decodeHtmlEntities(withImages.replace(/<[^>]+>/g, ''));
}

function renderRichImage(alt: string, src: string): string {
  const path = escapeHtml(decodeHtmlEntities(linkDestination(src)));
  const text = inlinePlainText(renderRich(alt));
  return `<img src="${path}" alt="${escapeText(text)}"${titleAttribute(src)} />`;
}

function renderTarget(target: MarkdownTarget): string {
  if (target.image) {
    return renderRichImage(target.label, target.destination);
  }
  const href = escapeHtml(decodeHtmlEntities(linkDestination(target.destination)));
  return `<a href="${href}"${titleAttribute(target.destination)}>${renderRich(target.label)}</a>`;
}

function renderPlain(raw: string): string {
  let result = '';
  let cursor = 0;
  while (cursor < raw.length) {
    const target = findMarkdownTarget(raw, cursor);
    const code = findCodeSpan(raw, cursor);
    const targetAt = target?.start ?? raw.length;
    const codeAt = code?.start ?? raw.length;
    if (code && codeAt <= targetAt) {
      result += escapeText(raw.slice(cursor, code.start));
      result += `<code>${escapeHtml(code.text)}</code>`;
      cursor = code.end;
      continue;
    }
    if (target && target.start < raw.length) {
      result += escapeText(raw.slice(cursor, target.start));
      result += renderTarget(target);
      cursor = target.end;
      continue;
    }
    return result + escapeText(raw.slice(cursor));
  }
  return result;
}

function applyStrike(html: string): string {
  let result = '';
  let index = 0;
  while (index < html.length) {
    if (html.startsWith('<code', index)) {
      const end = html.indexOf('</code>', index);
      const close = end === -1 ? html.length : end + '</code>'.length;
      result += html.slice(index, close);
      index = close;
      continue;
    }
    if (html.startsWith('~~', index)) {
      const end = html.indexOf('~~', index + 2);
      if (end !== -1 && !html.slice(index + 2, end).includes('<code')) {
        result += `<del>${html.slice(index + 2, end)}</del>`;
        index = end + 2;
        continue;
      }
    }
    result += html[index] ?? '';
    index += 1;
  }
  return result;
}

function renderRich(raw: string): string {
  return applyStrike(renderEmphasis(raw, renderPlain));
}

/** Escape text, then apply emphasis, code, and links. Underscores inside words stay plain. */
function renderText(value: string): string {
  const escaped = protectEscapes(value);
  const protectedLinks = protectAutolinks(escaped.text);
  const protectedHtml = protectInlineHtml(protectedLinks.text);
  return restoreInlineHtml(
    restoreEscapes(
      restoreAutolinks(renderRich(protectedHtml.text), protectedLinks.links),
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
  while (index < value.length) {
    if (value[index] === '`') {
      const span = readCodeSpan(value, index);
      index = span ? span.end : index + 1;
      continue;
    }
    const delimiter = value.startsWith('$$', index) ? '$$' : value[index] === '$' ? '$' : null;
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
