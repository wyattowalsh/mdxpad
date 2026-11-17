import { writeFile } from 'node:fs/promises';

import {
  AlignmentType,
  BorderStyle,
  Bookmark,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  InternalHyperlink,
  Math,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from 'docx';

import { allocateHeadingSlug, headingAnchor, parseAtxHeading } from '@shared/lib/markdown-heading';
import { prepareMarkdownSource } from '@shared/lib/markdown-math';

import { highlightCodeHtml } from './markdown-code';
import { imagePixels, inlineLocalImages, type ImageKind } from './export-image';

import { mathComponents, splitDocxPieces } from './docx-math';
import { isThematicBreak } from './markdown-break';
import { closesFence, fenceLanguage, openingFence } from './markdown-fence';
import { setextLevel } from './markdown-setext';
import { expandLinkReferences } from './markdown-reference';
import { renderedSegments } from './markdown-marks';
import { readSourceLine, type SourceLine } from './markdown-paragraph';
import { isTableRow, parseMarkdownTable, type TableAlign } from './markdown-table';
import { isLazyQuoteLine, quoteBody, quoteChunks } from './markdown-quote';
import { expandAutolinkText, protectAutolinks } from './markdown-autolink';
import { protectEscapes, restoreEscapes } from './markdown-escape';
import { decodeHtmlEntities } from './markdown-entity';
import { MARKDOWN_LINK_INSIDE, linkDestination, linkTitle } from './markdown-link';
import {
  isListContinuation,
  listContentColumn,
  parseListItem,
  type MarkdownListItem,
} from './markdown-list';
import {
  dedentToColumn,
  listFenceOnMarker,
  listIndentedCode,
  listThematicBreak,
  openListFence,
  readListFenceLine,
  readListQuoteLine,
  readOpenListQuote,
  type ListFenceState,
} from './markdown-list-fence';
import { splitTaskItem } from './markdown-task';
import type { Exporter, ExportOptions, ExportResult } from './types';

type HeadingLevelValue =
  | typeof HeadingLevel.HEADING_1
  | typeof HeadingLevel.HEADING_2
  | typeof HeadingLevel.HEADING_3
  | typeof HeadingLevel.HEADING_4
  | typeof HeadingLevel.HEADING_5
  | typeof HeadingLevel.HEADING_6;

const HEADING_LEVEL_MAP: Record<number, HeadingLevelValue> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

function getHeadingLevel(level: number): HeadingLevelValue {
  return HEADING_LEVEL_MAP[level] ?? HeadingLevel.HEADING_6;
}

function pushImage(segments: InlineSegment[], alt: string, src: string): void {
  const start = segments.length;
  attachTarget(segments, alt, linkDestination(src), 'image');
  const title = linkTitle(src);
  if (!title) {
    return;
  }
  for (let index = start; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment?.image) {
      segment.title = title;
    }
  }
}

function attachTarget(
  segments: InlineSegment[],
  label: string,
  target: string,
  kind: 'link' | 'image'
): void {
  const parts = label.length > 0 ? parseInlineFormatting(label) : [{ text: target }];
  for (const segment of parts) {
    const text = segment.text.length > 0 ? segment.text : target;
    segments.push(
      kind === 'link' ? { ...segment, text, link: target } : { ...segment, text, image: target }
    );
  }
}

function emphasize(
  segments: InlineSegment[],
  text: string,
  marks: { readonly bold?: boolean; readonly italic?: boolean; readonly strike?: boolean }
): void {
  for (const segment of parseInlineFormatting(text)) {
    segments.push({
      ...segment,
      ...(segment.bold === true || marks.bold === true ? { bold: true } : {}),
      ...(segment.italic === true || marks.italic === true ? { italic: true } : {}),
      ...(segment.strike === true || marks.strike === true ? { strike: true } : {}),
    });
  }
}

interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: string;
  image?: string;
  title?: string;
  strike?: boolean;
}

const INLINE_PATTERN = new RegExp(
  '(\\*\\*\\*(.+?)\\*\\*\\*|(?<![\\w])___(.+?)___(?![\\w])|\\*\\*(.+?)\\*\\*|(?<![\\w])__(.+?)__(?![\\w])|`([^`]+)`|\\*([^*]*(?:\\*\\*[^*]*)*)\\*|(?<![\\w])_([^_]*(?:__[^_]*)*)_(?![\\w])|\\[([^\\]]+)\\]\\((' +
    MARKDOWN_LINK_INSIDE +
    ')\\)|~~(.+?)~~)',
  'g'
);

