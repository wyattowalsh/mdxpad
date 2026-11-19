import katex from 'katex';

import { normalizedHeadingFragment } from '@shared/lib/markdown-heading';
import { katexMathTex, renderableMathTex } from '@shared/lib/renderable-math';

import { mathDelimiterAt, mathSpanEnd } from './markdown-math-span';

import { protectAutolinks, replaceAutolinks, type Autolink } from './markdown-autolink';
import { decodeHtmlEntities } from './markdown-entity';
import { renderEmphasis } from './markdown-emphasis';
import { findCodeSpan, protectEscapes, readCodeSpan, restoreEscapes } from './markdown-escape';
import {
  findMarkdownTarget,
  linkDestination,
  linkTitle,
  readMarkdownTarget,
  type MarkdownTarget,
} from './markdown-link';
import {
  safeImageAddress,
  safeLinkAddress,
  sanitizeExportedTag,
  skippedDroppedElement,
  styleBlock,
} from './markdown-export-address';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderKatex(interior: string, display: boolean): string {
  try {
    return katex.renderToString(katexMathTex(renderableMathTex(interior)), {
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

function shiftHtmlMarks(text: string, offset: number): string {
  return text.replaceAll(
    new RegExp(`${HTML_MARK}(\\d+)${HTML_MARK}`, 'g'),
    (_match, slot: string) => `${HTML_MARK}${Number(slot) + offset}${HTML_MARK}`
  );
}

function protectHtmlLink(
  raw: string,
  index: number,
  tags: string[]
): { text: string; next: number } | null {
  if (raw[index] !== '[' && !(raw[index] === '!' && raw[index + 1] === '[')) {
    return null;
  }
  const target = readMarkdownTarget(raw, index);
  if (target?.start !== index) {
    return null;
  }
  const labelStart = index + (target.image ? 2 : 1);
  const labelEnd = labelStart + target.label.length;
  const label = protectInlineHtml(raw.slice(labelStart, labelEnd));
  tags.push(...label.tags);
  return {
    text:
      raw.slice(index, labelStart) +
      shiftHtmlMarks(label.text, tags.length - label.tags.length) +
      raw.slice(labelEnd, target.end),
    next: target.end,
  };
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
    const link = protectHtmlLink(raw, index, tags);
    if (link) {
      text += link.text;
      index = link.next;
      continue;
    }
    const end = char === '<' ? inlineHtmlEnd(raw, index) : -1;
    if (end !== -1) {
      const skipped = skippedDroppedElement(raw, index, end);
      if (skipped !== -1) {
        index = skipped;
        continue;
      }
      const opening = raw.slice(index, end);
      if (/^<\s*style\b/i.test(opening) && !/^<\s*\//.test(opening)) {
        const style = styleBlock(raw, index, end);
        tags.push(style.text);
        text += `${HTML_MARK}${tags.length - 1}${HTML_MARK}`;
        index = style.next;
        continue;
      }
      tags.push(sanitizeExportedTag(opening));
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

function plainDestination(raw: string): string {
  return decodeHtmlEntities(linkDestination(raw));
}

function renderImageTarget(target: MarkdownTarget): string {
  const text = inlinePlainText(renderRich(target.label));
  const src = safeImageAddress(plainDestination(target.destination));
  if (src === null) {
    return escapeText(text);
  }
  const title = titleAttribute(target.destination);
  return `<img src="${escapeHtml(src)}" alt="${escapeText(text)}"${title} />`;
}

function renderLinkTarget(target: MarkdownTarget): string {
  const label = renderRich(target.label);
  const destination = plainDestination(target.destination);
  const fragment = normalizedHeadingFragment(destination);
  const href = fragment ? `#${fragment}` : safeLinkAddress(destination);
  if (href === null) {
    return label;
  }
  return `<a href="${escapeHtml(href)}"${titleAttribute(target.destination)}>${label}</a>`;
}

function renderTarget(target: MarkdownTarget): string {
  return target.image ? renderImageTarget(target) : renderLinkTarget(target);
}

interface PlainSpan {
  readonly start: number;
  readonly end: number;
  readonly html: string;
}

function findMathSpan(raw: string, from: number): PlainSpan | null {
  for (let index = from; index < raw.length; index += 1) {
    const delimiter = mathDelimiterAt(raw, index);
    const end = delimiter === null ? -1 : mathSpanEnd(raw, index, delimiter);
    if (delimiter === null || end === -1) {
      continue;
    }
    const interior = raw.slice(index + delimiter.length, end - delimiter.length);
    return { start: index, end, html: renderKatex(interior, delimiter === '$$') };
  }
  return null;
}

function nextPlainSpan(raw: string, cursor: number): PlainSpan | null {
  const spans: PlainSpan[] = [];
  const code = findCodeSpan(raw, cursor);
  const math = findMathSpan(raw, cursor);
  const target = findMarkdownTarget(raw, cursor);
  if (code) {
    spans.push({
      start: code.start,
      end: code.end,
      html: `<code>${escapeHtml(code.text)}</code>`,
    });
  }
  if (math) {
    spans.push(math);
  }
  if (target && target.start < raw.length) {
    spans.push({ start: target.start, end: target.end, html: renderTarget(target) });
  }
  spans.sort((left, right) => left.start - right.start);
  return spans[0] ?? null;
}

function renderPlain(raw: string): string {
  let result = '';
  let cursor = 0;
  while (cursor < raw.length) {
    const span = nextPlainSpan(raw, cursor);
    if (!span) {
      return result + escapeText(raw.slice(cursor));
    }
    result += escapeText(raw.slice(cursor, span.start));
    result += span.html;
    cursor = span.end;
  }
  return result;
}

function nextStrike(html: string, from: number): number {
  let index = from;
  while (index < html.length) {
    if (html.startsWith('<code', index)) {
      const end = html.indexOf('</code>', index);
      if (end === -1) {
        return -1;
      }
      index = end + '</code>'.length;
      continue;
    }
    if (html.startsWith('~~', index)) {
      return index;
    }
    index += 1;
  }
  return -1;
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
      const end = nextStrike(html, index + 2);
      if (end !== -1) {
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

/** Escape text, then apply emphasis, code, links, and formulas. Prices stay text. */
export function renderMarkdownInline(value: string): string {
  return renderText(value);
}

export function renderDisplayMathBlock(lines: readonly string[]): string {
  return renderKatex(lines.join('\n'), true);
}
