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

import { imagePixels, inlineLocalImages, type ImageKind } from './export-image';

import { mathComponents, splitDocxPieces } from './docx-math';
import { isThematicBreak } from './markdown-break';
import { closesFence, openingFence } from './markdown-fence';
import { setextLevel } from './markdown-setext';
import { expandLinkReferences } from './markdown-reference';
import { readSourceLine, type SourceLine } from './markdown-paragraph';
import { isTableRow, parseMarkdownTable, type TableAlign } from './markdown-table';
import { isLazyQuoteLine, quoteBody, quoteLineDepth } from './markdown-quote';
import { expandAutolinkText, protectAutolinks } from './markdown-autolink';
import { protectEscapes, restoreEscapes } from './markdown-escape';
import { decodeHtmlEntities } from './markdown-entity';
import { linkDestination } from './markdown-link';
import {
  isListContinuation,
  listContentColumn,
  parseListItem,
  type MarkdownListItem,
} from './markdown-list';
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
  strike?: boolean;
}

export function parseInlineFormatting(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const regex =
    /(\*\*\*(.+?)\*\*\*|(?<![\w])___(.+?)___(?![\w])|\*\*(.+?)\*\*|(?<![\w])__(.+?)__(?![\w])|`([^`]+)`|\*([^*]*(?:\*\*[^*]*)*)\*|(?<![\w])_([^_]*(?:__[^_]*)*)_(?![\w])|\[([^\]]+)\]\(((?:[^()]|\([^()]*\))+)\)|~~(.+?)~~)/g;
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
      attachTarget(segments, alt, linkDestination(src), 'image');
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

function docxImage(src: string, alt: string): ImageRun | null {
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
    altText: { name: alt.length > 0 ? alt : 'image', description: alt },
  });
}

function createTextRuns(
  segments: InlineSegment[]
): (TextRun | ExternalHyperlink | InternalHyperlink | ImageRun)[] {
  return segments.map((segment) => {
    if (segment.image) {
      const picture = docxImage(decodeHtmlEntities(segment.image), segment.text);
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

function createCodeBlockParagraph(codeLines: string[]): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: codeLines.join('\n'), font: { name: 'Courier New' }, size: 20 }),
    ],
    spacing: { before: 120, after: 120 },
  });
}

function listItemChildren(
  text: string
): (TextRun | ExternalHyperlink | InternalHyperlink | ImageRun | Math)[] {
  const task = splitTaskItem(text);
  if (!task) {
    return createParagraphChildren(text);
  }
  const mark = new TextRun({ text: task.checked ? '☑ ' : '☐ ' });
  return [mark, ...createParagraphChildren(task.body)];
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
    return new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: 'auto' } },
      spacing: { before: 120, after: 120 },
    });
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

function flushDocxQuote(blocks: (Paragraph | Table)[], quoteLines: string[]): void {
  if (quoteLines.length === 0) {
    return;
  }
  const lines = quoteLines.splice(0, quoteLines.length);
  for (const line of lines) {
    const quoted = quoteLineDepth(line);
    if (quoted.text.length === 0) {
      continue;
    }
    blocks.push(
      new Paragraph({
        indent: { left: 720 * quoted.depth },
        children: createParagraphChildren(quoted.text),
      })
    );
  }
}

function takeDocxQuote(blocks: (Paragraph | Table)[], line: string, quoteLines: string[]): boolean {
  const body = quoteBody(line);
  if (body !== null) {
    quoteLines.push(body);
    return true;
  }
  if (quoteLines.length > 0 && isLazyQuoteLine(line)) {
    quoteLines.push(line.trim());
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

interface DocxParse {
  blocks: (Paragraph | Table)[];
  pending: SourceLine[];
  displayLines: string[] | null;
  tableLines: string[];
  quoteLines: string[];
  openListItem: MarkdownListItem | null;
  listBreak: boolean;
  listColumn: number | null;
  slugCounts: Map<string, number>;
}

function paragraphFromLines(lines: readonly SourceLine[]): Paragraph {
  const children: (TextRun | ExternalHyperlink | InternalHyperlink | ImageRun | Math)[] = [];
  lines.forEach((line, index) => {
    if (index > 0) {
      const previous = lines[index - 1];
      children.push(previous?.hardBreak ? new TextRun({ break: 1 }) : new TextRun({ text: ' ' }));
    }
    children.push(...createParagraphChildren(line.text));
  });
  return new Paragraph({ children });
}

function flushPendingParagraph(parse: DocxParse): void {
  if (parse.pending.length === 0) {
    return;
  }
  const lines = parse.pending.splice(0, parse.pending.length);
  parse.blocks.push(paragraphFromLines(lines));
}

function listParagraph(item: MarkdownListItem): Paragraph {
  const children = listItemChildren(item.text);
  if (item.ordered && item.start > 1) {
    return new Paragraph({
      indent: { left: 720 * (item.level + 1), hanging: 360 },
      children: [new TextRun({ text: `${item.start}. ` }), ...children],
    });
  }
  if (item.ordered) {
    return new Paragraph({
      numbering: { reference: 'default-numbering', level: item.level },
      children,
    });
  }
  return new Paragraph({ bullet: { level: item.level }, children });
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

function takeDocxList(
  parse: DocxParse,
  line: string,
  openListItem: MarkdownListItem | null
): boolean {
  const source = readSourceLine(line);
  const item = source.text.length > 0 && !isThematicBreak(source.text) ? parseListItem(line) : null;
  if (item) {
    flushPendingParagraph(parse);
    parse.openListItem = item;
    parse.listColumn = listContentColumn(line);
    parse.blocks.push(listParagraph(item));
    return true;
  }
  if (openListItem && isListContinuation(line, parse.listColumn ?? 2)) {
    const combined = { ...openListItem, text: `${openListItem.text} ${line.trim()}` };
    parse.openListItem = combined;
    parse.blocks.pop();
    parse.blocks.push(listParagraph(combined));
    return true;
  }
  return false;
}

function keepDocxListBreak(parse: DocxParse, openListItem: MarkdownListItem | null): void {
  flushPendingParagraph(parse);
  if (openListItem && !parse.listBreak) {
    parse.openListItem = openListItem;
    parse.listBreak = true;
    return;
  }
  parse.listBreak = false;
}

function appendDocxBodyLine(parse: DocxParse, line: string): void {
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
  if (takeDocxQuote(parse.blocks, trimmed, parse.quoteLines)) {
    return;
  }
  if (takeDocxSetext(parse, line)) {
    return;
  }
  const source = readSourceLine(line);
  if (takeDocxList(parse, line, openListItem)) {
    return;
  }
  if (source.text === '') {
    keepDocxListBreak(parse, openListItem);
    return;
  }
  parse.listBreak = false;
  const special = parseLineToParagraph(source.text, parse.slugCounts);
  if (special) {
    flushPendingParagraph(parse);
    parse.blocks.push(special);
    return;
  }
  parse.pending.push(source);
}

function takeDocxFence(
  blocks: (Paragraph | Table)[],
  line: string,
  fence: string | null,
  codeLines: string[],
  tableLines: string[],
  quoteLines: string[]
): string | null | undefined {
  if (fence) {
    if (!closesFence(line, fence)) {
      return undefined;
    }
    flushDocxTable(blocks, tableLines);
    flushDocxQuote(blocks, quoteLines);
    blocks.push(createCodeBlockParagraph(codeLines));
    codeLines.length = 0;
    return null;
  }
  const marker = openingFence(line);
  if (!marker) {
    return undefined;
  }
  flushDocxTable(blocks, tableLines);
  flushDocxQuote(blocks, quoteLines);
  return marker;
}

function parseContentToParagraphs(content: string): (Paragraph | Table)[] {
  const parse: DocxParse = {
    blocks: [],
    pending: [],
    displayLines: null,
    tableLines: [],
    quoteLines: [],
    openListItem: null,
    listBreak: false,
    listColumn: null,
    slugCounts: new Map<string, number>(),
  };
  let fence: string | null = null;
  const codeLines: string[] = [];

  for (const line of expandLinkReferences(content).split('\n')) {
    const nextFence = takeDocxFence(
      parse.blocks,
      line,
      fence,
      codeLines,
      parse.tableLines,
      parse.quoteLines
    );
    if (nextFence !== undefined) {
      flushPendingParagraph(parse);
      fence = nextFence;
      continue;
    }
    if (fence) {
      codeLines.push(line);
      continue;
    }
    appendDocxBodyLine(parse, line);
  }

  flushPendingParagraph(parse);
  flushDocxTable(parse.blocks, parse.tableLines);
  flushDocxQuote(parse.blocks, parse.quoteLines);
  if (parse.displayLines) {
    pushDisplayMath(parse.blocks, parse.displayLines);
  }
  if (fence && codeLines.length > 0) {
    parse.blocks.push(createCodeBlockParagraph(codeLines));
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
