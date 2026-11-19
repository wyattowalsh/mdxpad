import {
  docxHeadingBase,
  docxTocEntries,
  docxWantsToc,
  shiftDocxHeadings,
} from './docx-heading-options';
import { writeRegularFile } from './write-regular-file';

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

import {
  allocateHeadingSlug,
  normalizedHeadingFragment,
  parseAtxHeading,
} from '@shared/lib/markdown-heading';
import { prepareMarkdownSource } from '@shared/lib/markdown-math';
import { sanitizeMarkdownHtmlBlocks } from './markdown-html';

import { highlightCodeHtml } from './markdown-code';
import { imagePixels, inlineLocalImages, type ImageKind } from './export-image';
import { omitLocalMarkdownTargets } from './omit-local-markdown-targets';

import { mathComponents, splitDocxPieces } from './docx-math';
import {
  docxNumberingConfig,
  nextOrderedReference,
  orderedListReference,
  type OrderedNumberingPlan,
} from './docx-numbering';
import { isThematicBreak } from './markdown-break';
import {
  closesFence,
  closesIndentedFence,
  fenceLanguage,
  openIndentedFence,
  openingFence,
} from './markdown-fence';
import { setextLevel } from './markdown-setext';
import { expandLinkReferences } from './markdown-reference';
import { plainFootnoteMarkers } from './markdown-footnote';
import { renderedSegments } from './markdown-marks';
import { readSourceLine, type SourceLine } from './markdown-paragraph';
import { isTableRow, parseMarkdownTable, type TableAlign } from './markdown-table';
import {
  isLazyQuoteLine,
  quoteBody,
  quoteChunks,
  quoteMarkerLine,
  quoteParagraphPieces,
  quotedUnderlineLevel,
} from './markdown-quote';
import { expandAutolinkText, protectAutolinks } from './markdown-autolink';
import { protectEscapes, restoreEscapes, splitCodeSpans } from './markdown-escape';
import { decodeHtmlEntities } from './markdown-entity';
import { safeImageAddress, safeLinkAddress } from './markdown-export-address';
import { collectEmphasis, outerEmphasisMatches } from './markdown-emphasis';
import { findMarkdownTarget, linkDestination, linkTitle } from './markdown-link';
import {
  isListContinuation,
  listContentColumn,
  parseListItem,
  shouldOpenListItem,
  type MarkdownListItem,
} from './markdown-list';
import {
  dedentToColumn,
  listFenceOnMarker,
  listMarkerBlock,
  type ListMarkerBlock,
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
  kind: 'link' | 'image',
  title: string | null = null
): void {
  const parts = label.length > 0 ? parseInlineFormatting(label) : [{ text: target }];
  parts.forEach((segment, index) => {
    const text = segment.text.length > 0 ? segment.text : target;
    const titled = title && index === parts.length - 1 ? { title } : {};
    segments.push(
      kind === 'link'
        ? { ...segment, text, link: target, ...titled }
        : { ...segment, text, image: target, ...titled }
    );
  });
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
  mathTex?: string;
}

interface EmphasisFlags {
  readonly bold?: boolean;
  readonly italic?: boolean;
}

function parseCodeAndPlain(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  for (const part of splitCodeSpans(text)) {
    if (part.code) {
      segments.push({ text: part.text, code: true });
      continue;
    }
    if (part.text.length > 0) {
      segments.push(...parsePlainMarks(part.text));
    }
  }
  return segments;
}

export function parseInlineFormatting(text: string): InlineSegment[] {
  const struck = closeStrike(parseEmphasisText(text, {}));
  if (struck.length === 0) {
    return [{ text }];
  }
  return struck;
}

function withFlags(segments: InlineSegment[], marks: EmphasisFlags): InlineSegment[] {
  if (marks.bold !== true && marks.italic !== true) {
    return segments;
  }
  return segments.map((segment) => ({
    ...segment,
    ...(marks.bold === true ? { bold: true } : {}),
    ...(marks.italic === true ? { italic: true } : {}),
  }));
}

