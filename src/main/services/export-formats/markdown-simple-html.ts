import { mapFencedProse } from '@shared/lib/markdown-math';
import { promoteInlineHtml } from '@shared/lib/inline-html';
import { readAngleTag } from '@shared/lib/markdown-tags';

import { readCodeSpan } from './markdown-escape';
import { plainFootnoteMarkers } from './markdown-footnote';
import { expandLinkReferences } from './markdown-reference';
import type { TableAlign } from './markdown-table';

const PHRASE = new Set(['cite', 'dfn', 'q', 'samp', 'small', 'time', 'var']);
const FORM = new Set([
  'button',
  'label',
  'meter',
  'optgroup',
  'option',
  'output',
  'progress',
  'select',
  'textarea',
]);
const GROUP = new Set([
  'address',
  'center',
  'dialog',
  'fieldset',
  'form',
  'hgroup',
  'map',
  'picture',
  'search',
]);
const EMBEDDED = new Set([
  'area',
  'audio',
  'bdo',
  'data',
  'datalist',
  'legend',
  'source',
  'track',
  'video',
]);
const COMMAND = new Set(['dir', 'menu']);
const PRESENT = new Set(['acronym', 'big', 'font', 'marquee', 'nobr', 'tt']);
const GRAPHIC = new Set([
  'clippath',
  'defs',
  'desc',
  'foreignobject',
  'g',
  'lineargradient',
  'marker',
  'mask',
  'metadata',
  'noscript',
  'pattern',
  'radialgradient',
  'svg',
  'symbol',
  'text',
  'textpath',
  'title',
  'tspan',
]);
const HIDDEN = new Set([
  'animate',
  'animatemotion',
  'animatetransform',
  'circle',
  'ellipse',
  'feimage',
  'image',
  'line',
  'mpath',
  'path',
  'polygon',
  'polyline',
  'rect',
  'script',
  'set',
  'stop',
  'style',
  'template',
  'use',
]);
const VOID_HTML = new Set(['area', 'source', 'track']);
const MATH_TOKEN = new Set(['mi', 'mn', 'mo', 'ms', 'mtext']);
const MATH = new Set([
  ...MATH_TOKEN,
  'annotation',
  'annotation-xml',
  'math',
  'menclose',
  'mfrac',
  'mpadded',
  'mphantom',
  'mroot',
  'mrow',
  'mspace',
  'msqrt',
  'mstyle',
  'msub',
  'msubsup',
  'msup',
  'mtable',
  'mtd',
  'mtr',
  'munder',
  'munderover',
  'mover',
  'semantics',
]);
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
    FORM.has(name) ||
    GROUP.has(name) ||
    EMBEDDED.has(name) ||
    COMMAND.has(name) ||
    PRESENT.has(name) ||
    GRAPHIC.has(name) ||
    HIDDEN.has(name) ||
    MATH.has(name) ||
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

function optionalFamily(name: string): 'li' | 'item' | 'cell' | 'row' | 'option' | null {
  switch (name) {
    case 'li':
      return 'li';
    case 'dt':
    case 'dd':
      return 'item';
    case 'td':
    case 'th':
      return 'cell';
    case 'tr':
      return 'row';
    case 'option':
    case 'optgroup':
      return 'option';
    default:
      return null;
  }
}

function siblingOpen(name: string, openName: string): boolean {
  const family = optionalFamily(name);
  switch (family) {
    case 'li':
      return openName === 'li';
    case 'item':
      return openName === 'dt' || openName === 'dd';
    case 'cell':
      return openName === 'td' || openName === 'th';
    case 'row':
      return openName === 'tr';
    case 'option':
      return openName === name;
    case null:
      return false;
    default: {
      const unexpected: never = family;
      return unexpected;
    }
  }
}

