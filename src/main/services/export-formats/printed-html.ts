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

function withoutPopover(tag: string): string {
  return tag
    .replace(/\s+popover\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi, '')
    .replace(/\s+popover(?=[\s/>])/gi, '');
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

function mediaPieces(inner: string): { kept: string; words: string; labels: string[] } {
  let kept = '';
  let words = '';
  const labels: string[] = [];
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
    if (name === 'track' && tag.startsWith('</')) {
      index = end;
      continue;
    }
    if ((name === 'source' || name === 'track') && !tag.startsWith('</')) {
      const label = name === 'track' ? attribute(tag, 'label') : '';
      if (label.length > 0) {
        labels.push(label);
      }
      const close = tag.endsWith('/>') ? null : matchingClose(inner, name, end);
      const next = close?.next ?? end;
      kept += inner.slice(start, next);
      index = next;
      continue;
    }
    words += tag;
    index = end;
  }
  return { kept, words, labels };
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

const WRITTEN_VALUE = new Set([
  'text',
  'color',
  'range',
  'number',
  'date',
  'time',
  'week',
  'month',
  'datetime-local',
  'password',
  'search',
  'email',
  'url',
  'tel',
  'submit',
  'button',
  'reset',
]);

function writtenValue(type: string, value: string, rest: string): string {
  const kind = type.length === 0 ? 'text' : type;
  if (!WRITTEN_VALUE.has(kind) || value.length === 0 || rest.includes(value)) {
    return '';
  }
  return value;
}

function imageButtonName(html: string, tag: string, end: number): string {
  const alt = attribute(tag, 'alt').trim() || attribute(tag, 'aria-label').trim();
  if (alt.length === 0 || html.slice(end).includes(alt)) {
    return '';
  }
  return alt;
}

function inputCaption(html: string, tag: string, end: number): string {
  const type = attribute(tag, 'type').trim().toLowerCase();
  const label = attribute(tag, 'aria-label').trim() || attribute(tag, 'title').trim();
  if (type === 'hidden') {
    return '';
  }
  if (type === 'image') {
    return imageButtonName(html, tag, end);
  }
  if (type === 'checkbox') {
    return label.length === 0 || html.slice(end).includes(label) ? '' : label;
  }
  if (type === 'file' || type === 'radio') {
    if (label.length > 0 || type !== 'radio') {
      return label;
    }
    const choice = attribute(tag, 'value').trim();
    return /^(?:javascript|data|file):/i.test(choice) ? '' : choice;
  }
  const value = attribute(tag, 'value').trim() || attribute(tag, 'placeholder').trim();
  const rest = html.slice(end);
  const name = label.length > 0 && label !== value && !rest.includes(label) ? label : '';
  const shown = writtenValue(type, value, rest);
  if (shown.length > 0 && name.length > 0) {
    return `${shown} (${name})`;
  }
  return shown.length > 0 ? shown : name;
}

function revealInput(html: string, tag: string, end: number): Revealed | null {
  const caption = inputCaption(html, tag, end);
  if (caption.length === 0) {
    return null;
  }
  return { text: `${tag} ${escapeText(caption)}`, next: end };
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
  const caption = pieces.labels.join(', ');
  const title = attribute(tag, 'title').trim() || attribute(tag, 'aria-label').trim();
  const body = words.length > 0 && caption.length > 0 ? `${words} (${caption})` : words || caption;
  const named =
    title.length > 0 && !body.includes(title)
      ? body.length > 0
        ? `${body} (${title})`
        : title
      : body;
  const player = `${tag}${pieces.kept}</${name}>`;
  return { text: named.length > 0 ? `${player}${named}` : player, next: close.next };
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

function revealGauge(html: string, openEnd: number, tag: string, name: string): Revealed | null {
  const close = matchingClose(html, name, openEnd);
  if (!close) {
    return null;
  }
  const inner = html
    .slice(openEnd, close.innerEnd)
    .replace(/<[^>]+>/g, '')
    .trim();
  const title = attribute(tag, 'title').trim() || attribute(tag, 'aria-label').trim();
  if (inner.length > 0) {
    if (title.length === 0 || inner.includes(title)) {
      return null;
    }
    return { text: escapeText(`${inner} (${title})`), next: close.next };
  }
  const current = attribute(tag, 'value').trim();
  if (current.length === 0) {
    return title.length > 0 ? { text: escapeText(title), next: close.next } : null;
  }
  const max = attribute(tag, 'max').trim();
  const reading = name === 'progress' && max.length > 0 ? `${current}/${max}` : current;
  const shown = title.length > 0 && !reading.includes(title) ? `${reading} (${title})` : reading;
  return { text: escapeText(shown), next: close.next };
}

function revealEmpty(
  html: string,
  openEnd: number,
  tag: string,
  name: string,
  attr: string,
  format: (value: string) => string
): Revealed | null {
  const label = attribute(tag, attr).trim();
  if (label.length === 0) {
    return null;
  }
  const close = matchingClose(html, name, openEnd);
  if (!close) {
    return null;
  }
  const inner = html
    .slice(openEnd, close.innerEnd)
    .replace(/<[^>]+>/g, '')
    .trim();
  if (inner.length > 0) {
    if (inner.includes(label)) {
      return null;
    }
    return {
      text: `${tag}${html.slice(openEnd, close.innerEnd)} (${escapeText(label)})</${name}>`,
      next: close.next,
    };
  }
  return { text: escapeText(format(label)), next: close.next };
}

function revealSelect(html: string, openEnd: number, tag: string): Revealed | null {
  const close = matchingClose(html, 'select', openEnd);
  if (!close) {
    return null;
  }
  const choices = optionLabels(html.slice(openEnd, close.innerEnd)).join(', ');
  const name = attribute(tag, 'aria-label').trim() || attribute(tag, 'title').trim();
  const shown =
    name.length === 0 || choices.includes(name)
      ? choices
      : choices.length > 0
        ? `${name}: ${choices}`
        : name;
  return { text: escapeText(shown), next: close.next };
}

function revealHeader(html: string, openEnd: number, tag: string): Revealed | null {
  const expansion = attribute(tag, 'abbr').trim();
  if (expansion.length === 0) {
    return null;
  }
  const close = matchingClose(html, 'th', openEnd);
  if (!close) {
    return null;
  }
  const inner = revealPrintedHtml(html.slice(openEnd, close.innerEnd));
  if (inner.includes(expansion)) {
    return { text: `${tag}${inner}</th>`, next: close.next };
  }
  const body =
    inner.trim().length === 0 ? escapeText(expansion) : `${inner} (${escapeText(expansion)})`;
  return { text: `${tag}${body}</th>`, next: close.next };
}

function revealTable(html: string, tag: string, end: number): Revealed | null {
  const summary = attribute(tag, 'summary').trim();
  if (summary.length === 0 || html.slice(end).includes(summary)) {
    return null;
  }
  return { text: `${escapeText(summary)}${withoutPopover(tag)}`, next: end };
}

function revealElement(html: string, start: number, end: number): Revealed | null {
  const tag = html.slice(start, end);
  const name = tagName(tag);
  if ((name === 'track' || name === 'source') && tag.startsWith('</')) {
    return { text: '', next: end };
  }
  if (name === 'input' || name === 'area' || name === 'img' || name === 'menuitem') {
    return revealVoid(html, tag, name, end);
  }
  if (tag.startsWith('</') || tag.endsWith('/>')) {
    return null;
  }
  switch (name) {
    case 'details':
      return { text: withoutPopover(openDetails(tag)), next: end };
    case 'canvas':
    case 'dialog':
    case 'noscript':
      return unwrap(html, name, end);
    case 'datalist':
      return revealList(html, end);
    case 'select':
      return revealSelect(html, end, tag);
    case 'time':
      return revealEmpty(html, end, tag, 'time', 'datetime', (value) => `(${value})`);
    case 'abbr':
      return revealEmpty(html, end, tag, 'abbr', 'title', (value) => `(${value})`);
    case 'dfn':
      return revealEmpty(html, end, tag, 'dfn', 'title', (value) => value);
    case 'data':
      return revealEmpty(html, end, tag, 'data', 'value', (value) => value);
    case 'meter':
    case 'progress':
      return revealGauge(html, end, tag, name);
    case 'button':
      return revealButton(html, tag, end);
    case 'video':
    case 'audio':
      return revealMedia(html, tag, name, end);
    case 'math':
      return revealMath(html, start, end);
    case 'th':
      return revealHeader(html, end, tag);
    case 'table':
      return revealTable(html, tag, end);
    default:
      return revealRest(html, tag, name, end);
  }
}

function revealVoid(html: string, tag: string, name: string, end: number): Revealed | null {
  if (name === 'input') {
    return revealInput(html, tag, end);
  }
  if (name === 'area') {
    return revealArea(tag, end);
  }
  if (name === 'menuitem') {
    return revealMenuItem(html, tag, end);
  }
  return revealImage(html, tag, end);
}

function revealImage(html: string, tag: string, end: number): Revealed | null {
  const alt = attribute(tag, 'alt').trim();
  if (alt.length === 0 || html.slice(end).includes(alt)) {
    return null;
  }
  return { text: `${tag} ${escapeText(alt)}`, next: end };
}

function revealArea(tag: string, end: number): Revealed | null {
  const alt = attribute(tag, 'alt').trim();
  const href = attribute(tag, 'href').trim();
  const safe = /^https?:\/\//i.test(href) ? href : '';
  if (alt.length === 0 && safe.length === 0) {
    return null;
  }
  const text = alt.length > 0 && safe.length > 0 ? `${alt} (${safe})` : alt || safe;
  return { text: escapeText(text), next: end };
}

function revealTextarea(html: string, tag: string, end: number): Revealed | null {
  const close = matchingClose(html, 'textarea', end);
  if (!close) {
    return null;
  }
  const inner = html
    .slice(end, close.innerEnd)
    .replace(/<[^>]+>/g, '')
    .trim();
  if (inner.length > 0) {
    return null;
  }
  const label = attribute(tag, 'placeholder').trim() || attribute(tag, 'aria-label').trim();
  if (label.length === 0) {
    return null;
  }
  return { text: escapeText(label), next: close.next };
}

function revealSummary(html: string, tag: string, end: number): Revealed | null {
  const title = attribute(tag, 'title').trim();
  if (title.length === 0) {
    return null;
  }
  const close = matchingClose(html, 'summary', end);
  if (!close) {
    return null;
  }
  const inner = html.slice(end, close.innerEnd);
  if (inner.includes(title)) {
    return null;
  }
  const text = inner.replace(/<[^>]+>/g, '').trim();
  const body = text.length > 0 ? `${inner} (${escapeText(title)})` : escapeText(title);
  return { text: `${tag}${body}</summary>`, next: close.next };
}

function revealRest(html: string, tag: string, name: string, end: number): Revealed | null {
  if (name === 'textarea') {
    return revealTextarea(html, tag, end);
  }
  if (name === 'summary') {
    return revealSummary(html, tag, end);
  }
  if (name === 'option') {
    return revealOption(html, tag, end);
  }
  if (name === 'output') {
    return revealOutput(html, tag, end);
  }
  if (name === 'del' || name === 'ins') {
    return revealStamp(html, tag, name, end);
  }
  if (name === 'q' || name === 'blockquote') {
    return revealCited(html, tag, name, end);
  }
  if (name === 'applet') {
    return revealApplet(html, tag, end);
  }
  return null;
}

function readableCite(tag: string): string {
  const cite = attribute(tag, 'cite').trim();
  if (cite.length === 0 || /^(?:javascript|data|file):/i.test(cite)) {
    return '';
  }
  return cite;
}

function revealCited(html: string, tag: string, name: string, end: number): Revealed | null {
  const cite = readableCite(tag);
  if (cite.length === 0) {
    return null;
  }
  const close = matchingClose(html, name, end);
  if (!close) {
    return { text: escapeText(cite), next: end };
  }
  const inner = html.slice(end, close.innerEnd);
  if (inner.includes(cite)) {
    return null;
  }
  const text = inner.replace(/<[^>]+>/g, '').trim();
  const body = text.length > 0 ? `${inner} (${escapeText(cite)})` : escapeText(cite);
  return { text: `${tag}${body}</${name}>`, next: close.next };
}

function revealApplet(html: string, tag: string, end: number): Revealed | null {
  const alt = attribute(tag, 'alt').trim();
  const close = matchingClose(html, 'applet', end);
  if (!close) {
    return alt.length > 0 ? { text: `${tag} ${escapeText(alt)}`, next: end } : null;
  }
  const inner = html.slice(end, close.innerEnd);
  const text = inner.replace(/<[^>]+>/g, '').trim();
  if (alt.length === 0 || text.includes(alt) || (text.length > 0 && !text.includes('&lt;'))) {
    return null;
  }
  const body = text.length > 0 ? `${inner} ${escapeText(alt)}` : escapeText(alt);
  return { text: `${tag}${body}</applet>`, next: close.next };
}

function revealMenuItem(html: string, tag: string, end: number): Revealed | null {
  const named = attribute(tag, 'label').trim();
  if (tag.startsWith('</')) {
    return null;
  }
  if (tag.endsWith('/>')) {
    return named.length > 0 ? { text: escapeText(named), next: end } : null;
  }
  const close = matchingClose(html, 'menuitem', end);
  if (!close) {
    return named.length > 0 ? { text: escapeText(named), next: end } : null;
  }
  const text = html
    .slice(end, close.innerEnd)
    .replace(/<[^>]+>/g, '')
    .trim();
  const label = text.length > 0 ? text : named;
  if (label.length === 0) {
    return null;
  }
  return { text: escapeText(label), next: close.next };
}

function revealOutput(html: string, tag: string, end: number): Revealed | null {
  const label = attribute(tag, 'aria-label').trim() || attribute(tag, 'title').trim();
  if (label.length === 0) {
    return null;
  }
  const close = matchingClose(html, 'output', end);
  if (!close) {
    return { text: escapeText(label), next: end };
  }
  const inner = html.slice(end, close.innerEnd);
  if (inner.includes(label)) {
    return null;
  }
  const text = inner.replace(/<[^>]+>/g, '').trim();
  const body = text.length > 0 ? `${inner} (${escapeText(label)})` : escapeText(label);
  return { text: `${tag}${body}</output>`, next: close.next };
}

function withoutBlockedStamp(tag: string): string {
  return tag.replace(
    /\s+(?:cite|datetime)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi,
    (
      full,
      doubleQuoted: string | undefined,
      singleQuoted: string | undefined,
      bare: string | undefined
    ) => {
      const value = (doubleQuoted ?? singleQuoted ?? bare ?? '').trim();
      return /^(?:javascript|data|file):/i.test(value) ? '' : full;
    }
  );
}

function revealStamp(html: string, tag: string, name: string, end: number): Revealed | null {
  const stamp = attribute(tag, 'datetime').trim() || attribute(tag, 'cite').trim();
  if (/^(?:javascript|data|file):/i.test(stamp)) {
    const close = matchingClose(html, name, end);
    if (!close) {
      return { text: withoutBlockedStamp(tag), next: end };
    }
    return {
      text: `${withoutBlockedStamp(tag)}${html.slice(end, close.next)}`,
      next: close.next,
    };
  }
  if (stamp.length === 0) {
    return null;
  }
  const close = matchingClose(html, name, end);
  if (!close) {
    return { text: escapeText(stamp), next: end };
  }
  const inner = html.slice(end, close.innerEnd);
  if (inner.includes(stamp)) {
    return null;
  }
  return { text: `${tag}${inner} (${escapeText(stamp)})</${name}>`, next: close.next };
}

function revealOption(html: string, tag: string, end: number): Revealed | null {
  const named = attribute(tag, 'label').trim();
  const close = matchingClose(html, 'option', end);
  if (!close) {
    return named.length > 0 ? { text: escapeText(named), next: end } : null;
  }
  const text = html
    .slice(end, close.innerEnd)
    .replace(/<[^>]+>/g, '')
    .trim();
  const label = named.length > 0 ? named : text || attribute(tag, 'value').trim();
  if (label.length === 0) {
    return null;
  }
  return { text: escapeText(label), next: close.next };
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
    result += withoutPopover(html.slice(start, end));
    index = end;
  }
  return result;
}