export function parseInlineFormatting(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const regex = new RegExp(INLINE_PATTERN.source, 'g');
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    const matchIndex = match.index;
    const image =
      match[9] !== undefined &&
      match[10] !== undefined &&
      matchIndex > 0 &&
      text[matchIndex - 1] === '!';
    const prefixEnd = image ? matchIndex - 1 : matchIndex;
    if (prefixEnd > lastIndex) {
      segments.push({ text: text.slice(lastIndex, prefixEnd) });
    }

    if (image) {
      const alt = match[9] ?? '';
      const src = match[10] ?? '';
      pushImage(segments, alt, src);
    } else if (match[2] !== undefined) {
      emphasize(segments, match[2], { bold: true, italic: true });
    } else if (match[3] !== undefined) {
      emphasize(segments, match[3], { bold: true, italic: true });
    } else if (match[4] !== undefined) {
      emphasize(segments, match[4], { bold: true });
    } else if (match[5] !== undefined) {
      emphasize(segments, match[5], { bold: true });
    } else if (match[6] !== undefined) {
      segments.push({ text: match[6], code: true });
    } else if (match[7] !== undefined) {
      emphasize(segments, match[7], { italic: true });
    } else if (match[8] !== undefined) {
      emphasize(segments, match[8], { italic: true });
    } else if (match[9] !== undefined && match[10] !== undefined) {
      attachTarget(segments, match[9], linkDestination(match[10]), 'link');
    } else if (match[11] !== undefined) {
      emphasize(segments, match[11], { strike: true });
    }

    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ text });
  }

  return segments;
}

function createParagraphChildren(
  text: string
): (TextRun | ExternalHyperlink | InternalHyperlink | ImageRun | Math)[] {
  const children: (TextRun | ExternalHyperlink | InternalHyperlink | ImageRun | Math)[] = [];
  for (const piece of splitDocxPieces(text)) {
    if (piece.kind === 'math') {
      children.push(new Math({ children: mathComponents(piece.tex) }));
      continue;
    }
    const escaped = protectEscapes(piece.text);
    const protectedLinks = protectAutolinks(escaped.text);
    const segments = parseInlineFormatting(protectedLinks.text).flatMap((segment) => {
      if (segment.code || segment.link || segment.image) {
        return [segment];
      }
      return expandAutolinkText(segment.text, protectedLinks.links).map((part) => ({
        ...segment,
        text: restoreEscapes(part.text, escaped.chars, (char) => char),
        ...(part.href ? { link: part.href } : {}),
      }));
    });
    children.push(...createTextRuns(segments));
  }
  return children.length > 0 ? children : [new TextRun('')];
}

function styledRun(segment: InlineSegment, text: string, style?: string): TextRun {
  return new TextRun({
    text: segment.code ? text : decodeHtmlEntities(text),
    ...(style ? { style } : {}),
    ...(segment.bold ? { bold: true } : {}),
    ...(segment.italic ? { italics: true } : {}),
    ...(segment.strike ? { strike: true } : {}),
    ...(segment.code ? { font: { name: 'Courier New' } } : {}),
  });
}

function imageKindFromMime(raw: string): ImageKind | null {
  if (raw === 'png' || raw === 'gif' || raw === 'bmp') {
    return raw;
  }
  if (raw === 'jpg' || raw === 'jpeg') {
    return 'jpg';
  }
  return null;
}

function docxImage(src: string, alt: string, title = ''): ImageRun | null {
  const match = /^data:image\/(png|jpe?g|gif|bmp);base64,([A-Za-z0-9+/=]+)$/i.exec(src);
  const encoded = match?.[2];
  const kind = imageKindFromMime(match?.[1]?.toLowerCase() ?? '');
  if (!encoded || !kind) {
    return null;
  }
  const data = Buffer.from(encoded, 'base64');
  return new ImageRun({
    type: kind,
    data,
    transformation: imagePixels(data, kind),
    altText: {
      name: alt.length > 0 ? alt : 'image',
      description: title.length > 0 ? title : alt,
    },
  });
}

function createTextRuns(
  segments: InlineSegment[]
): (TextRun | ExternalHyperlink | InternalHyperlink | ImageRun)[] {
  return segments.map((segment) => {
    if (segment.image) {
      const picture = docxImage(
        decodeHtmlEntities(segment.image),
        segment.text,
        segment.title ?? ''
      );
      if (picture) {
        return picture;
      }
      return new ExternalHyperlink({
        children: [styledRun(segment, segment.text || segment.image, 'Hyperlink')],
        link: decodeHtmlEntities(segment.image),
      });
    }
    if (segment.link) {
      const anchor = headingAnchor(decodeHtmlEntities(segment.link));
      if (anchor) {
        return new InternalHyperlink({
          children: [styledRun(segment, segment.text, 'Hyperlink')],
          anchor,
        });
      }
      return new ExternalHyperlink({
        children: [styledRun(segment, segment.text, 'Hyperlink')],
        link: decodeHtmlEntities(segment.link),
      });
    }
    return styledRun(segment, segment.text);
  });
}

const CODE_COLORS: Record<string, string> = {
  'hljs-keyword': '7C3AED',
  'hljs-string': '047857',
  'hljs-attr': '047857',
  'hljs-number': 'B45309',
  'hljs-literal': 'B45309',
  'hljs-comment': '6B7280',
  'hljs-title': '1D4ED8',
  'hljs-section': '1D4ED8',
};

