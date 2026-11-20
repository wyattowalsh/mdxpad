/**
 * Words a printed page would otherwise hide.
 * A canvas, a closed dialog, a closed disclosure, a suggestion list, and a
 * media fallback stay in the HTML, where a reader can see them.
 */

import { htmlTagEnd } from './markdown-export-address';

interface ElementSpan {
  readonly innerEnd: number;
  readonly next: number;
}

function tagName(tag: string): string {
  return /^<\s*\/?\s*([A-Za-z][A-Za-z0-9-]*)/.exec(tag)?.[1]?.toLowerCase() ?? '';
}

function attribute(tag: string, name: string): string {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\`]+))`, 'i').exec(
    tag
  );
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function matchingClose(html: string, name: string, openEnd: number): ElementSpan | null {
  let depth = 1;
  let cursor = openEnd;
  const open = new RegExp(`^<${name}\\b`, 'i');
  const close = new RegExp(`^</${name}\\s*>`, 'i');
  while (cursor < html.length) {
    const start = html.indexOf('<', cursor);
    if (start === -1) {
      return null;
    }
    const end = htmlTagEnd(html, start);
    if (end === -1) {
      return null;
    }
    const piece = html.slice(start, end);
    if (close.test(piece)) {
      depth -= 1;
      if (depth === 0) {
        return { innerEnd: start, next: end };
      }
    } else if (open.test(piece) && !piece.endsWith('/>')) {
      depth += 1;
    }
    cursor = end;
  }
  return null;
}

function openDetails(tag: string): string {
  if (/\sopen(?:\s|=|>)/i.test(tag)) {
    return tag;
  }
  return tag.replace(/>$/, ' open>');
}

function optionLabels(inner: string): string[] {
  const labels: string[] = [];
  let index = 0;
  while (index < inner.length) {
    const start = inner.indexOf('<', index);
    if (start === -1) {
      break;
    }
    const end = htmlTagEnd(inner, start);
    if (end === -1) {
      break;
    }
    const tag = inner.slice(start, end);
    if (tagName(tag) === 'option' && !tag.startsWith('</')) {
      const close = matchingClose(inner, 'option', end);
      const body = close ? inner.slice(end, close.innerEnd) : '';
      const named = attribute(tag, 'label');
      const text = body.replace(/<[^>]+>/g, '').trim();
      const label = named.length > 0 ? named : text || attribute(tag, 'value');
      if (label.length > 0) {
        labels.push(label);
      }
      index = close?.next ?? end;
      continue;
    }
    if (tagName(tag) === 'optgroup' && !tag.startsWith('</')) {
      const group = attribute(tag, 'label');
      if (group.length > 0) {
        labels.push(group);
      }
    }
    index = end;
  }
  return labels;
}

function mediaPieces(inner: string): { kept: string; words: string } {
  let kept = '';
  let words = '';
  let index = 0;
  while (index < inner.length) {
    const start = inner.indexOf('<', index);
    if (start === -1) {
      words += inner.slice(index);
      break;
    }
    words += inner.slice(index, start);
    const end = htmlTagEnd(inner, start);
    if (end === -1) {
      words += inner.slice(start);
      break;
    }
    const tag = inner.slice(start, end);
    const name = tagName(tag);
    if ((name === 'source' || name === 'track') && !tag.startsWith('</')) {
      const close = tag.endsWith('/>') ? null : matchingClose(inner, name, end);
      const next = close?.next ?? end;
      kept += inner.slice(start, next);
      index = next;
      continue;
    }
    words += tag;
    index = end;
  }
  return { kept, words };
}

function withoutAnnotations(inner: string): string {
  return inner.replace(/<annotation(?:-xml)?\b[^>]*>[\s\S]*?<\/annotation(?:-xml)?>/gi, '');
}

function hiddenMath(inner: string): string {
  const parts: string[] = [];
  const pattern = /<annotation(?:-xml)?\b[^>]*>([\s\S]*?)<\/annotation(?:-xml)?>/gi;
  for (const match of inner.matchAll(pattern)) {
    const text = (match[1] ?? '').replace(/<[^>]+>/g, '').trim();
    if (text.length > 0) {
      parts.push(text);
    }
  }
  const glyph = /<mglyph\b[^>]*>/i.exec(withoutAnnotations(inner));
  const alt = glyph ? attribute(glyph[0], 'alt') : '';
  if (alt.length > 0) {
    parts.push(alt);
  }
  return parts.join(' ');
}

