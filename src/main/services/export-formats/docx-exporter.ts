import { writeFile } from 'node:fs/promises';

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Math,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from 'docx';

import { mathComponents, splitDocxPieces } from './docx-math';
import { isThematicBreak } from './markdown-break';
import { setextLevel } from './markdown-setext';
import { expandLinkReferences } from './markdown-reference';
import { readSourceLine, type SourceLine } from './markdown-paragraph';
import { isTableRow, parseMarkdownTable } from './markdown-table';
import { quoteBody, quoteLineDepth } from './markdown-quote';
import { expandAutolinkText, protectAutolinks } from './markdown-autolink';
import { protectEscapes, restoreEscapes } from './markdown-escape';
import { linkDestination } from './markdown-link';
import { parseListItem, type MarkdownListItem } from './markdown-list';
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
    /(\*\*(.+?)\*\*|(?<![\w])__(.+?)__(?![\w])|`([^`]+)`|\*(.+?)\*|(?<![\w])_(.+?)_(?![\w])|\[([^\]]+)\]\(([^)]+)\)|~~(.+?)~~)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    const matchIndex = match.index;
    const image =
      match[7] !== undefined &&
      match[8] !== undefined &&
      matchIndex > 0 &&
      text[matchIndex - 1] === '!';
    const prefixEnd = image ? matchIndex - 1 : matchIndex;
    if (prefixEnd > lastIndex) {
      segments.push({ text: text.slice(lastIndex, prefixEnd) });
    }

    if (image) {
      const alt = match[7] ?? '';
      const src = match[8] ?? '';
      const path = linkDestination(src);
      segments.push({ text: alt.length > 0 ? alt : path, image: path });
    } else if (match[2] !== undefined) {
      segments.push({ text: match[2], bold: true });
    } else if (match[3] !== undefined) {
      segments.push({ text: match[3], bold: true });
    } else if (match[4] !== undefined) {
      segments.push({ text: match[4], code: true });
    } else if (match[5] !== undefined) {
      segments.push({ text: match[5], italic: true });
    } else if (match[6] !== undefined) {
      segments.push({ text: match[6], italic: true });
    } else if (match[7] !== undefined && match[8] !== undefined) {
      segments.push({ text: match[7], link: linkDestination(match[8]) });
    } else if (match[9] !== undefined) {
      segments.push({ text: match[9], strike: true });
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

function createParagraphChildren(text: string): (TextRun | ExternalHyperlink | Math)[] {
  const children: (TextRun | ExternalHyperlink | Math)[] = [];
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

function createTextRuns(segments: InlineSegment[]): (TextRun | ExternalHyperlink)[] {
  return segments.map((segment) => {
    if (segment.image) {
      return new ExternalHyperlink({
        children: [new TextRun({ text: segment.text || segment.image, style: 'Hyperlink' })],
        link: segment.image,
      });
    }
    if (segment.link) {
      return new ExternalHyperlink({
        children: [new TextRun({ text: segment.text, style: 'Hyperlink' })],
        link: segment.link,
      });
    }

    const runOptions: Record<string, unknown> = { text: segment.text };
    if (segment.bold) {
      runOptions.bold = true;
    }
    if (segment.italic) {
      runOptions.italics = true;
    }
    if (segment.code) {
      runOptions.font = { name: 'Courier New' };
    }
    if (segment.strike) {
      runOptions.strike = true;
    }
    return new TextRun(runOptions as ConstructorParameters<typeof TextRun>[0]);
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

function listItemChildren(text: string): (TextRun | ExternalHyperlink | Math)[] {
  const task = splitTaskItem(text);
  if (!task) {
    return createParagraphChildren(text);
  }
  const mark = new TextRun({ text: task.checked ? '☑ ' : '☐ ' });
  return [mark, ...createParagraphChildren(task.body)];
}

function parseLineToParagraph(trimmed: string): Paragraph | undefined {
  const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
  if (headingMatch) {
    const level = headingMatch[1]?.length ?? 1;
    return new Paragraph({
      heading: getHeadingLevel(level),
      children: createParagraphChildren(headingMatch[2] ?? ''),
    });
  }

  if (isThematicBreak(trimmed)) {
    return new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: 'auto' } },
      spacing: { before: 120, after: 120 },
    });
  }

  return undefined;
}

function docxCell(text: string): TableCell {
  return new TableCell({ children: [new Paragraph({ children: createParagraphChildren(text) })] });
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
    new TableRow({ children: cells.map((cell) => docxCell(cell)) });
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
}

function paragraphFromLines(lines: readonly SourceLine[]): Paragraph {
  const children: (TextRun | ExternalHyperlink | Math)[] = [];
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
  parse.blocks.push(
    new Paragraph({ heading: getHeadingLevel(level), children: createParagraphChildren(text) })
  );
  return true;
}

function appendDocxBodyLine(parse: DocxParse, line: string): void {
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
  const item = source.text.length > 0 && !isThematicBreak(source.text) ? parseListItem(line) : null;
  if (item) {
    flushPendingParagraph(parse);
    parse.blocks.push(listParagraph(item));
    return;
  }
  if (source.text === '') {
    flushPendingParagraph(parse);
    return;
  }
  const special = parseLineToParagraph(source.text);
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
  inCodeBlock: boolean,
  codeLines: string[],
  tableLines: string[],
  quoteLines: string[]
): boolean | null {
  if (!line.trimStart().startsWith('```')) {
    return null;
  }
  flushDocxTable(blocks, tableLines);
  flushDocxQuote(blocks, quoteLines);
  if (inCodeBlock) {
    blocks.push(createCodeBlockParagraph(codeLines));
    codeLines.length = 0;
    return false;
  }
  return true;
}

function parseContentToParagraphs(content: string): (Paragraph | Table)[] {
  const parse: DocxParse = {
    blocks: [],
    pending: [],
    displayLines: null,
    tableLines: [],
    quoteLines: [],
  };
  let inCodeBlock = false;
  const codeLines: string[] = [];

  for (const line of expandLinkReferences(content).split('\n')) {
    const fence = takeDocxFence(
      parse.blocks,
      line,
      inCodeBlock,
      codeLines,
      parse.tableLines,
      parse.quoteLines
    );
    if (fence !== null) {
      flushPendingParagraph(parse);
      inCodeBlock = fence;
      continue;
    }
    if (inCodeBlock) {
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
  if (inCodeBlock && codeLines.length > 0) {
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
      const paragraphs = parseContentToParagraphs(options.content);

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