function highlightedRuns(html: string): TextRun[] {
  const runs: TextRun[] = [];
  const colors: string[] = [];
  let text = '';
  const flush = (): void => {
    if (text.length === 0) {
      return;
    }
    const color = colors[colors.length - 1];
    runs.push(
      new TextRun({
        text: decodeHtmlEntities(text),
        font: { name: 'Courier New' },
        size: 20,
        ...(color ? { color } : {}),
      })
    );
    text = '';
  };
  for (const match of html.matchAll(/<span class="([^"]+)">|<\/span>|[^<]+/g)) {
    const part = match[0];
    if (part.startsWith('<span')) {
      flush();
      const names = (match[1] ?? '').split(/\s+/);
      const color = names.map((name) => CODE_COLORS[name]).find((value) => value !== undefined);
      colors.push(color ?? colors[colors.length - 1] ?? '');
      continue;
    }
    if (part === '</span>') {
      flush();
      colors.pop();
      continue;
    }
    text += part;
  }
  flush();
  return runs;
}

function createCodeBlockParagraph(codeLines: string[], language = ''): Paragraph {
  const source = codeLines.join('\n');
  const highlighted = highlightCodeHtml(language, source);
  const runs =
    highlighted && highlighted.length > 0
      ? highlightedRuns(highlighted)
      : [new TextRun({ text: source, font: { name: 'Courier New' }, size: 20 })];
  return new Paragraph({
    children: runs,
    spacing: { before: 120, after: 120 },
  });
}

function runsWithBreaks(
  text: string
): (TextRun | ExternalHyperlink | InternalHyperlink | ImageRun | Math)[] {
  const lines = text.split('\n').map((line, index, all) => ({
    text: line,
    hardBreak: index < all.length - 1,
  }));
  const children: (TextRun | ExternalHyperlink | InternalHyperlink | ImageRun | Math)[] = [];
  renderedSegments(lines).forEach((piece, index) => {
    if (index > 0) {
      children.push(new TextRun({ break: 1 }));
    }
    children.push(...createParagraphChildren(piece));
  });
  return children;
}

function listItemChildren(
  text: string
): (TextRun | ExternalHyperlink | InternalHyperlink | ImageRun | Math)[] {
  const task = splitTaskItem(text);
  if (!task) {
    return runsWithBreaks(text);
  }
  const mark = new TextRun({ text: task.checked ? '☑ ' : '☐ ' });
  return [mark, ...runsWithBreaks(task.body)];
}

function bookmarkedHeading(level: number, text: string, slugs: Map<string, number>): Paragraph {
  return new Paragraph({
    heading: getHeadingLevel(level),
    children: [
      new Bookmark({
        id: allocateHeadingSlug(text, slugs),
        children: createParagraphChildren(text),
      }),
    ],
  });
}

function parseLineToParagraph(trimmed: string, slugs: Map<string, number>): Paragraph | undefined {
  const heading = parseAtxHeading(trimmed);
  if (heading) {
    return bookmarkedHeading(heading.depth, heading.text, slugs);
  }

  if (isThematicBreak(trimmed)) {
    return docxRuleParagraph();
  }

  return undefined;
}

function docxCellAlignment(
  align: TableAlign
): typeof AlignmentType.CENTER | typeof AlignmentType.RIGHT | undefined {
  switch (align) {
    case 'left':
      return undefined;
    case 'center':
      return AlignmentType.CENTER;
    case 'right':
      return AlignmentType.RIGHT;
    default: {
      const exhaustive: never = align;
      return exhaustive;
    }
  }
}

function docxCell(text: string, align: TableAlign): TableCell {
  const alignment = docxCellAlignment(align);
  return new TableCell({
    children: [
      new Paragraph({
        ...(alignment ? { alignment } : {}),
        children: createParagraphChildren(text),
      }),
    ],
  });
}

function flushDocxTable(blocks: (Paragraph | Table)[], tableLines: string[]): void {
  if (tableLines.length === 0) {
    return;
  }
  const lines = tableLines.splice(0, tableLines.length);
  const table = parseMarkdownTable(lines);
  if (!table) {
    for (const line of lines) {
      blocks.push(new Paragraph({ children: createParagraphChildren(line) }));
    }
    return;
  }
  const toRow = (cells: readonly string[]): TableRow =>
    new TableRow({
      children: cells.map((cell, index) => docxCell(cell, table.aligns[index] ?? 'left')),
    });
  blocks.push(new Table({ rows: [toRow(table.headers), ...table.rows.map((row) => toRow(row))] }));
}

function appendDocxQuoteList(
  blocks: (Paragraph | Table)[],
  lines: readonly string[],
  depth: number
): void {
  let current: MarkdownListItem | null = null;
  let hard = false;
  for (const line of lines) {
    if (line.trim().length === 0) {
      continue;
    }
    const item = parseListItem(line);
    if (item) {
      if (current) {
        blocks.push(listParagraph(current, depth));
      }
      current = item;
      hard = readSourceLine(line).hardBreak;
      continue;
    }
    if (!current) {
      continue;
    }
    const source = readSourceLine(line);
    const nextText: string = hard
      ? `${current.text}\n${source.text}`
      : `${current.text} ${source.text}`;
    current = {
      level: current.level,
      ordered: current.ordered,
      start: current.start,
      text: nextText,
    };
    hard = source.hardBreak;
  }
  if (current) {
    blocks.push(listParagraph(current, depth));
  }
}