function parentClose(name: string, closeName: string): boolean {
  const family = optionalFamily(name);
  switch (family) {
    case 'li':
      return closeName === 'ul' || closeName === 'ol' || closeName === 'menu' || closeName === 'dir';
    case 'item':
      return closeName === 'dl';
    case 'cell':
      return (
        closeName === 'tr' ||
        closeName === 'table' ||
        closeName === 'thead' ||
        closeName === 'tbody' ||
        closeName === 'tfoot'
      );
    case 'row':
      return closeName === 'table' || closeName === 'thead' || closeName === 'tbody' || closeName === 'tfoot';
    case 'option':
      return closeName === 'select' || closeName === 'optgroup' || closeName === 'datalist';
    case null:
      return false;
    default: {
      const unexpected: never = family;
      return unexpected;
    }
  }
}

function entersNest(name: string, openName: string): boolean {
  const family = optionalFamily(name);
  switch (family) {
    case 'li':
      return openName === 'ul' || openName === 'ol' || openName === 'menu' || openName === 'dir';
    case 'cell':
    case 'row':
      return openName === 'table';
    case 'item':
      return openName === 'dl';
    case 'option':
      return openName === 'select';
    case null:
      return false;
    default: {
      const unexpected: never = family;
      return unexpected;
    }
  }
}

function elementAt(
  value: string,
  name: string,
  openEnd: number,
  cursor: number,
  depth: number,
  nest: number
): { element: HtmlElement | null; depth: number; nest: number; cursor: number } {
  const close = closingTag(value, cursor);
  if (close) {
    if (nest === 0 && (close.name === name || parentClose(name, close.name)) && depth === 1) {
      const end = close.name === name ? close.end : cursor;
      return { element: { name, innerStart: openEnd, innerEnd: cursor, end }, depth, nest, cursor };
    }
    const nextNest = entersNest(name, close.name) && nest > 0 ? nest - 1 : nest;
    const nextDepth = close.name === name && nest === 0 ? depth - 1 : depth;
    return { element: null, depth: nextDepth, nest: nextNest, cursor: close.end };
  }
  const open = readAngleTag(value, cursor);
  const openName = open && !open.closing ? open.name.toLowerCase() : '';
  if (open && nest === 0 && siblingOpen(name, openName)) {
    return { element: { name, innerStart: openEnd, innerEnd: cursor, end: cursor }, depth, nest, cursor };
  }
  const nextNest = open && !open.closing && !open.selfClosing && entersNest(name, openName) ? nest + 1 : nest;
  const same = open && !open.closing && !open.selfClosing && openName === name && nest === 0;
  const next = open && !open.closing ? open.end : cursor + 1;
  return {
    element: null,
    depth: same ? depth + 1 : depth,
    nest: nextNest,
    cursor: next > cursor ? next : cursor + 1,
  };
}