function parsePlainMarks(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const target = findMarkdownTarget(text, cursor);
    if (!target) {
      segments.push({ text: text.slice(cursor) });
      break;
    }
    if (target.start > cursor) {
      segments.push({ text: text.slice(cursor, target.start) });
    }
    if (target.image) {
      pushImage(segments, target.label, target.destination);
    } else {
      attachTarget(
        segments,
        target.label,
        linkDestination(target.destination),
        'link',
        linkTitle(target.destination)
      );
    }
    cursor = target.end;
  }
  return segments.length > 0 ? segments : [{ text }];
}

function parseEmphasisText(text: string, marks: EmphasisFlags): InlineSegment[] {
  const matches = collectEmphasis(text);
  const outer = outerEmphasisMatches(matches, 0, text.length);
  if (outer.length === 0) {
    return withFlags(parseCodeAndPlain(text), marks);
  }
  const segments: InlineSegment[] = [];
  let cursor = 0;
  for (const match of outer) {
    if (match.start > cursor) {
      segments.push(...withFlags(parseCodeAndPlain(text.slice(cursor, match.start)), marks));
    }
    segments.push(
      ...parseEmphasisText(text.slice(match.start + match.size, match.end - match.size), {
        bold: marks.bold === true || match.size === 2,
        italic: marks.italic === true || match.size === 1,
      })
    );
    cursor = match.end;
  }
  if (cursor < text.length) {
    segments.push(...withFlags(parseCodeAndPlain(text.slice(cursor)), marks));
  }
  return segments;
}

function closeStrike(segments: InlineSegment[]): InlineSegment[] {
  const result: InlineSegment[] = [];
  let open = false;
  for (const segment of segments) {
    if (segment.code || segment.link || segment.image || !segment.text.includes('~~')) {
      result.push(open ? { ...segment, strike: true } : segment);
      continue;
    }
    const parts = segment.text.split('~~');
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index] ?? '';
      if (part.length > 0) {
        result.push({ ...segment, text: part, ...(open ? { strike: true } : {}) });
      }
      if (index < parts.length - 1) {
        open = !open;
      }
    }
  }
  return result;
}

function linkedDocxChildren(
  raw: string,
  children: readonly (TextRun | Math)[]
): (TextRun | ExternalHyperlink | InternalHyperlink | Math)[] {
  const nodes = [...children];
  const anchor = normalizedHeadingFragment(decodeHtmlEntities(raw));
  if (anchor) {
    return [new InternalHyperlink({ children: nodes, anchor })];
  }
  const target = docxExternalTarget(raw);
  return target === null ? nodes : [new ExternalHyperlink({ children: nodes, link: target })];
}

function segmentText(segment: InlineSegment, text: string): InlineSegment {
  return {
    text,
    ...(segment.bold === undefined ? {} : { bold: segment.bold }),
    ...(segment.italic === undefined ? {} : { italic: segment.italic }),
    ...(segment.code === undefined ? {} : { code: segment.code }),
    ...(segment.image === undefined ? {} : { image: segment.image }),
    ...(segment.title === undefined ? {} : { title: segment.title }),
    ...(segment.strike === undefined ? {} : { strike: segment.strike }),
  };
}

function segmentRuns(
  segment: InlineSegment
): (TextRun | ExternalHyperlink | InternalHyperlink | ImageRun | Math)[] {
  if (segment.mathTex) {
    const math = new Math({ children: mathComponents(segment.mathTex) });
    return segment.link ? linkedDocxChildren(segment.link, [math]) : [math];
  }
  if (segment.code || segment.image) {
    return createTextRuns([segment]);
  }
  const pieces = splitDocxPieces(segment.text);
  if (!pieces.some((piece) => piece.kind === 'math')) {
    return createTextRuns([segment]);
  }
  const inner = pieces.flatMap((piece) =>
    piece.kind === 'math'
      ? [new Math({ children: mathComponents(piece.tex) })]
      : createTextRuns([segmentText(segment, piece.text)])
  );
  return segment.link ? linkedDocxChildren(segment.link, inner) : inner;
}