function appendDocxQuoteLines(
  blocks: (Paragraph | Table)[],
  lines: readonly string[],
  depth: number
): void {
  for (const chunk of quoteChunks(lines)) {
    if (chunk.kind === 'nested') {
      appendDocxQuoteLines(blocks, chunk.lines, depth + 1);
      continue;
    }
    if (chunk.kind === 'table') {
      flushDocxTable(blocks, [...chunk.lines]);
      continue;
    }
    if (chunk.kind === 'code') {
      const [open, ...body] = chunk.lines;
      blocks.push(createCodeBlockParagraph(body, fenceLanguage(open ?? '')));
      continue;
    }
    if (chunk.kind === 'list') {
      appendDocxQuoteList(blocks, chunk.lines, depth);
      continue;
    }
    const sources = chunk.lines
      .map((line) => readSourceLine(line))
      .filter((line) => line.text.length > 0);
    if (sources.length > 0) {
      blocks.push(paragraphFromLines(sources, depth));
    }
  }
}

function flushDocxQuote(blocks: (Paragraph | Table)[], quoteLines: string[]): void {
  if (quoteLines.length === 0) {
    return;
  }
  appendDocxQuoteLines(blocks, quoteLines.splice(0, quoteLines.length), 1);
}

function takeDocxItemQuote(parse: DocxParse, line: string): boolean {
  if (parse.itemFence) {
    return false;
  }
  if (parse.itemQuote) {
    const text = readListQuoteLine(line, parse.listColumn ?? 2);
    if (text === null) {
      appendDocxQuoteLines(parse.blocks, parse.itemQuote, 1);
      parse.itemQuote = null;
      parse.listSealed = true;
      return false;
    }
    parse.itemQuote.push(text);
    return true;
  }
  if (parse.openListItem === null || parse.listColumn === null) {
    return false;
  }
  const opened = readOpenListQuote(line, parse.listColumn);
  if (opened === null) {
    return false;
  }
  parse.itemQuote = [opened];
  parse.listBreak = false;
  return true;
}

function closeDocxItemCode(parse: DocxParse): void {
  if (!parse.itemCode) {
    return;
  }
  while (parse.itemCode[parse.itemCode.length - 1] === '') {
    parse.itemCode.pop();
  }
  parse.blocks.push(createCodeBlockParagraph(parse.itemCode, ''));
  parse.itemCode = null;
  parse.listSealed = true;
  parse.listParagraphBreak = true;
  parse.tailOpen = false;
}

function docxRuleParagraph(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: 'auto' } },
    spacing: { before: 120, after: 120 },
  });
}

function takeDocxItemSetext(parse: DocxParse, line: string): boolean {
  if (
    parse.openListItem === null ||
    parse.listColumn === null ||
    parse.listBreak ||
    parse.listSealed ||
    parse.listParagraphBreak ||
    parse.tailOpen ||
    parse.itemFence ||
    parse.itemQuote ||
    parse.itemTable ||
    parse.itemMath ||
    parse.itemCode
  ) {
    return false;
  }
  const level = setextLevel(dedentToColumn(line, parse.listColumn));
  const text = parse.openListItem.text;
  if (level === null || text.length === 0) {
    return false;
  }
  parse.blocks.pop();
  parse.blocks.push(bookmarkedHeading(level, text, parse.slugCounts));
  parse.listSealed = true;
  parse.listParagraphBreak = true;
  parse.tailOpen = false;
  parse.listBreak = false;
  return true;
}

function takeDocxItemRule(parse: DocxParse, line: string): boolean {
  if (
    parse.itemFence ||
    parse.itemQuote ||
    parse.itemTable ||
    parse.itemMath ||
    parse.itemCode ||
    parse.openListItem === null ||
    parse.listColumn === null ||
    !listThematicBreak(line, parse.listColumn)
  ) {
    return false;
  }
  parse.blocks.push(docxRuleParagraph());
  parse.listSealed = true;
  parse.listParagraphBreak = true;
  parse.tailOpen = false;
  parse.listBreak = false;
  return true;
}

function takeDocxItemCode(parse: DocxParse, line: string): boolean {
  if (parse.itemFence || parse.itemQuote || parse.itemTable || parse.itemMath) {
    return false;
  }
  const column = parse.listColumn ?? 2;
  if (parse.itemCode) {
    if (line.trim().length === 0) {
      parse.itemCode.push('');
      return true;
    }
    const body = listIndentedCode(line, column);
    if (body !== null) {
      parse.itemCode.push(body);
      return true;
    }
    closeDocxItemCode(parse);
    return false;
  }
  if (parse.openListItem === null || parse.listColumn === null) {
    return false;
  }
  const opened = listIndentedCode(line, column);
  if (opened === null) {
    return false;
  }
  parse.itemCode = [opened];
  parse.listBreak = false;
  return true;
}