function elementBounds(value: string, name: string, openEnd: number): HtmlElement | null {
  let depth = 1;
  let nest = 0;
  let cursor = openEnd;
  while (cursor < value.length) {
    if (value[cursor] !== '<') {
      cursor += 1;
      continue;
    }
    const found = elementAt(value, name, openEnd, cursor, depth, nest);
    if (found.element) {
      return found.element;
    }
    depth = found.depth;
    nest = found.nest;
    cursor = found.cursor;
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
    if (open.selfClosing || !/[A-Z.]/.test(open.name)) {
      return null;
    }
    return elementBounds(value, name, open.end);
  }
  if (open.selfClosing || name === 'input' || VOID_HTML.has(name)) {
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
  const source = `${inner}</li>`;
  const items: ListedItem[] = [];
  let index = 0;
  while (index < source.length) {
    const element = source[index] === '<' ? readSimpleElement(source, index) : null;
    if (element?.name === 'li') {
      items.push({
        body: source.slice(element.innerStart, element.innerEnd),
        value: parsedAttribute(openTagBefore(source, element.innerStart), 'value'),
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
    .replace(htmlBreakPattern(), ' ')
    .replace(/[ \t]*\n[ \t]*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return blockWrap(`${'#'.repeat(level)} ${text}`);
}

function renderQuote(inner: string): string {
  const text = convertHtml(inner).trim().replace(/\n{3,}/g, '\n\n');
  if (text.length === 0) {
    return '';
  }
  const quoted = text
    .split('\n')
    .map((line) => (line.length === 0 ? '>' : `> ${line}`))
    .join('\n');
  return blockWrap(quoted);
}

function codeFenceLanguage(openTag: string): string {
  const match = /(?:^|\s)language-([\w+-]+)/.exec(attribute(openTag, 'class'));
  return match?.[1] ?? '';
}

function unwrapPreCode(inner: string): { text: string; language: string } {
  const trimmed = inner.replace(/^\n/, '').replace(/\n$/, '');
  const start = trimmed.search(/\S/);
  if (start < 0) {
    return { text: trimmed, language: '' };
  }
  const open = readAngleTag(trimmed, start);
  if (!open || open.closing || open.name.toLowerCase() !== 'code') {
    return { text: trimmed, language: '' };
  }
  const bounds = elementBounds(trimmed, 'code', open.end);
  if (!bounds || trimmed.slice(bounds.end).trim().length > 0) {
    return { text: trimmed, language: '' };
  }
  const text = trimmed.slice(bounds.innerStart, bounds.innerEnd).replace(/^\n/, '').replace(/\n$/, '');
  return { text, language: codeFenceLanguage(trimmed.slice(start, open.end)) };
}

function renderPre(inner: string): string {
  const sample = unwrapPreCode(inner);
  return `\n\n\`\`\`${sample.language}\n${sample.text}\n\`\`\`\n\n`;
}

interface TableCell {
  readonly text: string;
  readonly align: TableAlign;
  readonly colspan: number;
  readonly rowspan: number;
}

const MAX_COLSPAN = 50;

function spanCount(openTag: string, name: string): number {
  const parsed = parsedAttribute(openTag, name);
  if (parsed === null || parsed < 1) {
    return 1;
  }
  return Math.min(parsed, MAX_COLSPAN);
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

function splitUnescapedPipes(row: string): string[] {
  const cells: string[] = [];
  let current = '';
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index] ?? '';
    if (char === '\\' && row[index + 1] === '|') {
      current += '|';
      index += 1;
      continue;
    }
    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function plainTableLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|') || trimmed.length < 2) {
    return null;
  }
  const cells = splitUnescapedPipes(trimmed.slice(1, -1));
  if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
    return '';
  }
  return cells.filter((cell) => cell.length > 0 && !/^:?-{3,}:?$/.test(cell)).join(' ');
}

function flattenNestedTables(text: string): string {
  return text
    .split('\n')
    .map((line) => plainTableLine(line) ?? line)
    .join('\n');
}

function cellText(inner: string): string {
  return flattenNestedTables(convertHtml(inner))
    .replace(htmlBreakPattern(), ' ')
    .replace(/\s+/g, ' ')
    .replaceAll('|', '\\|')
    .trim();
}

function rowCells(value: string): TableCell[] {
  const source = `${value}</tr>`;
  const cells: TableCell[] = [];
  let index = 0;
  while (index < source.length) {
    const element = source[index] === '<' ? readSimpleElement(source, index) : null;
    if (element && (element.name === 'td' || element.name === 'th')) {
      const openAt = source.lastIndexOf('<', Math.max(0, element.innerStart - 1));
      const openTag = openAt === -1 ? '' : source.slice(openAt, element.innerStart);
      cells.push({
        text: cellText(source.slice(element.innerStart, element.innerEnd)),
        align: cellAlign(openTag),
        colspan: spanCount(openTag, 'colspan'),
        rowspan: spanCount(openTag, 'rowspan'),
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
  const source = `${value}</table>`;
  const captions: string[] = [];
  const head: TableCell[][] = [];
  const body: TableCell[][] = [];
  const foot: TableCell[][] = [];
  let index = 0;
  while (index < source.length) {
    const element = source[index] === '<' ? readSimpleElement(source, index) : null;
    if (!element) {
      index += 1;
      continue;
    }
    const inner = source.slice(element.innerStart, element.innerEnd);
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

function blankCell(): TableCell {
  return { text: '', align: 'left', colspan: 1, rowspan: 1 };
}

function placeSpan(covered: number[], column: number, colspan: number, rowspan: number): void {
  for (let offset = 0; offset < colspan; offset += 1) {
    covered[column + offset] = rowspan - 1;
  }
}

function takeCovered(covered: number[], column: number): boolean {
  const remaining = covered[column] ?? 0;
  if (remaining <= 0) {
    return false;
  }
  covered[column] = remaining - 1;
  return true;
}

function expandRow(row: readonly TableCell[], covered: number[]): TableCell[] {
  const line: TableCell[] = [];
  let column = 0;
  let source = 0;
  while (source < row.length || covered.some((count) => count > 0)) {
    if (takeCovered(covered, column)) {
      line.push(blankCell());
      column += 1;
      continue;
    }
    const cell = row[source];
    if (!cell) {
      if (!covered.slice(column).some((count) => count > 0)) {
        break;
      }
      line.push(blankCell());
      column += 1;
      continue;
    }
    source += 1;
    const colspan = cell.colspan;
    line.push({ ...cell, colspan: 1, rowspan: 1 });
    for (let extra = 1; extra < colspan; extra += 1) {
      line.push(blankCell());
    }
    placeSpan(covered, column, colspan, cell.rowspan);
    column += colspan;
  }
  return line;
}

function expandTableRows(rows: readonly (readonly TableCell[])[]): TableCell[][] {
  const covered: number[] = [];
  return rows.map((row) => expandRow(row, covered));
}

function markdownTable(rows: readonly (readonly TableCell[])[]): string {
  const filled = expandTableRows(rows).filter((row) => row.some((cell) => cell.text.length > 0));
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
  const source = `${inner}</dl>`;
  const parts: string[] = [];
  let index = 0;
  while (index < source.length) {
    const element = source[index] === '<' ? readSimpleElement(source, index) : null;
    if (element?.name === 'dt') {
      const term = cellText(source.slice(element.innerStart, element.innerEnd));
      if (term.length > 0) {
        parts.push(boldLabel(term));
      }
      index = element.end;
      continue;
    }
    if (element?.name === 'dd') {
      const body = convertHtml(source.slice(element.innerStart, element.innerEnd)).trim();
      if (body.length > 0) {
        parts.push(body);
      }
      index = element.end;
      continue;
    }
    if (element) {
      const nested = renderDefinitions(source.slice(element.innerStart, element.innerEnd)).trim();
      if (nested.length > 0) {
        parts.push(nested);
      }
      index = element.end;
      continue;
    }
    index += 1;
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
  const heading = boldLabel(label);
  const parts = [heading, body].filter((part) => part.length > 0);
  return blockWrap(parts.join('\n\n'));
}

function renderInput(value: string, element: HtmlElement): string {
  const openTag = openTagBefore(value, element.innerStart);
  const type = attribute(openTag, 'type').trim().toLowerCase();
  if (type === 'hidden' || type === 'file' || type === 'image' || type === 'radio') {
    return '';
  }
  if (type !== 'checkbox') {
    const entered = attribute(openTag, 'value').trim();
    return entered.length > 0 ? entered : attribute(openTag, 'placeholder').trim();
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

function boldLabel(text: string): string {
  if (text.length === 0 || text.includes('*') || text.includes('_') || text.includes('<')) {
    return text;
  }
  return `**${text}**`;
}

function visibleAddress(href: string): string {
  const destination = href.trim();
  if (destination.length === 0 || /^(?:javascript|data|file):/i.test(destination)) {
    return '';
  }
  return destination;
}

function linkedText(label: string, href: string): string {
  const destination = visibleAddress(href);
  const text = label.trim();
  if (destination.length === 0) {
    return text;
  }
  if (text.length === 0 || text.includes('[') || text.includes(']') || /[\s<>]/.test(destination)) {
    return text.length === 0 ? destination : text;
  }
  return `[${text}](${destination})`;
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

function markedChoice(label: string, selected: boolean): string {
  if (!selected || label.includes('*') || label.includes('_')) {
    return label;
  }
  return `**${label}**`;
}

function renderChoices(inner: string): string[] {
  const source = `${inner}</select>`;
  const choices: string[] = [];
  let index = 0;
  while (index < source.length) {
    const element = source[index] === '<' ? readSimpleElement(source, index) : null;
    if (!element) {
      index += 1;
      continue;
    }
    if (element.name === 'option') {
      const text = cellText(source.slice(element.innerStart, element.innerEnd));
      const openTag = openTagBefore(source, element.innerStart);
      const label = text || attribute(openTag, 'label').trim() || attribute(openTag, 'value').trim();
      if (label.length > 0) {
        choices.push(markedChoice(label, /\bselected\b/i.test(openTag)));
      }
    } else if (element.name === 'optgroup') {
      choices.push(...renderChoices(source.slice(element.innerStart, element.innerEnd)));
    }
    index = element.end;
  }
  return choices;
}

function renderGauge(value: string, element: HtmlElement, inner: string): string {
  const text = convertHtml(inner).trim();
  if (text.length > 0) {
    return text;
  }
  const openTag = openTagBefore(value, element.innerStart);
  const current = attribute(openTag, 'value').trim();
  const max = attribute(openTag, 'max').trim();
  if (current.length === 0) {
    return '';
  }
  return element.name === 'progress' && max.length > 0 ? `${current}/${max}` : current;
}

function renderButton(value: string, element: HtmlElement, inner: string): string {
  const text = convertHtml(inner).trim();
  if (text.length > 0) {
    return text;
  }
  return attribute(openTagBefore(value, element.innerStart), 'value').trim();
}

function renderArea(value: string, element: HtmlElement): string {
  const openTag = openTagBefore(value, element.innerStart);
  return linkedText(attribute(openTag, 'alt'), attribute(openTag, 'href'));
}

function renderData(value: string, element: HtmlElement, inner: string): string {
  const text = cellText(inner);
  const raw = attribute(openTagBefore(value, element.innerStart), 'value').trim();
  if (raw.length === 0 || raw === text) {
    return text;
  }
  return text.length === 0 ? raw : `${text} (${raw})`;
}

function renderMediaFallback(value: string, element: HtmlElement, inner: string): string {
  const text = convertHtml(inner).trim();
  if (text.length > 0) {
    return text;
  }
  return visibleAddress(attribute(openTagBefore(value, element.innerStart), 'src'));
}

function renderEmbedded(element: HtmlElement, value: string, inner: string): string | null {
  switch (element.name) {
    case 'source':
    case 'track':
    case 'datalist':
      return '';
    case 'area':
      return renderArea(value, element);
    case 'video':
    case 'audio':
      return renderMediaFallback(value, element, inner);
    case 'data':
      return renderData(value, element, inner);
    case 'legend':
      return blockWrap(boldLabel(cellText(inner)));
    case 'bdo':
      return convertHtml(inner);
    default:
      return null;
  }
}

function renderForm(element: HtmlElement, value: string, inner: string): string | null {
  switch (element.name) {
    case 'textarea':
    case 'output':
    case 'label':
      return convertHtml(inner);
    case 'button':
      return renderButton(value, element, inner);
    case 'select':
    case 'optgroup':
      return renderChoices(inner).join(', ');
    case 'option':
      return cellText(inner);
    case 'progress':
    case 'meter':
      return renderGauge(value, element, inner);
    default:
      return null;
  }
}

function graphicText(inner: string): string {
  let result = '';
  let index = 0;
  while (index < inner.length) {
    const element = inner[index] === '<' ? readSimpleElement(inner, index) : null;
    if (!element) {
      result += inner[index] ?? '';
      index += 1;
      continue;
    }
    const piece = renderElement(element, inner).trim();
    if (piece.length > 0) {
      const gap = result.length > 0 && !/\s$/.test(result) ? ' ' : '';
      result += `${gap}${piece}`;
    }
    index = element.end;
  }
  return result.replace(/\s+/g, ' ').trim();
}

function mathParts(inner: string): string[] {
  const parts: string[] = [];
  let index = 0;
  while (index < inner.length) {
    const element = inner[index] === '<' ? readSimpleElement(inner, index) : null;
    if (!element) {
      index += 1;
      continue;
    }
    const piece = renderElement(element, inner).trim();
    if (piece.length > 0) {
      parts.push(piece);
    }
    index = element.end;
  }
  return parts;
}

function renderMath(name: string, inner: string): string | null {
  if (!MATH.has(name)) {
    return null;
  }
  if (MATH_TOKEN.has(name)) {
    return cellText(inner);
  }
  if (name === 'annotation' || name === 'annotation-xml' || name === 'mspace') {
    return '';
  }
  const parts = mathParts(inner);
  switch (name) {
    case 'mfrac':
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts.join(' ');
    case 'msup':
      return parts.length >= 2 ? `${parts[0]}^${parts[1]}^` : parts.join(' ');
    case 'msub':
      return parts.length >= 2 ? `${parts[0]}~${parts[1]}~` : parts.join(' ');
    case 'msubsup':
      return parts.length >= 3 ? `${parts[0]}~${parts[1]}~^${parts[2]}^` : parts.join(' ');
    case 'msqrt':
      return `√${parts.join(' ')}`;
    case 'mroot':
      return parts.length >= 2 ? `${parts[1]}√${parts[0]}` : parts.join(' ');
    default:
      return parts.join(' ');
  }
}

function renderGraphic(name: string, inner: string): string | null {
  if (HIDDEN.has(name)) {
    return '';
  }
  if (name === 'noscript' || name === 'foreignobject') {
    return convertHtml(inner);
  }
  if (GRAPHIC.has(name)) {
    return graphicText(inner);
  }
  return null;
}

function renderPresentational(element: HtmlElement, value: string, inner: string): string | null {
  switch (element.name) {
    case 'font':
    case 'big':
    case 'marquee':
    case 'nobr':
      return convertHtml(inner);
    case 'tt':
      return renderKbd(inner);
    case 'acronym':
      return renderAbbr(value, element);
    default:
      return null;
  }
}

function firstPhrase(element: HtmlElement, value: string, inner: string): string | null {
  return (
    renderMath(element.name, inner) ??
    renderGraphic(element.name, inner) ??
    renderPresentational(element, value, inner) ??
    renderEmbedded(element, value, inner) ??
    renderForm(element, value, inner)
  );
}

function renderPhrase(element: HtmlElement, value: string, inner: string): string | null {
  const first = firstPhrase(element, value, inner);
  if (first !== null) {
    return first;
  }
  switch (element.name) {
    case 'dl':
      return renderDefinitions(inner);
    case 'dt':
      return blockWrap(boldLabel(cellText(inner)));
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

function renderCommandList(inner: string): string {
  const listed = renderList(inner, false);
  return listed.trim().length > 0 ? listed : blockWrap(convertHtml(inner));
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
    case 'menu':
    case 'dir':
      return renderCommandList(inner);
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
      return simpleName(element.name) ? blockWrap(convertHtml(inner)) : convertHtml(inner);
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

/** A line break, including one that carries attributes. */
export function htmlBreakPattern(): RegExp {
  return /<br\b(?:\s[^<>]*?)?\/?>/gi;
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
