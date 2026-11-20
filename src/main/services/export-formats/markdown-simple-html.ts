import { mapFencedProse } from '@shared/lib/markdown-math';
import { promoteInlineHtml } from '@shared/lib/inline-html';
import { readAngleTag } from '@shared/lib/markdown-tags';

import { readCodeSpan } from './markdown-escape';
import { plainFootnoteMarkers } from './markdown-footnote';
import { expandLinkReferences } from './markdown-reference';
import type { TableAlign } from './markdown-table';

const PHRASE = new Set(['cite', 'dfn', 'q', 'samp', 'small', 'time', 'var']);
const RUBY = new Set(['rb', 'rp', 'rt', 'ruby']);

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
    PHRASE.has(name) ||
    RUBY.has(name) ||
    name === 'ul' ||
    name === 'ol' ||
    name === 'li' ||
    name === 'blockquote' ||
    name === 'pre' ||
    name === 'span' ||
    name === 'table' ||
    name === 'thead' ||
    name === 'tbody' ||
    name === 'tfoot' ||
    name === 'caption' ||
    name === 'tr' ||
    name === 'th' ||
    name === 'td' ||
    name === 'dl' ||
    name === 'dt' ||
    name === 'dd' ||
    name === 'details' ||
    name === 'summary' ||
    name === 'kbd' ||
    name === 'ins' ||
    name === 'input' ||
    name === 'abbr' ||
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
  if (open.selfClosing || name === 'input') {
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

interface ListedItem {
  readonly body: string;
  readonly value: number | null;
}

interface OrderedListOptions {
  readonly type: string;
  readonly start: number | null;
  readonly reversed: boolean;
}

function openTagBefore(value: string, innerStart: number): string {
  const openAt = value.lastIndexOf('<', Math.max(0, innerStart - 1));
  return openAt === -1 ? '' : value.slice(openAt, innerStart);
}

function parsedAttribute(openTag: string, name: string): number | null {
  const raw = attribute(openTag, name).trim();
  if (raw.length === 0) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function listItems(inner: string): ListedItem[] {
  const items: ListedItem[] = [];
  let index = 0;
  while (index < inner.length) {
    const element = inner[index] === '<' ? readSimpleElement(inner, index) : null;
    if (element?.name === 'li') {
      items.push({
        body: inner.slice(element.innerStart, element.innerEnd),
        value: parsedAttribute(openTagBefore(inner, element.innerStart), 'value'),
      });
      index = element.end;
      continue;
    }
    index = element ? element.end : index + 1;
  }
  return items;
}

function listOptions(value: string, innerStart: number): OrderedListOptions {
  const openTag = openTagBefore(value, innerStart);
  return {
    type: attribute(openTag, 'type').trim() || '1',
    start: parsedAttribute(openTag, 'start'),
    reversed: /\breversed\b/i.test(openTag),
  };
}

function itemNumbers(items: readonly ListedItem[], options: OrderedListOptions): number[] {
  let next = options.start ?? (options.reversed ? items.length : 1);
  return items.map((item) => {
    const number = item.value ?? next;
    next = options.reversed ? number - 1 : number + 1;
    return number;
  });
}

function alphaLabel(number: number, upper: boolean): string {
  let n = number;
  let label = '';
  while (n > 0) {
    n -= 1;
    label = String.fromCharCode((upper ? 65 : 97) + (n % 26)) + label;
    n = Math.floor(n / 26);
  }
  return label;
}

function romanLabel(number: number, upper: boolean): string {
  const glyphs = [
    [1000, 'm'],
    [900, 'cm'],
    [500, 'd'],
    [400, 'cd'],
    [100, 'c'],
    [90, 'xc'],
    [50, 'l'],
    [40, 'xl'],
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ] as const;
  let n = number;
  let label = '';
  for (const [value, glyph] of glyphs) {
    while (n >= value) {
      label += glyph;
      n -= value;
    }
  }
  return upper ? label.toUpperCase() : label;
}

function formatListNumber(number: number, type: string): string {
  if (number < 1) {
    return String(number);
  }
  switch (type) {
    case 'a':
      return alphaLabel(number, false);
    case 'A':
      return alphaLabel(number, true);
    case 'i':
      return romanLabel(number, false);
    case 'I':
      return romanLabel(number, true);
    default:
      return String(number);
  }
}

function needsExplicitLabels(items: readonly ListedItem[], options: OrderedListOptions): boolean {
  return (
    options.type !== '1' ||
    options.reversed ||
    (options.start !== null && options.start <= 0) ||
    items.some((item) => item.value !== null)
  );
}

function renderExplicitList(items: readonly ListedItem[], options: OrderedListOptions): string {
  const numbers = itemNumbers(items, options);
  const lines = items.map((item, index) => {
    const label = formatListNumber(numbers[index] ?? index + 1, options.type);
    return markerBlock('- ', `${label}. ${convertHtml(item.body).trim()}`);
  });
  return blockWrap(lines.join('\n'));
}

function renderList(inner: string, ordered: boolean, options?: OrderedListOptions): string {
  const items = listItems(inner);
  if (ordered && options && needsExplicitLabels(items, options)) {
    return renderExplicitList(items, options);
  }
  const start = ordered && options?.start !== null && options?.start !== undefined ? options.start : 1;
  const lines = items.map((item, index) =>
    markerBlock(ordered ? `${start + index}. ` : '- ', convertHtml(item.body))
  );
  return blockWrap(lines.join('\n'));
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

interface TableCell {
  readonly text: string;
  readonly align: TableAlign;
}

function cellAlign(openTag: string): TableAlign {
  const match = /(?:\balign\s*=\s*["']?|text-align\s*:\s*)(left|center|right)/i.exec(openTag);
  switch (match?.[1]?.toLowerCase()) {
    case 'center':
      return 'center';
    case 'right':
      return 'right';
    default:
      return 'left';
  }
}

function cellText(inner: string): string {
  return convertHtml(inner)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .replaceAll('|', '\\|')
    .trim();
}

function rowCells(value: string): TableCell[] {
  const cells: TableCell[] = [];
  let index = 0;
  while (index < value.length) {
    const element = value[index] === '<' ? readSimpleElement(value, index) : null;
    if (element && (element.name === 'td' || element.name === 'th')) {
      const openAt = value.lastIndexOf('<', Math.max(0, element.innerStart - 1));
      const openTag = openAt === -1 ? '' : value.slice(openAt, element.innerStart);
      cells.push({
        text: cellText(value.slice(element.innerStart, element.innerEnd)),
        align: cellAlign(openTag),
      });
      index = element.end;
      continue;
    }
    index = element ? element.end : index + 1;
  }
  return cells;
}

function tableParts(value: string): {
  captions: string[];
  head: TableCell[][];
  body: TableCell[][];
  foot: TableCell[][];
} {
  const captions: string[] = [];
  const head: TableCell[][] = [];
  const body: TableCell[][] = [];
  const foot: TableCell[][] = [];
  let index = 0;
  while (index < value.length) {
    const element = value[index] === '<' ? readSimpleElement(value, index) : null;
    if (!element) {
      index += 1;
      continue;
    }
    const inner = value.slice(element.innerStart, element.innerEnd);
    if (element.name === 'caption') {
      const text = cellText(inner);
      if (text.length > 0) {
        captions.push(text);
      }
    } else if (element.name === 'tr') {
      body.push(rowCells(inner));
    } else if (element.name === 'thead' || element.name === 'tbody' || element.name === 'tfoot') {
      const nested = tableParts(inner);
      captions.push(...nested.captions);
      const rows = [...nested.head, ...nested.body, ...nested.foot];
      if (element.name === 'thead') {
        head.push(...rows);
      } else if (element.name === 'tfoot') {
        foot.push(...rows);
      } else {
        body.push(...rows);
      }
    }
    index = element.end;
  }
  return { captions, head, body, foot };
}

function ruleCell(align: TableAlign): string {
  switch (align) {
    case 'center':
      return ':---:';
    case 'right':
      return '---:';
    case 'left':
      return '---';
    default: {
      const unexpected: never = align;
      return unexpected;
    }
  }
}

function markdownTable(rows: readonly (readonly TableCell[])[]): string {
  const filled = rows.filter((row) => row.length > 0);
  const width = filled.reduce((max, row) => Math.max(max, row.length), 0);
  if (width === 0) {
    return '';
  }
  const line = (row: readonly TableCell[] | undefined, rule: boolean): string => {
    const cells: string[] = [];
    for (let index = 0; index < width; index += 1) {
      const cell = row?.[index];
      cells.push(rule ? ruleCell(cell?.align ?? 'left') : (cell?.text ?? ''));
    }
    return `| ${cells.join(' | ')} |`;
  };
  const [header, ...body] = filled;
  const lines = [line(header, false), line(header, true), ...body.map((row) => line(row, false))];
  return blockWrap(lines.join('\n'));
}

function renderTable(name: string, inner: string): string {
  if (name === 'tr') {
    return markdownTable([rowCells(inner)]);
  }
  const parts = tableParts(inner);
  const table = markdownTable([...parts.head, ...parts.body, ...parts.foot]);
  if (parts.captions.length === 0) {
    return table;
  }
  const body = [parts.captions.join('\n\n'), table.trim()].filter((part) => part.length > 0);
  return blockWrap(body.join('\n\n'));
}

function renderDefinitions(inner: string): string {
  const parts: string[] = [];
  let index = 0;
  while (index < inner.length) {
    const element = inner[index] === '<' ? readSimpleElement(inner, index) : null;
    if (element?.name === 'dt') {
      const term = cellText(inner.slice(element.innerStart, element.innerEnd));
      if (term.length > 0) {
        parts.push(`**${term}**`);
      }
      index = element.end;
      continue;
    }
    if (element?.name === 'dd') {
      const body = convertHtml(inner.slice(element.innerStart, element.innerEnd)).trim();
      if (body.length > 0) {
        parts.push(body);
      }
      index = element.end;
      continue;
    }
    index = element ? element.end : index + 1;
  }
  return blockWrap(parts.join('\n\n'));
}

function extractElement(value: string, name: string): { inner: string; rest: string } | null {
  let index = 0;
  while (index < value.length) {
    const element = value[index] === '<' ? readSimpleElement(value, index) : null;
    if (element?.name === name) {
      const inner = value.slice(element.innerStart, element.innerEnd);
      const rest = value.slice(0, index) + value.slice(element.end);
      return { inner, rest };
    }
    index = element ? element.end : index + 1;
  }
  return null;
}

function renderDetails(inner: string): string {
  const summary = extractElement(inner, 'summary');
  const label = summary ? cellText(summary.inner) : '';
  const body = convertHtml(summary ? summary.rest : inner).trim();
  const heading = label.length > 0 ? `**${label}**` : '';
  const parts = [heading, body].filter((part) => part.length > 0);
  return blockWrap(parts.join('\n\n'));
}

function renderInput(value: string, element: HtmlElement): string {
  const openTag = openTagBefore(value, element.innerStart);
  if (attribute(openTag, 'type').trim().toLowerCase() !== 'checkbox') {
    return openTag;
  }
  const box = /\bchecked\b/i.test(openTag) ? '[x]' : '[ ]';
  const follower = value[element.end] ?? '';
  return follower.length === 0 || /\s/.test(follower) ? box : `${box} `;
}

function renderKbd(inner: string): string {
  const text = cellText(inner);
  if (text.length === 0 || text.includes('`')) {
    return text;
  }
  return `\`${text}\``;
}

function attribute(openTag: string, name: string): string {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`,
    'i'
  ).exec(openTag);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}

function renderAbbr(value: string, element: HtmlElement): string {
  const openAt = value.lastIndexOf('<', Math.max(0, element.innerStart - 1));
  const openTag = openAt === -1 ? '' : value.slice(openAt, element.innerStart);
  const text = cellText(value.slice(element.innerStart, element.innerEnd));
  const title = attribute(openTag, 'title').trim();
  return title.length > 0 ? `${text} (${title})` : text;
}

function emphasized(text: string): string {
  if (text.length === 0 || text.includes('*') || text.includes('_')) {
    return text;
  }
  return `*${text}*`;
}

function renderTime(value: string, element: HtmlElement, text: string): string {
  const openAt = value.lastIndexOf('<', Math.max(0, element.innerStart - 1));
  const openTag = openAt === -1 ? '' : value.slice(openAt, element.innerStart);
  const when = attribute(openTag, 'datetime').trim();
  if (when.length === 0 || when === text) {
    return text;
  }
  return `${text} (${when})`;
}

function renderInlineRole(element: HtmlElement, value: string, inner: string): string | null {
  const text = cellText(inner);
  switch (element.name) {
    case 'q':
      return text.length === 0 ? '' : `“${text}”`;
    case 'cite':
    case 'dfn':
    case 'var':
      return emphasized(text);
    case 'samp':
      return renderKbd(inner);
    case 'small':
      return text;
    case 'time':
      return renderTime(value, element, text);
    default:
      return null;
  }
}

function renderRuby(inner: string): string {
  let result = '';
  let base = '';
  let index = 0;
  const flush = (reading: string): void => {
    const separated = base.length > 0 && reading.length > 0 && !base.endsWith(' ') ? ' ' : '';
    const spoken = reading.length > 0 ? `${separated}(${reading})` : '';
    const gap = result.length > 0 && base.length > 0 && !result.endsWith(' ') && !base.startsWith(' ') ? ' ' : '';
    result += `${gap}${base}${spoken}`;
    base = '';
  };
  while (index < inner.length) {
    const element = inner[index] === '<' ? readSimpleElement(inner, index) : null;
    if (element?.name === 'rt') {
      flush(cellText(inner.slice(element.innerStart, element.innerEnd)));
      index = element.end;
      continue;
    }
    if (element?.name === 'rp') {
      index = element.end;
      continue;
    }
    if (element?.name === 'rb') {
      base += cellText(inner.slice(element.innerStart, element.innerEnd));
      index = element.end;
      continue;
    }
    if (!element) {
      base += inner[index] ?? '';
      index += 1;
      continue;
    }
    base += renderElement(element, inner);
    index = element.end;
  }
  flush('');
  return result.trim();
}

function renderPhrase(element: HtmlElement, value: string, inner: string): string | null {
  switch (element.name) {
    case 'dl':
      return renderDefinitions(inner);
    case 'dt':
      return blockWrap(`**${cellText(inner)}**`);
    case 'dd':
    case 'summary':
      return blockWrap(convertHtml(inner));
    case 'details':
      return renderDetails(inner);
    case 'kbd':
      return renderKbd(inner);
    case 'ins':
      return `<u>${inner}</u>`;
    case 'input':
      return renderInput(value, element);
    case 'abbr':
      return renderAbbr(value, element);
    case 'ruby':
      return renderRuby(inner);
    case 'rb':
      return cellText(inner);
    case 'rt':
      return cellText(inner).length === 0 ? '' : `(${cellText(inner)})`;
    case 'rp':
      return '';
    default:
      return renderInlineRole(element, value, inner);
  }
}

function renderElement(element: HtmlElement, value: string): string {
  const inner = value.slice(element.innerStart, element.innerEnd);
  const phrase = renderPhrase(element, value, inner);
  if (phrase !== null) {
    return phrase;
  }
  switch (element.name) {
    case 'ul':
      return renderList(inner, false);
    case 'ol':
      return renderList(inner, true, listOptions(value, element.innerStart));
    case 'li':
      return blockWrap(markerBlock('- ', convertHtml(inner)));
    case 'blockquote':
      return renderQuote(inner);
    case 'pre':
      return renderPre(inner);
    case 'table':
    case 'thead':
    case 'tbody':
    case 'tfoot':
    case 'tr':
      return renderTable(element.name, inner);
    case 'caption':
    case 'th':
    case 'td':
      return cellText(inner);
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