function takeDocxItemMath(parse: DocxParse, line: string): boolean {
  if (parse.itemFence || parse.itemQuote || parse.itemTable) {
    return false;
  }
  const column = parse.listColumn ?? 2;
  if (parse.itemMath) {
    if (line.trim() === '$$') {
      pushDisplayMath(parse.blocks, parse.itemMath);
      parse.itemMath = null;
      parse.listSealed = true;
      return true;
    }
    parse.itemMath.push(dedentToColumn(line, column));
    return true;
  }
  if (parse.openListItem === null || parse.listColumn === null || line.trim() !== '$$') {
    return false;
  }
  if (!isListContinuation(line, column)) {
    return false;
  }
  parse.itemMath = [];
  parse.listBreak = false;
  return true;
}

function takeDocxItemTable(parse: DocxParse, line: string): boolean {
  if (parse.itemFence || parse.itemQuote) {
    return false;
  }
  const column = parse.listColumn ?? 2;
  if (parse.itemTable) {
    if (isListContinuation(line, column) && isTableRow(line.trim())) {
      parse.itemTable.push(line.trim());
      return true;
    }
    flushDocxTable(parse.blocks, parse.itemTable);
    parse.itemTable = null;
    parse.listSealed = true;
    return false;
  }
  if (parse.openListItem === null || parse.listColumn === null) {
    return false;
  }
  if (!isListContinuation(line, column) || !isTableRow(line.trim())) {
    return false;
  }
  parse.itemTable = [line.trim()];
  parse.listBreak = false;
  return true;
}

function takeDocxQuote(blocks: (Paragraph | Table)[], line: string, quoteLines: string[]): boolean {
  const body = quoteBody(line);
  if (body !== null) {
    quoteLines.push(body);
    return true;
  }
  if (quoteLines.length > 0 && isLazyQuoteLine(line)) {
    quoteLines.push(line);
    return true;
  }
  if (quoteLines.length > 0) {
    flushDocxQuote(blocks, quoteLines);
  }
  return false;
}

function takeDocxTable(blocks: (Paragraph | Table)[], line: string, tableLines: string[]): boolean {
  if (isTableRow(line.trim())) {
    tableLines.push(line.trim());
    return true;
  }
  if (tableLines.length > 0) {
    flushDocxTable(blocks, tableLines);
  }
  return false;
}

function pushDisplayMath(paragraphs: (Paragraph | Table)[], lines: readonly string[]): void {
  paragraphs.push(
    new Paragraph({ children: [new Math({ children: mathComponents(lines.join('\n')) })] })
  );
}

function takeDisplayLine(
  paragraphs: (Paragraph | Table)[],
  line: string,
  displayLines: string[] | null
): string[] | null | false {
  const trimmed = line.trim();
  if (trimmed !== '$$' && displayLines === null) {
    return false;
  }
  if (trimmed === '$$' && displayLines) {
    pushDisplayMath(paragraphs, displayLines);
    return null;
  }
  if (trimmed === '$$') {
    return [];
  }
  displayLines?.push(line);
  return displayLines;
}

interface DocxListFrame {
  readonly level: number;
  column: number;
  item: MarkdownListItem;
}

interface DocxParse {
  blocks: (Paragraph | Table)[];
  pending: SourceLine[];
  displayLines: string[] | null;
  tableLines: string[];
  quoteLines: string[];
  listStack: DocxListFrame[];
  openListItem: MarkdownListItem | null;
  listBreak: boolean;
  listHardBreak: boolean;
  listColumn: number | null;
  listSealed: boolean;
  itemFence: ListFenceState | null;
  itemQuote: string[] | null;
  itemTable: string[] | null;
  itemMath: string[] | null;
  itemCode: string[] | null;
  listParagraphBreak: boolean;
  tailText: string | null;
  tailHard: boolean;
  tailOpen: boolean;
  slugCounts: Map<string, number>;
}

function paragraphFromLines(lines: readonly SourceLine[], quoteDepth = 0): Paragraph {
  const children: (TextRun | ExternalHyperlink | InternalHyperlink | ImageRun | Math)[] = [];
  renderedSegments(lines).forEach((text, index) => {
    if (index > 0) {
      children.push(new TextRun({ break: 1 }));
    }
    children.push(...createParagraphChildren(text));
  });
  if (quoteDepth > 0) {
    return new Paragraph({ children, indent: { left: 720 * quoteDepth } });
  }
  return new Paragraph({ children });
}

function flushPendingParagraph(parse: DocxParse): void {
  if (parse.pending.length === 0) {
    return;
  }
  const lines = parse.pending.splice(0, parse.pending.length);
  parse.blocks.push(paragraphFromLines(lines));
}