function docxMathSegments(
  segment: InlineSegment,
  raw: string,
  href: string | undefined,
  chars: readonly string[]
): InlineSegment[] {
  const link = href ? { link: href } : {};
  const pieces = splitDocxPieces(raw);
  if (!pieces.some((piece) => piece.kind === 'math')) {
    return [{ ...segment, text: restoreEscapes(raw, chars, (char) => char), ...link }];
  }
  return pieces.flatMap((piece) => {
    if (piece.kind === 'math') {
      return [{ ...segment, text: '', mathTex: piece.tex, ...link }];
    }
    const text = restoreEscapes(piece.text, chars, (char) => char);
    return text.length > 0 ? [{ ...segment, text, ...link }] : [];
  });
}

function createParagraphChildren(
  text: string
): (TextRun | ExternalHyperlink | InternalHyperlink | ImageRun | Math)[] {
  const escaped = protectEscapes(text);
  const protectedLinks = protectAutolinks(escaped.text);
  const segments = parseInlineFormatting(protectedLinks.text).flatMap((segment) => {
    if (segment.code || segment.link || segment.image) {
      return [segment];
    }
    return expandAutolinkText(segment.text, protectedLinks.links).flatMap((part) =>
      docxMathSegments(segment, part.text, part.href, escaped.chars)
    );
  });
  const children = segments.flatMap((segment) => segmentRuns(segment));
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

function docxExternalTarget(raw: string): string | null {
  const safe = safeLinkAddress(decodeHtmlEntities(raw));
  if (safe === null || safe.startsWith('/') || safe.startsWith('\\')) {
    return null;
  }
  return safe;
}

function docxHyperlink(
  raw: string,
  child: TextRun | ImageRun
): TextRun | ExternalHyperlink | InternalHyperlink | ImageRun {
  const anchor = normalizedHeadingFragment(decodeHtmlEntities(raw));
  if (anchor) {
    return new InternalHyperlink({ children: [child], anchor });
  }
  const target = docxExternalTarget(raw);
  if (target === null) {
    return child;
  }
  return new ExternalHyperlink({ children: [child], link: target });
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
  return segments.flatMap((segment) => {
    if (segment.image) {
      const picture = docxImage(
        decodeHtmlEntities(segment.image),
        segment.text,
        segment.title ?? ''
      );
      if (segment.link) {
        const child = picture ?? styledRun(segment, segment.text || 'image', 'Hyperlink');
        return [docxHyperlink(segment.link, child)];
      }
      if (picture) {
        return [picture];
      }
      if (safeImageAddress(decodeHtmlEntities(segment.image)) === null) {
        return [styledRun(segment, segment.text || 'image')];
      }
      return [
        docxHyperlink(segment.image, styledRun(segment, segment.text || 'image', 'Hyperlink')),
      ];
    }
    if (segment.link) {
      const link = docxHyperlink(segment.link, styledRun(segment, segment.text, 'Hyperlink'));
      if (!segment.title || segment.image) {
        return [link];
      }
      return [link, new TextRun({ text: ` ${segment.title}`, italics: true })];
    }
    return [styledRun(segment, segment.text)];
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

function appendDocxQuoteCodeLines(
  blocks: (Paragraph | Table)[],
  lines: readonly string[],
  start: number,
  column: number
): number {
  const first = lines[start] ?? '';
  const block = [first];
  let cursor = start + 1;
  const opened = openIndentedFence(first, column);
  if (opened) {
    while (cursor < lines.length) {
      const next = lines[cursor] ?? '';
      block.push(next);
      cursor += 1;
      if (closesIndentedFence(next, opened.marker, column)) {
        break;
      }
    }
  } else {
    while (cursor < lines.length) {
      const next = lines[cursor] ?? '';
      const indent = /^ */.exec(next.replaceAll('\t', '    '))?.[0].length ?? 0;
      if (next.trim().length > 0 && indent < column + 4) {
        break;
      }
      block.push(next);
      cursor += 1;
    }
  }
  const fenceIndent = openIndentedFence(first, column)?.indent ?? column;
  const shifted = block.map((line) => {
    const expanded = line.replaceAll('\t', '    ');
    let spaces = 0;
    while (expanded[spaces] === ' ') {
      spaces += 1;
    }
    const cut = spaces < fenceIndent ? spaces : fenceIndent;
    return expanded.slice(cut);
  });
  appendDocxQuoteCode(blocks, shifted);
  return cursor;
}

function continueDocxQuoteItem(
  current: MarkdownListItem,
  line: string,
  hard: boolean
): MarkdownListItem {
  const source = readSourceLine(line);
  const text = hard ? `${current.text}\n${source.text}` : `${current.text} ${source.text}`;
  return { level: current.level, ordered: current.ordered, start: current.start, text };
}

function readDocxMarkerFence(
  lines: readonly string[],
  index: number,
  marker: string,
  column: number
): { sample: string[]; next: number } {
  const sample = [lines[index] ?? ''];
  let cursor = index + 1;
  while (cursor < lines.length) {
    const next = lines[cursor] ?? '';
    sample.push(next);
    cursor += 1;
    if (closesFence(next, marker) || closesIndentedFence(next, marker, column)) {
      break;
    }
  }
  return { sample, next: cursor };
}

function readDocxMarkerQuote(
  lines: readonly string[],
  index: number,
  first: string
): {
  quote: string[];
  next: number;
} {
  const quote = [first];
  let cursor = index;
  while (cursor < lines.length) {
    const next = lines[cursor] ?? '';
    const nested = quoteBody(next);
    if (nested !== null) {
      quote.push(nested);
      cursor += 1;
      continue;
    }
    if (next.trim().length === 0 || !isLazyQuoteLine(next)) {
      break;
    }
    quote.push(next);
    cursor += 1;
  }
  return { quote, next: cursor };
}

function appendDocxMarkerTable(
  blocks: (Paragraph | Table)[],
  lines: readonly string[],
  index: number,
  row: string
): number {
  const rows = [row];
  let cursor = index;
  while (cursor < lines.length && isTableRow(lines[cursor] ?? '')) {
    rows.push((lines[cursor] ?? '').trim());
    cursor += 1;
  }
  flushDocxTable(blocks, rows);
  return cursor;
}

function appendDocxMarkerHeading(
  blocks: (Paragraph | Table)[],
  item: MarkdownListItem,
  depth: number,
  index: number,
  reference?: string
): number | null {
  const heading = parseAtxHeading(item.text);
  if (!heading) {
    return null;
  }
  blocks.push(listParagraph({ ...item, text: '' }, depth, reference));
  blocks.push(bookmarkedHeading(heading.depth, heading.text, new Map()));
  return index + 1;
}

function appendDocxMarkerQuoteItem(
  blocks: (Paragraph | Table)[],
  lines: readonly string[],
  index: number,
  item: MarkdownListItem,
  depth: number,
  reference?: string
): number | null {
  const column = listContentColumn(lines[index] ?? '') ?? 2;
  const fence = openingFence(item.text);
  const block = fence === null ? listMarkerBlock(item.text) : null;
  if (fence === null && block === null) {
    return appendDocxMarkerHeading(blocks, item, depth, index, reference);
  }
  blocks.push(listParagraph({ ...item, text: '' }, depth, reference));
  if (fence !== null) {
    const read = readDocxMarkerFence(lines, index, fence, column);
    read.sample[0] = item.text;
    appendDocxQuoteCode(blocks, read.sample);
    return read.next;
  }
  if (block?.kind === 'rule') {
    blocks.push(docxRuleParagraph());
    return index + 1;
  }
  if (block?.kind === 'math') {
    const formula = [...block.lines];
    let cursor = index + 1;
    if (formula.length === 0) {
      while (cursor < lines.length && (lines[cursor] ?? '').trim() !== '$$') {
        formula.push((lines[cursor] ?? '').trim());
        cursor += 1;
      }
      if ((lines[cursor] ?? '').trim() === '$$') {
        cursor += 1;
      }
    }
    pushDisplayMath(blocks, formula);
    return cursor;
  }
  if (block?.kind === 'table') {
    return appendDocxMarkerTable(blocks, lines, index + 1, block.row);
  }
  const read = readDocxMarkerQuote(lines, index + 1, block?.kind === 'quote' ? block.text : '');
  appendDocxQuoteParagraph(blocks, read.quote, depth + 1);
  return read.next;
}

function takeDocxQuotedContinuation(
  blocks: (Paragraph | Table)[],
  lines: readonly string[],
  index: number,
  current: MarkdownListItem,
  column: number,
  depth: number,
  reference?: string
): { current: MarkdownListItem | null; index: number } | null {
  const line = lines[index] ?? '';
  const indent = /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
  const code =
    openIndentedFence(line, column) !== null || (line.trim().length > 0 && indent >= column + 4);
  if (code) {
    blocks.push(listParagraph(current, depth, reference));
    return { current: null, index: appendDocxQuoteCodeLines(blocks, lines, index, column) - 1 };
  }
  const underline = quotedUnderlineLevel(line);
  if (underline !== null && current.text.length > 0) {
    blocks.push(bookmarkedHeading(underline, current.text, new Map()));
    return { current: null, index };
  }
  return null;
}

interface QuoteListCursor {
  current: MarkdownListItem | null;
  open: MarkdownListItem | null;
  reference: string | undefined;
  column: number;
  hard: boolean;
  index: number;
}

function openQuotedListItem(
  blocks: (Paragraph | Table)[],
  lines: readonly string[],
  cursor: QuoteListCursor,
  item: MarkdownListItem,
  depth: number,
  plans: OrderedNumberingPlan[]
): QuoteListCursor {
  if (cursor.current) {
    blocks.push(listParagraph(cursor.current, depth, cursor.reference));
  }
  const reference = nextOrderedReference(plans, cursor.open, cursor.reference, item);
  const consumed = appendDocxMarkerQuoteItem(blocks, lines, cursor.index, item, depth, reference);
  const line = lines[cursor.index] ?? '';
  if (consumed !== null) {
    return { ...cursor, current: null, open: item, reference, index: consumed - 1 };
  }
  return {
    current: item,
    open: item,
    reference,
    column: listContentColumn(line) ?? 2,
    hard: readSourceLine(line).hardBreak,
    index: cursor.index,
  };
}

function continueQuotedListLine(
  blocks: (Paragraph | Table)[],
  lines: readonly string[],
  cursor: QuoteListCursor,
  line: string,
  index: number,
  depth: number
): { cursor: QuoteListCursor; index: number } | null {
  if (!cursor.current) {
    return null;
  }
  const continued = takeDocxQuotedContinuation(
    blocks,
    lines,
    index,
    cursor.current,
    cursor.column,
    depth,
    cursor.reference
  );
  if (continued) {
    return {
      cursor: { ...cursor, current: continued.current, index: continued.index },
      index: continued.index,
    };
  }
  return {
    cursor: {
      ...cursor,
      current: continueDocxQuoteItem(cursor.current, line, cursor.hard),
      hard: readSourceLine(line).hardBreak,
    },
    index,
  };
}

function appendDocxQuoteList(
  blocks: (Paragraph | Table)[],
  lines: readonly string[],
  depth: number,
  plans: OrderedNumberingPlan[] = []
): void {
  let cursor: QuoteListCursor = {
    current: null,
    open: null,
    reference: undefined,
    column: 2,
    hard: false,
    index: 0,
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    cursor = { ...cursor, index };
    if (line.trim().length === 0) {
      continue;
    }
    const item = parseListItem(line);
    if (item) {
      cursor = openQuotedListItem(blocks, lines, cursor, item, depth, plans);
      index = cursor.index;
      continue;
    }
    const continued = continueQuotedListLine(blocks, lines, cursor, line, index, depth);
    if (!continued) {
      continue;
    }
    cursor = continued.cursor;
    index = continued.index;
  }
  if (cursor.current) {
    blocks.push(listParagraph(cursor.current, depth, cursor.reference));
  }
}

function appendDocxQuoteParagraph(
  blocks: (Paragraph | Table)[],
  lines: readonly string[],
  depth: number,
  slugs?: Map<string, number>
): void {
  for (const piece of quoteParagraphPieces(lines)) {
    if (piece.kind === 'heading') {
      blocks.push(
        slugs
          ? bookmarkedHeading(piece.level, piece.text, slugs)
          : new Paragraph({
              heading: getHeadingLevel(piece.level),
              children: createParagraphChildren(piece.text),
            })
      );
      continue;
    }
    const sources = piece.lines
      .map((line) => readSourceLine(line))
      .filter((line) => line.text.length > 0);
    if (sources.length > 0) {
      blocks.push(paragraphFromLines(sources, depth));
    }
  }
}

function appendDocxQuoteCode(blocks: (Paragraph | Table)[], lines: readonly string[]): void {
  const marker = openingFence(lines[0] ?? '');
  if (marker === null) {
    const body = lines.map((line) => line.replace(/^(?: {4}|\t)/, ''));
    blocks.push(createCodeBlockParagraph(body, ''));
    return;
  }
  const last = lines[lines.length - 1] ?? '';
  const end = closesFence(last, marker) ? -1 : undefined;
  blocks.push(createCodeBlockParagraph(lines.slice(1, end), fenceLanguage(lines[0] ?? '')));
}

function appendDocxQuoteLines(
  blocks: (Paragraph | Table)[],
  lines: readonly string[],
  depth: number,
  slugs?: Map<string, number>,
  plans?: OrderedNumberingPlan[]
): void {
  for (const chunk of quoteChunks(lines)) {
    if (chunk.kind === 'nested') {
      appendDocxQuoteLines(blocks, chunk.lines, depth + 1, slugs, plans);
      continue;
    }
    if (chunk.kind === 'table') {
      flushDocxTable(blocks, [...chunk.lines]);
      continue;
    }
    if (chunk.kind === 'code') {
      appendDocxQuoteCode(blocks, chunk.lines);
      continue;
    }
    if (chunk.kind === 'list') {
      appendDocxQuoteList(blocks, chunk.lines, depth, plans);
      continue;
    }
    appendDocxQuoteParagraph(blocks, chunk.lines, depth, slugs);
  }
}

function flushDocxQuote(
  blocks: (Paragraph | Table)[],
  quoteLines: string[],
  slugs?: Map<string, number>,
  plans?: OrderedNumberingPlan[]
): void {
  if (quoteLines.length === 0) {
    return;
  }
  appendDocxQuoteLines(blocks, quoteLines.splice(0, quoteLines.length), 1, slugs, plans);
}

function takeDocxItemQuote(parse: DocxParse, line: string): boolean {
  if (parse.itemFence) {
    return false;
  }
  if (parse.itemQuote) {
    const text = readListQuoteLine(line, parse.listColumn ?? 2);
    if (text === null) {
      appendDocxQuoteLines(parse.blocks, parse.itemQuote, 1, parse.slugCounts, parse.numbering);
      parse.itemQuote = null;
      parse.listSealed = true;
      return false;
    }
    parse.itemQuote.push(quoteMarkerLine(text));
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

function takeDocxQuote(
  blocks: (Paragraph | Table)[],
  line: string,
  quoteLines: string[],
  slugs?: Map<string, number>,
  plans?: OrderedNumberingPlan[]
): boolean {
  const body = quoteBody(line);
  if (body !== null) {
    quoteLines.push(quoteMarkerLine(body));
    return true;
  }
  if (quoteLines.length > 0 && isLazyQuoteLine(line)) {
    quoteLines.push(line);
    return true;
  }
  if (quoteLines.length > 0) {
    flushDocxQuote(blocks, quoteLines, slugs, plans);
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

function displayMathTex(lines: readonly string[]): string {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(' ');
}

function pushDisplayMath(paragraphs: (Paragraph | Table)[], lines: readonly string[]): void {
  const tex = displayMathTex(lines);
  if (tex.length === 0) {
    return;
  }
  paragraphs.push(new Paragraph({ children: [new Math({ children: mathComponents(tex) })] }));
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
  readonly reference?: string;
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
  numbering: OrderedNumberingPlan[];
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

function listParagraph(item: MarkdownListItem, quoteDepth = 0, reference?: string): Paragraph {
  const children = listItemChildren(item.text);
  const indent = quoteDepth > 0 ? { left: 720 * quoteDepth } : undefined;
  if (item.ordered) {
    return new Paragraph({
      numbering: { reference: reference ?? 'default-numbering', level: item.level },
      ...(indent ? { indent } : {}),
      children,
    });
  }
  if (item.delimiter === '+' || item.delimiter === '*') {
    return new Paragraph({
      indent: { left: 720 * (item.level + 1) + 720 * quoteDepth, hanging: 360 },
      children: [new TextRun({ text: `${item.delimiter} ` }), ...children],
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

function activeOrderedReference(parse: DocxParse): string | undefined {
  return parse.listStack[parse.listStack.length - 1]?.reference;
}

function rememberDocxListItem(parse: DocxParse, item: MarkdownListItem, column: number): void {
  const reference = orderedListReference(parse.listStack, parse.numbering, item);
  while (parse.listStack.length > 0) {
    const top = parse.listStack[parse.listStack.length - 1];
    if (!top || top.level < item.level) {
      break;
    }
    parse.listStack.pop();
  }
  parse.listStack.push({
    level: item.level,
    column,
    item,
    ...(reference === undefined ? {} : { reference }),
  });
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

function takeDocxMarkerBlock(
  parse: DocxParse,
  item: MarkdownListItem,
  column: number,
  hardBreak: boolean,
  block: ListMarkerBlock
): boolean {
  const shown = { ...item, text: '' };
  parse.openListItem = shown;
  parse.listColumn = column;
  parse.listBreak = false;
  rememberDocxListItem(parse, shown, column);
  parse.listHardBreak = hardBreak;
  parse.listSealed = block.kind === 'rule' || (block.kind === 'math' && block.lines.length > 0);
  resetDocxItem(parse, null);
  parse.blocks.push(listParagraph(shown, 0, activeOrderedReference(parse)));
  if (block.kind === 'rule') {
    parse.blocks.push(docxRuleParagraph());
    return true;
  }
  if (block.kind === 'math' && block.lines.length > 0) {
    pushDisplayMath(parse.blocks, block.lines);
    return true;
  }
  if (block.kind === 'math') {
    parse.itemMath = [];
    return true;
  }
  if (block.kind === 'table') {
    parse.itemTable = [block.row];
    return true;
  }
  parse.itemQuote = [quoteMarkerLine(block.text)];
  return true;
}

function takeDocxList(
  parse: DocxParse,
  line: string,
  openListItem: MarkdownListItem | null
): boolean {
  const source = readSourceLine(line);
  const item = source.text.length > 0 && !isThematicBreak(source.text) ? parseListItem(line) : null;
  const frames = parse.listStack.map((frame) => ({
    level: frame.level,
    kind: frame.item.ordered ? ('ol' as const) : ('ul' as const),
    delimiter: frame.item.delimiter ?? ('' as const),
  }));
  const openItem =
    item !== null && shouldOpenListItem(item, frames, parse.listBreak, parse.pending.length > 0);
  if (item && openItem) {
    flushPendingParagraph(parse);
    const column = listContentColumn(line) ?? 2;
    if (takeDocxAtxItem(parse, item, column)) {
      return true;
    }
    const fence = listFenceOnMarker(line, column);
    const block = fence ? null : listMarkerBlock(item.text);
    if (block && takeDocxMarkerBlock(parse, item, column, source.hardBreak, block)) {
      return true;
    }
    const shown = fence ? { ...item, text: '' } : item;
    parse.openListItem = shown;
    parse.listColumn = column;
    parse.listBreak = false;
    rememberDocxListItem(parse, shown, column);
    parse.listHardBreak = source.hardBreak;
    parse.listSealed = fence !== null;
    resetDocxItem(parse, fence);
    parse.blocks.push(listParagraph(shown, 0, activeOrderedReference(parse)));
    return true;
  }
  const lazy = !parse.listBreak && plainLazyListLine(line);
  const spaces = /^ */.exec(line.replaceAll('\t', '    '))?.[0].length ?? 0;
  const heldMarker =
    item !== null && !openItem && openListItem !== null && spaces >= (parse.listColumn ?? 2);
  return (
    openListItem !== null &&
    (isListContinuation(line, parse.listColumn ?? 2) || lazy || heldMarker) &&
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
  parse.blocks.push(listParagraph(combined, 0, activeOrderedReference(parse)));
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
  if (openListItem) {
    parse.openListItem = openListItem;
    if (!parse.listBreak) {
      parse.listBreak = true;
      if (!parse.listSealed) {
        parse.listParagraphBreak = true;
        parse.tailText = null;
        parse.tailOpen = false;
      }
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
    flushDocxQuote(parse.blocks, parse.quoteLines, parse.slugCounts, parse.numbering);
    parse.displayLines = nextDisplay;
    return;
  }
  if (takeDocxTable(parse.blocks, trimmed, parse.tableLines)) {
    flushDocxQuote(parse.blocks, parse.quoteLines, parse.slugCounts, parse.numbering);
    return;
  }
  if (takeDocxQuote(parse.blocks, line, parse.quoteLines, parse.slugCounts, parse.numbering)) {
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
  language: { current: string },
  plans?: OrderedNumberingPlan[]
): string | null | undefined {
  if (fence) {
    if (!closesFence(line, fence)) {
      return undefined;
    }
    flushDocxTable(blocks, tableLines);
    flushDocxQuote(blocks, quoteLines, undefined, plans);
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
  flushDocxQuote(blocks, quoteLines, undefined, plans);
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
    language,
    parse.numbering
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
    numbering: [],
  };
}

function docxTocParagraphs(content: string): Paragraph[] {
  return [
    new Paragraph({ children: [new TextRun({ text: 'Table of Contents', bold: true })] }),
    ...docxTocEntries(content).map(
      (entry) => new Paragraph({ children: [new TextRun({ text: entry })] })
    ),
  ];
}

function docxParagraphs(
  content: string,
  metadata: Record<string, unknown> | undefined
): { blocks: (Paragraph | Table)[]; numbering: OrderedNumberingPlan[] } {
  const shifted = shiftDocxHeadings(content, docxHeadingBase(metadata));
  const body = parseContentToParagraphs(shifted);
  const blocks = docxWantsToc(metadata)
    ? [...docxTocParagraphs(shifted), ...body.blocks]
    : body.blocks;
  return { blocks, numbering: body.numbering };
}

function parseContentToParagraphs(content: string): {
  blocks: (Paragraph | Table)[];
  numbering: OrderedNumberingPlan[];
} {
  const parse = emptyDocxParse();
  let fence: string | null = null;
  const codeLines: string[] = [];
  const language = { current: '' };

  for (const line of plainFootnoteMarkers(
    expandLinkReferences(
      prepareMarkdownSource(sanitizeMarkdownHtmlBlocks(content), { preserveHtml: true })
    )
  ).split('\n')) {
    fence = readDocxLine(parse, line, fence, codeLines, language);
  }

  flushPendingParagraph(parse);
  flushDocxTable(parse.blocks, parse.tableLines);
  flushDocxQuote(parse.blocks, parse.quoteLines, parse.slugCounts, parse.numbering);
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
    appendDocxQuoteLines(parse.blocks, parse.itemQuote, 1, parse.slugCounts, parse.numbering);
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
  return { blocks: parse.blocks, numbering: parse.numbering };
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
      const inlined = await inlineLocalImages(options.content, options.sourcePath, 'data-url');
      const content = omitLocalMarkdownTargets(inlined, options.sourcePath);
      const paragraphs = docxParagraphs(content, options.metadata);

      const doc = new Document({
        creator: author,
        title,
        description: 'Exported from MDXPad',
        numbering: { config: docxNumberingConfig(paragraphs.numbering) },
        sections: [{ children: paragraphs.blocks }],
      });

      const buffer = await Packer.toBuffer(doc);
      await writeRegularFile(options.outputPath, buffer);

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