function presented(inner: string): boolean {
  return /<m(?:i|n|o|text|s|frac|sup|sub|sqrt|root|row|table)\b/i.test(withoutAnnotations(inner));
}

function copiedRegion(html: string, start: number, end: number, tag: string): string | null {
  const name = tagName(tag);
  if (
    tag.startsWith('</') ||
    tag.endsWith('/>') ||
    (name !== 'pre' && name !== 'code' && name !== 'script' && name !== 'style')
  ) {
    return null;
  }
  const close = matchingClose(html, name, end);
  return close ? html.slice(start, close.next) : null;
}

interface Revealed {
  readonly text: string;
  readonly next: number;
}

function unwrap(html: string, name: string, openEnd: number): Revealed | null {
  const close = matchingClose(html, name, openEnd);
  if (!close) {
    return null;
  }
  return { text: revealPrintedHtml(html.slice(openEnd, close.innerEnd)), next: close.next };
}

function revealButton(html: string, tag: string, openEnd: number): Revealed | null {
  const close = matchingClose(html, 'button', openEnd);
  if (!close) {
    return null;
  }
  const inner = html.slice(openEnd, close.innerEnd);
  if (inner.replace(/<[^>]+>/g, '').trim().length > 0) {
    return { text: `${tag}${revealPrintedHtml(inner)}</button>`, next: close.next };
  }
  const label = attribute(tag, 'aria-label') || attribute(tag, 'value');
  if (label.length === 0) {
    return { text: `${tag}</button>`, next: close.next };
  }
  return { text: `<button>${escapeText(label)}</button>`, next: close.next };
}

function revealMedia(html: string, tag: string, name: string, openEnd: number): Revealed | null {
  const close = matchingClose(html, name, openEnd);
  if (!close) {
    return null;
  }
  const pieces = mediaPieces(html.slice(openEnd, close.innerEnd));
  const words = revealPrintedHtml(pieces.words).trim();
  const player = `${tag}${pieces.kept}</${name}>`;
  return { text: words.length > 0 ? `${player}${words}` : player, next: close.next };
}

function revealMath(html: string, start: number, openEnd: number): Revealed | null {
  const close = matchingClose(html, 'math', openEnd);
  if (!close) {
    return null;
  }
  const inner = html.slice(openEnd, close.innerEnd);
  const source = hiddenMath(inner);
  if (presented(inner) || source.length === 0) {
    return { text: html.slice(start, close.next), next: close.next };
  }
  return { text: escapeText(source), next: close.next };
}

function revealList(html: string, openEnd: number): Revealed | null {
  const close = matchingClose(html, 'datalist', openEnd);
  if (!close) {
    return null;
  }
  return {
    text: escapeText(optionLabels(html.slice(openEnd, close.innerEnd)).join(', ')),
    next: close.next,
  };
}

function revealElement(html: string, start: number, end: number): Revealed | null {
  const tag = html.slice(start, end);
  const name = tagName(tag);
  if (tag.startsWith('</') || tag.endsWith('/>')) {
    return null;
  }
  switch (name) {
    case 'details':
      return { text: openDetails(tag), next: end };
    case 'canvas':
    case 'dialog':
      return unwrap(html, name, end);
    case 'datalist':
      return revealList(html, end);
    case 'button':
      return revealButton(html, tag, end);
    case 'video':
    case 'audio':
      return revealMedia(html, tag, name, end);
    case 'math':
      return revealMath(html, start, end);
    default:
      return null;
  }
}

/** Show words that a canvas, dialog, disclosure, or media element would hide. */
export function revealPrintedHtml(html: string): string {
  let result = '';
  let index = 0;
  while (index < html.length) {
    const start = html.indexOf('<', index);
    if (start === -1) {
      return result + html.slice(index);
    }
    result += html.slice(index, start);
    const end = htmlTagEnd(html, start);
    if (end === -1) {
      return result + html.slice(start);
    }
    const copied = copiedRegion(html, start, end, html.slice(start, end));
    if (copied !== null) {
      result += copied;
      index = start + copied.length;
      continue;
    }
    const revealed = revealElement(html, start, end);
    if (revealed) {
      result += revealed.text;
      index = revealed.next;
      continue;
    }
    result += html.slice(start, end);
    index = end;
  }
  return result;
}