function listParagraph(item: MarkdownListItem, quoteDepth = 0): Paragraph {
  const children = listItemChildren(item.text);
  const indent = quoteDepth > 0 ? { left: 720 * quoteDepth } : undefined;
  if (item.ordered && item.start > 1) {
    return new Paragraph({
      indent: { left: 720 * (item.level + 1) + 720 * quoteDepth, hanging: 360 },
      children: [new TextRun({ text: `${item.start}. ` }), ...children],
    });
  }
  if (item.ordered) {
    return new Paragraph({
      numbering: { reference: 'default-numbering', level: item.level },
      ...(indent ? { indent } : {}),
      children,
    });
  }
  return new Paragraph({ bullet: { level: item.level }, ...(indent ? { indent } : {}), children });
}

function takeDocxSetext(parse: DocxParse, line: string): boolean {
  const level = setextLevel(line);
  if (level === null || parse.pending.length === 0) {
    return false;
  }
  const text = parse.pending.map((item) => item.text).join(' ');
  parse.pending.length = 0;
  parse.blocks.push(bookmarkedHeading(level, text, parse.slugCounts));
  return true;
}

function resetDocxItem(parse: DocxParse, fence: ReturnType<typeof listFenceOnMarker>): void {
  parse.itemFence = fence
    ? { marker: fence.marker, language: fence.language, indent: fence.indent, lines: [] }
    : null;
  parse.itemQuote = null;
  parse.itemTable = null;
  parse.itemMath = null;
  parse.itemCode = null;
  parse.listParagraphBreak = false;
  parse.tailText = null;
  parse.tailHard = false;
  parse.tailOpen = false;
}

function rememberDocxListItem(parse: DocxParse, item: MarkdownListItem, column: number): void {
  while (parse.listStack.length > 0) {
    const top = parse.listStack[parse.listStack.length - 1];
    if (!top || top.level < item.level) {
      break;
    }
    parse.listStack.pop();
  }
  parse.listStack.push({ level: item.level, column, item });
}

function plainLazyListLine(line: string): boolean {
  const text = readSourceLine(line).text;
  return (
    text.length > 0 &&
    parseListItem(line) === null &&
    parseAtxHeading(text) === null &&
    !isThematicBreak(text) &&
    openingFence(line) === null &&
    quoteBody(line) === null &&
    !isTableRow(text)
  );
}

function docxListDepth(parse: DocxParse, line: string): number {
  const spaces = /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
  let depth = parse.listStack.length - 1;
  while (depth >= 0 && spaces < (parse.listStack[depth]?.column ?? 0)) {
    depth -= 1;
  }
  return depth;
}

function adoptDocxAncestor(parse: DocxParse, line: string): boolean {
  if (!plainLazyListLine(line)) {
    return false;
  }
  const depth = docxListDepth(parse, line);
  const frame = depth < 0 ? undefined : parse.listStack[depth];
  if (!frame) {
    return false;
  }
  parse.listStack.length = depth + 1;
  parse.openListItem = frame.item;
  parse.listColumn = frame.column;
  parse.listBreak = false;
  parse.listSealed = false;
  const source = readSourceLine(line);
  parse.blocks.push(
    new Paragraph({
      indent: { left: 720 * (frame.level + 1) },
      children: createParagraphChildren(source.text),
    })
  );
  parse.tailText = source.text;
  parse.tailHard = source.hardBreak;
  parse.tailOpen = true;
  parse.listParagraphBreak = false;
  return true;
}

function takeDocxAtxItem(parse: DocxParse, item: MarkdownListItem, column: number): boolean {
  const atx = parseAtxHeading(item.text);
  if (!atx) {
    return false;
  }
  parse.openListItem = { ...item, text: '' };
  parse.listColumn = column;
  parse.listBreak = false;
  rememberDocxListItem(parse, parse.openListItem, column);
  parse.listHardBreak = false;
  resetDocxItem(parse, null);
  parse.listSealed = true;
  parse.listParagraphBreak = true;
  parse.blocks.push(bookmarkedHeading(atx.depth, atx.text, parse.slugCounts));
  return true;
}

function takeDocxList(
  parse: DocxParse,
  line: string,
  openListItem: MarkdownListItem | null
): boolean {
  const source = readSourceLine(line);
  const item = source.text.length > 0 && !isThematicBreak(source.text) ? parseListItem(line) : null;
  if (item) {
    flushPendingParagraph(parse);
    const column = listContentColumn(line) ?? 2;
    if (takeDocxAtxItem(parse, item, column)) {
      return true;
    }
    const fence = listFenceOnMarker(line, column);
    const shown = fence ? { ...item, text: '' } : item;
    parse.openListItem = shown;
    parse.listColumn = column;
    parse.listBreak = false;
    rememberDocxListItem(parse, shown, column);
    parse.listHardBreak = source.hardBreak;
    parse.listSealed = fence !== null;
    resetDocxItem(parse, fence);
    parse.blocks.push(listParagraph(shown));
    return true;
  }
  const lazy = !parse.listBreak && plainLazyListLine(line);
  return (
    openListItem !== null &&
    (isListContinuation(line, parse.listColumn ?? 2) || lazy) &&
    continueDocxListItem(parse, openListItem, source)
  );
}

function continueDocxListItem(
  parse: DocxParse,
  openListItem: MarkdownListItem,
  source: SourceLine
): boolean {
  if (appendDocxTail(parse, openListItem, source)) {
    return true;
  }
  if (parse.listSealed) {
    parse.openListItem = openListItem;
    parse.blocks.push(new Paragraph({ children: createParagraphChildren(source.text) }));
    return true;
  }
  const text = parse.listHardBreak
    ? `${openListItem.text}\n${source.text}`
    : `${openListItem.text} ${source.text}`;
  parse.listHardBreak = source.hardBreak;
  const combined = { ...openListItem, text };
  parse.openListItem = combined;
  const top = parse.listStack[parse.listStack.length - 1];
  if (top?.level === combined.level) {
    top.item = combined;
  }
  parse.blocks.pop();
  parse.blocks.push(listParagraph(combined));
  return true;
}

function appendDocxTail(
  parse: DocxParse,
  openListItem: MarkdownListItem,
  source: SourceLine
): boolean {
  if (parse.listSealed || (!parse.listParagraphBreak && !parse.tailOpen)) {
    return false;
  }
  const text =
    !parse.tailOpen || parse.tailText === null
      ? source.text
      : parse.tailHard
        ? `${parse.tailText}\n${source.text}`
        : `${parse.tailText} ${source.text}`;
  if (parse.tailOpen) {
    parse.blocks.pop();
  }
  parse.blocks.push(new Paragraph({ children: createParagraphChildren(text) }));
  parse.tailText = text;
  parse.tailHard = source.hardBreak;
  parse.tailOpen = true;
  parse.listParagraphBreak = false;
  parse.openListItem = openListItem;
  return true;
}

function keepDocxListBreak(parse: DocxParse, openListItem: MarkdownListItem | null): void {
  flushPendingParagraph(parse);
  if (openListItem && !parse.listBreak) {
    parse.openListItem = openListItem;
    parse.listBreak = true;
    if (!parse.listSealed) {
      parse.listParagraphBreak = true;
      parse.tailText = null;
      parse.tailOpen = false;
    }
    return;
  }
  parse.listBreak = false;
  parse.listStack.length = 0;
}

function takeDocxItemBlock(parse: DocxParse, line: string): boolean {
  return (
    takeDocxItemQuote(parse, line) ||
    takeDocxItemTable(parse, line) ||
    takeDocxItemMath(parse, line) ||
    takeDocxItemCode(parse, line) ||
    takeDocxItemSetext(parse, line) ||
    takeDocxItemRule(parse, line)
  );
}

function appendDocxBodyLine(parse: DocxParse, line: string): void {
  if (takeDocxItemBlock(parse, line)) {
    return;
  }
  const openListItem = parse.openListItem;
  parse.openListItem = null;
  const trimmed = line.trim();
  const structural =
    trimmed === '$$' ||
    parse.displayLines !== null ||
    isTableRow(trimmed) ||
    quoteBody(trimmed) !== null;
  if (structural) {
    flushPendingParagraph(parse);
  }
  const nextDisplay = takeDisplayLine(parse.blocks, line, parse.displayLines);
  if (nextDisplay !== false) {
    flushDocxTable(parse.blocks, parse.tableLines);
    flushDocxQuote(parse.blocks, parse.quoteLines);
    parse.displayLines = nextDisplay;
    return;
  }
  if (takeDocxTable(parse.blocks, trimmed, parse.tableLines)) {
    flushDocxQuote(parse.blocks, parse.quoteLines);
    return;
  }
  if (takeDocxQuote(parse.blocks, line, parse.quoteLines)) {
    return;
  }
  if (takeDocxSetext(parse, line)) {
    return;
  }
  if (finishDocxBodyLine(parse, line, openListItem)) {
    return;
  }
  const special = parseLineToParagraph(readSourceLine(line).text, parse.slugCounts);
  if (special) {
    flushPendingParagraph(parse);
    parse.blocks.push(special);
    return;
  }
  parse.pending.push(readSourceLine(line));
}

function finishDocxBodyLine(
  parse: DocxParse,
  line: string,
  openListItem: MarkdownListItem | null
): boolean {
  const source = readSourceLine(line);
  if (takeDocxList(parse, line, openListItem)) {
    return true;
  }
  if (source.text === '') {
    keepDocxListBreak(parse, openListItem);
    return true;
  }
  if (parse.listBreak && adoptDocxAncestor(parse, line)) {
    return true;
  }
  if (parse.listBreak) {
    parse.listStack.length = 0;
  }
  parse.listBreak = false;
  return false;
}

function takeDocxItemFence(parse: DocxParse, line: string): boolean {
  if (parse.itemFence) {
    if (readListFenceLine(parse.itemFence, line, parse.listColumn ?? 2) === 'closed') {
      parse.blocks.push(createCodeBlockParagraph(parse.itemFence.lines, parse.itemFence.language));
      parse.itemFence = null;
      parse.listSealed = true;
    }
    return true;
  }
  if (parse.openListItem === null || parse.listColumn === null) {
    return false;
  }
  const opened = openListFence(line, parse.listColumn);
  if (!opened) {
    return false;
  }
  parse.itemFence = {
    marker: opened.marker,
    language: opened.language,
    indent: opened.indent,
    lines: [],
  };
  parse.listBreak = false;
  return true;
}

function takeDocxFence(
  blocks: (Paragraph | Table)[],
  line: string,
  fence: string | null,
  codeLines: string[],
  tableLines: string[],
  quoteLines: string[],
  language: { current: string }
): string | null | undefined {
  if (fence) {
    if (!closesFence(line, fence)) {
      return undefined;
    }
    flushDocxTable(blocks, tableLines);
    flushDocxQuote(blocks, quoteLines);
    blocks.push(createCodeBlockParagraph(codeLines, language.current));
    codeLines.length = 0;
    language.current = '';
    return null;
  }
  const marker = openingFence(line);
  if (!marker) {
    return undefined;
  }
  flushDocxTable(blocks, tableLines);
  flushDocxQuote(blocks, quoteLines);
  language.current = fenceLanguage(line);
  return marker;
}

function readDocxLine(
  parse: DocxParse,
  line: string,
  fence: string | null,
  codeLines: string[],
  language: { current: string }
): string | null {
  if (takeDocxItemFence(parse, line)) {
    return fence;
  }
  const nextFence = takeDocxFence(
    parse.blocks,
    line,
    fence,
    codeLines,
    parse.tableLines,
    parse.quoteLines,
    language
  );
  if (nextFence !== undefined) {
    flushPendingParagraph(parse);
    return nextFence;
  }
  if (fence) {
    codeLines.push(line);
    return fence;
  }
  appendDocxBodyLine(parse, line);
  return fence;
}

function emptyDocxParse(): DocxParse {
  return {
    blocks: [],
    pending: [],
    displayLines: null,
    tableLines: [],
    quoteLines: [],
    listStack: [],
    openListItem: null,
    listBreak: false,
    listHardBreak: false,
    listColumn: null,
    listSealed: false,
    itemFence: null,
    itemQuote: null,
    itemTable: null,
    itemMath: null,
    itemCode: null,
    listParagraphBreak: false,
    tailText: null,
    tailHard: false,
    tailOpen: false,
    slugCounts: new Map<string, number>(),
  };
}

function parseContentToParagraphs(content: string): (Paragraph | Table)[] {
  const parse = emptyDocxParse();
  let fence: string | null = null;
  const codeLines: string[] = [];
  const language = { current: '' };

  for (const line of expandLinkReferences(prepareMarkdownSource(content)).split('\n')) {
    fence = readDocxLine(parse, line, fence, codeLines, language);
  }

  flushPendingParagraph(parse);
  flushDocxTable(parse.blocks, parse.tableLines);
  flushDocxQuote(parse.blocks, parse.quoteLines);
  if (parse.displayLines) {
    pushDisplayMath(parse.blocks, parse.displayLines);
  }
  if (fence && codeLines.length > 0) {
    parse.blocks.push(createCodeBlockParagraph(codeLines, language.current));
  }
  if (parse.itemFence) {
    parse.blocks.push(createCodeBlockParagraph(parse.itemFence.lines, parse.itemFence.language));
  }
  if (parse.itemQuote) {
    appendDocxQuoteLines(parse.blocks, parse.itemQuote, 1);
  }
  if (parse.itemTable) {
    flushDocxTable(parse.blocks, parse.itemTable);
  }
  if (parse.itemMath) {
    pushDisplayMath(parse.blocks, parse.itemMath);
  }
  if (parse.itemCode) {
    closeDocxItemCode(parse);
  }
  return parse.blocks;
}

export class DocxExporter implements Exporter {
  readonly format = 'docx';
  readonly label = 'Word';
  readonly extension = 'docx';
  readonly mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  async export(options: ExportOptions): Promise<ExportResult> {
    const warnings: string[] = [];

    try {
      const title = options.title ?? 'Untitled';
      const author = options.author ?? 'MDXPad';
      const content = await inlineLocalImages(options.content, options.sourcePath, 'data-url');
      const paragraphs = parseContentToParagraphs(content);

      const doc = new Document({
        creator: author,
        title,
        description: 'Exported from MDXPad',
        numbering: {
          config: [
            {
              reference: 'default-numbering',
              levels: [0, 1, 2, 3, 4, 5].map((level) => ({
                level,
                format: 'decimal' as const,
                text: `%${level + 1}.`,
                alignment: AlignmentType.START,
                style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
              })),
            },
          ],
        },
        sections: [{ children: paragraphs }],
      });

      const buffer = await Packer.toBuffer(doc);
      await writeFile(options.outputPath, buffer);

      return { ok: true, outputPath: options.outputPath, warnings };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'DOCX export failed',
        warnings,
      };
    }
  }
}
