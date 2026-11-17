import { Buffer } from 'node:buffer';

import { parseAtxHeading } from '@shared/lib/markdown-heading';
import type { DocxExportPresetOptions, PdfExportPresetOptions } from '@shared/types/root';
import { isThematicBreak } from './export-formats/markdown-break';
import { isTableRow, parseMarkdownTable, type TableAlign } from './export-formats/markdown-table';
import { advanceFence, closesFence, openingFence } from './export-formats/markdown-fence';
import {
  openListFence,
  readListFenceLine,
  readListQuoteLine,
  readOpenListQuote,
} from './export-formats/markdown-list-fence';
import {
  isListContinuation,
  listContentColumn,
  parseListItem,
} from './export-formats/markdown-list';
import { isLazyQuoteLine, quoteBody } from './export-formats/markdown-quote';
import { HARD_BREAK, reopenInlineMarks } from './export-formats/markdown-marks';
import { readSourceLine } from './export-formats/markdown-paragraph';
import { decodeHtmlEntities } from './export-formats/markdown-entity';
import { protectEscapes, restoreEscapes } from './export-formats/markdown-escape';
import { MARKDOWN_LINK_INSIDE, linkDestination } from './export-formats/markdown-link';
import { splitTaskItem } from './export-formats/markdown-task';
import { setextLevel } from './export-formats/markdown-setext';
import { prepareMarkdownSource } from '@shared/lib/markdown-math';
import { expandLinkReferences } from './export-formats/markdown-reference';
import { createStoredZip, toUtf8Bytes } from './zip-utils';

interface MarkdownHeadingBlock {
  readonly kind: 'heading';
  readonly level: number;
  readonly text: string;
}

interface MarkdownParagraphBlock {
  readonly kind: 'paragraph';
  readonly text: string;
  readonly setext: boolean;
  readonly quote: boolean;
  readonly listColumn: number | null;
  readonly hardBreak: boolean;
  readonly source: string;
}

interface MarkdownImageBlock {
  readonly kind: 'image';
  readonly alt: string;
  readonly src: string;
}

interface MarkdownTableBlock {
  readonly kind: 'table';
  readonly aligns: readonly TableAlign[];
  readonly rows: readonly (readonly string[])[];
}

type MarkdownBlock =
  | MarkdownHeadingBlock
  | MarkdownParagraphBlock
  | MarkdownImageBlock
  | MarkdownTableBlock;

export interface BuiltPdfDocument {
  readonly content: string;
  readonly warnings: readonly string[];
}

export interface BuiltDocxDocument {
  readonly content: Uint8Array;
  readonly warnings: readonly string[];
}

type PdfPageSize = NonNullable<PdfExportPresetOptions['pageSize']>;

const PDF_PAGE_DIMENSIONS: Record<
  PdfPageSize,
  { readonly width: number; readonly height: number }
> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
};

const DOCX_STYLE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="heading 5"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading6"><w:name w:val="heading 6"/></w:style>
</w:styles>`;

const DOCX_CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

const DOCX_ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function escapePdfText(value: string): string {
  // Escape PDF special characters (backslash, parentheses) while preserving Unicode.
  // PDF 1.4+ supports Unicode text in parenthesized strings.
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function clampHeadingLevel(level: number): number {
  return Math.min(6, Math.max(1, level));
}

const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

function pdfPlainText(value: string): string {
  return value.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (run) => {
    let digits = '';
    for (let index = 0; index < run.length; index += 1) {
      digits += String(SUPERSCRIPT_DIGITS.indexOf(run.charAt(index)));
    }
    return `[${digits}]`;
  });
}

function normalizePdfLine(value: string): string {
  const plain = pdfPlainText(value);
  return plain.trim().length > 0 ? plain : ' ';
}

function wrapPdfLine(line: string, maxChars: number): string[] {
  if (maxChars < 1 || line.length <= maxChars) {
    return [line];
  }
  const wrapped: string[] = [];
  let rest = line;
  while (rest.length > maxChars) {
    const space = rest.lastIndexOf(' ', maxChars);
    const breakAt = space > 0 ? space : maxChars;
    wrapped.push(rest.slice(0, breakAt));
    rest = rest.slice(breakAt).trimStart();
  }
  if (rest.length > 0) {
    wrapped.push(rest);
  }
  return wrapped;
}

function plainFromSource(source: string): string {
  const opened = reopenInlineMarks(source.replaceAll('\n', HARD_BREAK));
  return plainInline(opened.split(HARD_BREAK).join('\n'));
}

function plainListFromSource(source: string): string {
  const pieces = reopenInlineMarks(source.replaceAll('\n', HARD_BREAK)).split(HARD_BREAK);
  const first = pieces[0] ?? '';
  const item = parseListItem(first);
  if (!item) {
    return pieces.map((piece) => plainInline(piece)).join('\n');
  }
  const task = splitTaskItem(item.text);
  const body = [task ? task.body : item.text, ...pieces.slice(1)];
  const plain = body.map((piece) => plainInline(piece)).join('\n');
  const indent = '  '.repeat(item.level);
  if (task) {
    return `${indent}[${task.checked ? 'x' : ' '}] ${plain}`;
  }
  const marker = item.ordered ? `${item.start}.` : '-';
  return `${indent}${marker} ${plain}`;
}

function plainInline(text: string): string {
  const escaped = protectEscapes(text);
  const formatted = decodeHtmlEntities(
    escaped.text
      .replace(
        new RegExp(`!\\[([^\\]]*)\\]\\((${MARKDOWN_LINK_INSIDE})\\)`, 'g'),
        (_match, alt: string, src: string) => {
          const label = alt.trim().length > 0 ? alt : 'image';
          return `${label} (${linkDestination(src)})`;
        }
      )
      .replace(
        new RegExp(`\\[([^\\]]+)\\]\\((${MARKDOWN_LINK_INSIDE})\\)`, 'g'),
        (_match, label: string, href: string) => {
          return `${label} (${linkDestination(href)})`;
        }
      )
      .replace(/`([^`]+)`/g, '$1')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/(?<![\w])_(.+?)_(?![\w])/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
  );
  return restoreEscapes(formatted, escaped.chars, (char) => char);
}

function stripQuoteMarkers(line: string): string {
  let depth = 0;
  let text = line;
  let inner = quoteBody(text);
  while (inner !== null) {
    depth += 1;
    text = inner;
    inner = quoteBody(text);
  }
  if (depth === 0) {
    return line;
  }
  return `${'  '.repeat(depth - 1)}${text}`;
}

function joinContinued(previous: string, hardBreak: boolean, next: string): string {
  return hardBreak ? `${previous}\n${next}` : `${previous} ${next}`;
}

function plainParagraph(rawLine: string): string {
  const quoted = stripQuoteMarkers(readSourceLine(rawLine).text);
  if (isThematicBreak(quoted.trim())) {
    return '----------';
  }
  const item = parseListItem(quoted);
  if (!item) {
    return plainInline(quoted);
  }
  const task = splitTaskItem(item.text);
  const body = plainInline(task ? task.body : item.text);
  const indent = '  '.repeat(item.level);
  if (task) {
    return `${indent}[${task.checked ? 'x' : ' '}] ${body}`;
  }
  if (item.ordered) {
    return `${indent}${item.start}. ${body}`;
  }
  return `${indent}- ${body}`;
}

function pushTextBlock(blocks: MarkdownBlock[], rawLine: string): void {
  const trimmedLine = rawLine.trim();
  const heading = parseAtxHeading(trimmedLine);
  if (heading) {
    blocks.push({
      kind: 'heading',
      level: heading.depth,
      text: plainInline(heading.text),
    });
    return;
  }

  const imageMatch = /^!\[([^\]]*)\]\(((?:[^()]|\([^()]*\))+)\)\s*$/.exec(trimmedLine);
  if (imageMatch) {
    blocks.push({
      kind: 'image',
      alt: imageMatch[1]?.trim() ?? '',
      src: linkDestination(imageMatch[2]?.trim() ?? ''),
    });
    return;
  }

  const source = readSourceLine(rawLine);
  blocks.push({
    kind: 'paragraph',
    text: plainParagraph(rawLine),
    setext: isSetextText(rawLine),
    quote: quoteBody(rawLine) !== null,
    listColumn: listContentColumn(rawLine),
    hardBreak: source.hardBreak,
    source: source.text,
  });
}

function isSetextText(rawLine: string): boolean {
  if (rawLine.trim().length === 0 || setextLevel(rawLine) !== null) {
    return false;
  }
  if (
    isThematicBreak(rawLine.trim()) ||
    quoteBody(rawLine) !== null ||
    parseListItem(rawLine) !== null
  ) {
    return false;
  }
  const indented = rawLine.replaceAll('\t', '    ');
  if (/^\s{4,}/.test(indented) || /^\s{0,3}#{1,6}(?:\s|$)/.test(rawLine)) {
    return false;
  }
  return true;
}

function takeSetextHeading(blocks: MarkdownBlock[], line: string): boolean {
  const level = setextLevel(line);
  if (level === null) {
    return false;
  }
  const body: MarkdownBlock[] = [];
  while (blocks.length > 0) {
    const last = blocks[blocks.length - 1];
    if (last?.kind !== 'paragraph' || !last.setext) {
      break;
    }
    const removed = blocks.pop();
    if (removed) {
      body.unshift(removed);
    }
  }
  const text = body
    .flatMap((block) =>
      block.kind === 'paragraph' ? [block.text.replaceAll('\n', ' ').trim()] : []
    )
    .filter((part) => part.length > 0)
    .join(' ');
  if (text.length === 0) {
    blocks.push(...body);
    return false;
  }
  blocks.push({ kind: 'heading', level, text });
  return true;
}

function tableRow(line: string): string | null {
  const trimmed = line.trim();
  return isTableRow(trimmed) ? trimmed : null;
}

function quotedTableRow(line: string): string | null {
  const body = quoteBody(line);
  return body === null ? null : tableRow(body);
}

function takeMarkdownTable(
  blocks: MarkdownBlock[],
  lines: readonly string[],
  index: number,
  row: (line: string) => string | null = tableRow
): number {
  const first = row(lines[index] ?? '');
  if (first === null) {
    return index;
  }
  const collected = [first];
  let cursor = index + 1;
  while (cursor < lines.length) {
    const next = row(lines[cursor] ?? '');
    if (next === null) {
      break;
    }
    collected.push(next);
    cursor += 1;
  }
  const table = parseMarkdownTable(collected);
  if (!table) {
    return index;
  }
  const rows = [table.headers, ...table.rows].map((cells) =>
    cells.map((cell) => plainInline(cell))
  );
  blocks.push({ kind: 'table', aligns: table.aligns, rows });
  return cursor - 1;
}

function appendBuiltInListContinuation(blocks: MarkdownBlock[], rawLine: string): boolean {
  const last = blocks[blocks.length - 1];
  if (
    last?.kind !== 'paragraph' ||
    last.listColumn === null ||
    !isListContinuation(rawLine, last.listColumn)
  ) {
    return false;
  }
  const source = readSourceLine(rawLine);
  const combined = joinContinued(last.source, last.hardBreak, source.text);
  blocks[blocks.length - 1] = {
    kind: 'paragraph',
    text: plainListFromSource(combined),
    setext: false,
    quote: false,
    listColumn: last.listColumn,
    hardBreak: source.hardBreak,
    source: combined,
  };
  return true;
}

function skipBuiltInListBreak(
  blocks: readonly MarkdownBlock[],
  lines: readonly string[],
  index: number
): boolean {
  if ((lines[index] ?? '').trim().length !== 0) {
    return false;
  }
  const last = blocks[blocks.length - 1];
  if (last?.kind !== 'paragraph' || last.listColumn === null) {
    return false;
  }
  const next = lines[index + 1] ?? '';
  if (!isListContinuation(next, last.listColumn)) {
    return false;
  }
  const trimmed = next.trim();
  return quoteBody(next) !== null || isTableRow(trimmed) || openingFence(next) !== null;
}

function appendBuiltInQuoteContinuation(blocks: MarkdownBlock[], rawLine: string): boolean {
  const last = blocks[blocks.length - 1];
  if (last?.kind !== 'paragraph' || !last.quote) {
    return false;
  }
  const continued = quoteBody(rawLine);
  if (continued !== null && continued.length === 0) {
    blocks[blocks.length - 1] = { ...last, quote: false };
    return true;
  }
  if (continued !== null && (quoteBody(continued) !== null || parseListItem(continued) !== null)) {
    return false;
  }
  const text = continued ?? (isLazyQuoteLine(rawLine) ? rawLine : '');
  const source = readSourceLine(text);
  if (source.text.length === 0) {
    return false;
  }
  const combined = joinContinued(stripQuoteMarkers(last.source), last.hardBreak, source.text);
  blocks[blocks.length - 1] = {
    kind: 'paragraph',
    text: plainFromSource(combined),
    setext: false,
    quote: true,
    listColumn: null,
    hardBreak: source.hardBreak,
    source: combined,
  };
  return true;
}

function appendBuiltInProseContinuation(blocks: MarkdownBlock[], rawLine: string): boolean {
  const last = blocks[blocks.length - 1];
  const trimmed = rawLine.trim();
  if (
    last?.kind !== 'paragraph' ||
    last.quote ||
    last.listColumn !== null ||
    last.source.trim().length === 0 ||
    trimmed.length === 0 ||
    quoteBody(rawLine) !== null ||
    /^!\[[^\]]*\]\(/.test(trimmed) ||
    parseListItem(rawLine) !== null ||
    isThematicBreak(trimmed) ||
    parseAtxHeading(trimmed) !== null ||
    setextLevel(rawLine) !== null ||
    openingFence(rawLine) !== null ||
    isTableRow(trimmed)
  ) {
    return false;
  }
  const source = readSourceLine(rawLine);
  const combined = last.hardBreak
    ? `${last.source}\n${source.text}`
    : `${last.source} ${source.text}`;
  blocks[blocks.length - 1] = {
    ...last,
    source: combined,
    text: plainFromSource(combined),
    hardBreak: source.hardBreak,
  };
  return true;
}

function pushRawLine(blocks: MarkdownBlock[], text: string, quote = false): void {
  blocks.push({
    kind: 'paragraph',
    text,
    setext: false,
    quote,
    listColumn: null,
    hardBreak: false,
    source: text,
  });
}

function takeQuotedFence(
  blocks: MarkdownBlock[],
  rawLine: string,
  marker: { current: string | null }
): boolean {
  if (marker.current) {
    const body = quoteBody(rawLine);
    if (body === null) {
      marker.current = null;
      return false;
    }
    if (closesFence(body, marker.current)) {
      marker.current = null;
    }
    pushRawLine(blocks, body, true);
    return true;
  }
  const body = quoteBody(rawLine);
  if (body === null) {
    return false;
  }
  const opener = openingFence(body);
  if (!opener) {
    return false;
  }
  marker.current = opener;
  pushRawLine(blocks, body, true);
  return true;
}

function takeBuiltInListFence(
  blocks: MarkdownBlock[],
  lines: readonly string[],
  index: number
): number {
  const last = blocks[blocks.length - 1];
  if (last?.kind !== 'paragraph' || last.listColumn === null) {
    return index;
  }
  const opened = openListFence(lines[index] ?? '', last.listColumn);
  if (!opened) {
    return index;
  }
  const fence = {
    marker: opened.marker,
    language: opened.language,
    indent: opened.indent,
    lines: [],
  };
  let cursor = index + 1;
  while (
    cursor < lines.length &&
    readListFenceLine(fence, lines[cursor] ?? '', last.listColumn) === 'open'
  ) {
    cursor += 1;
  }
  if (cursor < lines.length) {
    cursor += 1;
  }
  for (const codeLine of fence.lines) {
    pushRawLine(blocks, codeLine);
  }
  return Math.max(index, cursor - 1);
}

function takeBuiltInListQuote(
  blocks: MarkdownBlock[],
  lines: readonly string[],
  index: number
): number {
  const last = blocks[blocks.length - 1];
  if (last?.kind !== 'paragraph' || last.listColumn === null) {
    return index;
  }
  const opened = readOpenListQuote(lines[index] ?? '', last.listColumn);
  if (opened === null) {
    return index;
  }
  pushRawLine(blocks, opened, true);
  let cursor = index + 1;
  while (cursor < lines.length) {
    const text = readListQuoteLine(lines[cursor] ?? '', last.listColumn);
    if (text === null) {
      break;
    }
    pushRawLine(blocks, text, true);
    cursor += 1;
  }
  return Math.max(index, cursor - 1);
}

function takeBuilderFenceLine(
  blocks: MarkdownBlock[],
  lines: readonly string[],
  index: number,
  fence: string | null,
  quoteFence: { current: string | null }
): number | null {
  if (fence) {
    return null;
  }
  if (takeQuotedFence(blocks, lines[index] ?? '', quoteFence)) {
    return index;
  }
  const nested = takeBuiltInListFence(blocks, lines, index);
  if (nested > index) {
    return nested;
  }
  const quoted = takeBuiltInListQuote(blocks, lines, index);
  return quoted > index ? quoted : null;
}

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = expandLinkReferences(prepareMarkdownSource(markdown))
    .replaceAll('\r\n', '\n')
    .split('\n');
  let fence: string | null = null;
  const quoteFence = { current: null as string | null };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? '';
    const consumed = takeBuilderFenceLine(blocks, lines, index, fence, quoteFence);
    if (consumed !== null) {
      index = consumed;
      continue;
    }
    const next = advanceFence(rawLine, fence);
    const boundary = fence !== next;
    if (fence || next) {
      fence = next;
      if (!boundary) {
        pushRawLine(blocks, rawLine);
      }
      continue;
    }
    const quotedTableEnd = takeMarkdownTable(blocks, lines, index, quotedTableRow);
    const tableEnd =
      quotedTableEnd > index ? quotedTableEnd : takeMarkdownTable(blocks, lines, index);
    if (tableEnd > index) {
      index = tableEnd;
      continue;
    }
    if (skipBuiltInListBreak(blocks, lines, index)) {
      continue;
    }
    if (
      appendBuiltInListContinuation(blocks, rawLine) ||
      appendBuiltInQuoteContinuation(blocks, rawLine) ||
      appendBuiltInProseContinuation(blocks, rawLine)
    ) {
      continue;
    }
    if (!takeSetextHeading(blocks, rawLine)) {
      pushTextBlock(blocks, rawLine);
    }
  }

  return blocks;
}

function toPdfLines(blocks: readonly MarkdownBlock[]): string[] {
  const lines: string[] = [];
  for (const block of blocks) {
    switch (block.kind) {
      case 'heading':
        lines.push(normalizePdfLine(block.text.toUpperCase()));
        lines.push(' ');
        break;
      case 'image':
        lines.push(normalizePdfLine(`[Image] ${block.alt} (${block.src})`));
        break;
      case 'paragraph':
        for (const part of block.text.split('\n')) {
          lines.push(normalizePdfLine(part));
        }
        break;
      case 'table':
        for (const row of block.rows) {
          lines.push(normalizePdfLine(row.join(' | ')));
        }
        lines.push(' ');
        break;
      default: {
        const exhaustive: never = block;
        lines.push(exhaustive);
        break;
      }
    }
  }
  return lines.length > 0 ? lines : [' '];
}

function chunkLines(lines: readonly string[], chunkSize: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < lines.length; index += chunkSize) {
    chunks.push(lines.slice(index, index + chunkSize));
  }
  return chunks.length > 0 ? chunks : [[' ']];
}

function formatPdfDate(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  const hour = `${date.getUTCHours()}`.padStart(2, '0');
  const minute = `${date.getUTCMinutes()}`.padStart(2, '0');
  const second = `${date.getUTCSeconds()}`.padStart(2, '0');
  return `D:${year}${month}${day}${hour}${minute}${second}Z`;
}

function serializePdf(objects: ReadonlyMap<number, string>, infoObjectId: number): string {
  // Use iterative max to avoid stack overflow on large documents with many PDF objects
  const highestObjectId = [...objects.keys()].reduce((max, val) => Math.max(max, val), 0);
  const offsets = new Array<number>(highestObjectId + 1).fill(0);
  let output = '%PDF-1.4\n';

  for (let objectId = 1; objectId <= highestObjectId; objectId += 1) {
    const objectBody = objects.get(objectId);
    if (!objectBody) {
      continue;
    }

    offsets[objectId] = Buffer.byteLength(output, 'utf-8');
    output += `${objectId} 0 obj\n${objectBody}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(output, 'utf-8');
  output += `xref\n0 ${highestObjectId + 1}\n`;
  output += '0000000000 65535 f \n';

  for (let objectId = 1; objectId <= highestObjectId; objectId += 1) {
    output += `${(offsets[objectId] ?? 0).toString().padStart(10, '0')} 00000 n \n`;
  }

  output += `trailer\n<< /Size ${highestObjectId + 1} /Root 1 0 R /Info ${infoObjectId} 0 R >>\n`;
  output += `startxref\n${xrefOffset}\n%%EOF`;
  return output;
}

function createPdfPageObjects(
  pageChunks: readonly string[][],
  dimensions: { readonly width: number; readonly height: number },
  marginPoints: number,
  fontSize: number,
  lineHeight: number
): {
  readonly objects: Map<number, string>;
  readonly pageObjectIds: number[];
  readonly nextObjectId: number;
} {
  const objects = new Map<number, string>();
  const pageObjectIds: number[] = [];
  let nextObjectId = 4;

  for (const lines of pageChunks) {
    const pageObjectId = nextObjectId;
    const contentObjectId = nextObjectId + 1;
    nextObjectId += 2;
    pageObjectIds.push(pageObjectId);

    const streamLines = [
      'BT',
      `/F1 ${fontSize.toFixed(2)} Tf`,
      `${lineHeight.toFixed(2)} TL`,
      `${marginPoints.toFixed(2)} ${(dimensions.height - marginPoints).toFixed(2)} Td`,
      ...lines.flatMap((line) => [`(${escapePdfText(line)}) Tj`, 'T*']),
      'ET',
    ];
    const streamContent = streamLines.join('\n');
    objects.set(
      contentObjectId,
      `<< /Length ${Buffer.byteLength(streamContent, 'utf-8')} >>\nstream\n${streamContent}\nendstream`
    );
    objects.set(
      pageObjectId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${dimensions.width.toFixed(2)} ${dimensions.height.toFixed(2)}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );
  }

  return { objects, pageObjectIds, nextObjectId };
}

export function buildPdfDocument(
  markdown: string,
  options: PdfExportPresetOptions = {}
): BuiltPdfDocument {
  const warnings: string[] = [];
  const pageSize = options.pageSize ?? 'A4';
  const dimensions = PDF_PAGE_DIMENSIONS[pageSize];
  const marginPoints = (options.marginInches ?? 1) * 72;
  const fontSize = options.fontSizePt ?? 11;
  const lineHeight = Math.max(fontSize * 1.35, 12);
  const usableHeight = Math.max(dimensions.height - marginPoints * 2, lineHeight);
  const usableWidth = Math.max(dimensions.width - marginPoints * 2, fontSize);
  const maxChars = Math.max(20, Math.floor(usableWidth / (fontSize * 0.5)));
  const maxLinesPerPage = Math.max(1, Math.floor(usableHeight / lineHeight));
  const blocks = parseMarkdownBlocks(markdown);

  if (options.fontFamily && options.fontFamily.toLowerCase() !== 'helvetica') {
    warnings.push('Built-in PDF export currently uses Helvetica for rendering.');
  }

  const pageChunks = chunkLines(
    toPdfLines(blocks).flatMap((line) => wrapPdfLine(line, maxChars)),
    maxLinesPerPage
  );
  const { objects, pageObjectIds, nextObjectId } = createPdfPageObjects(
    pageChunks,
    dimensions,
    marginPoints,
    fontSize,
    lineHeight
  );
  const infoObjectId = nextObjectId;
  const title = escapePdfText(options.title ?? 'MDXPad Export');
  const author = escapePdfText(options.author ?? 'MDXPad');
  const subject = escapePdfText(options.subject ?? 'MDXPad Document Export');
  const pageReferences = pageObjectIds.map((id) => `${id} 0 R`).join(' ');

  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(2, `<< /Type /Pages /Kids [${pageReferences}] /Count ${pageObjectIds.length} >>`);
  objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.set(
    infoObjectId,
    `<< /Title (${title}) /Author (${author}) /Subject (${subject}) /Creator (MDXPad) /Producer (MDXPad) /CreationDate (${formatPdfDate()}) >>`
  );

  return {
    content: serializePdf(objects, infoObjectId),
    warnings,
  };
}

function buildDocxCoreProperties(options: DocxExportPresetOptions): string {
  const title = escapeXml(options.title ?? 'MDXPad Export');
  const author = escapeXml(options.author ?? 'MDXPad');
  const timestamp = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${title}</dc:title>
  <dc:creator>${author}</dc:creator>
  <cp:lastModifiedBy>MDXPad</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>
</cp:coreProperties>`;
}

function docxTable(block: MarkdownTableBlock): string {
  const rows = block.rows.map((row) => {
    const cells = row.map((cell, index) => {
      const align = block.aligns[index] ?? 'left';
      const alignment = align === 'left' ? '' : `<w:pPr><w:jc w:val="${align}"/></w:pPr>`;
      return `<w:tc><w:p>${alignment}<w:r><w:t xml:space="preserve">${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`;
    });
    return `<w:tr>${cells.join('')}</w:tr>`;
  });
  return `<w:tbl>${rows.join('')}</w:tbl>`;
}

function docxTextRuns(text: string): string {
  return text
    .split('\n')
    .map((part, index) => {
      const breakRun = index > 0 ? '<w:br/>' : '';
      return `${breakRun}<w:r><w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>`;
    })
    .join('');
}

function renderDocxParagraphs(
  blocks: readonly MarkdownBlock[],
  options: DocxExportPresetOptions,
  warnings: string[]
): string[] {
  const paragraphs: string[] = [];
  const headingBaseLevel = clampHeadingLevel(options.headingBaseLevel ?? 1);

  if (options.includeToc) {
    paragraphs.push('<w:p><w:r><w:t>Table of Contents</w:t></w:r></w:p>');
  }

  for (const block of blocks) {
    if (block.kind === 'heading') {
      const styleLevel = clampHeadingLevel(headingBaseLevel + block.level - 1);
      paragraphs.push(
        `<w:p><w:pPr><w:pStyle w:val="Heading${styleLevel}"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(block.text)}</w:t></w:r></w:p>`
      );
      continue;
    }

    if (block.kind === 'table') {
      paragraphs.push(docxTable(block));
      continue;
    }

    if (block.kind === 'image') {
      if (options.embedImages) {
        warnings.push(
          `Image embedding is not available in built-in DOCX export; inlining "${block.src}" as text.`
        );
      }
      const label = block.alt.length > 0 ? block.alt : 'image';
      paragraphs.push(
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(`[Image] ${label} (${block.src})`)}</w:t></w:r></w:p>`
      );
      continue;
    }

    paragraphs.push(`<w:p>${docxTextRuns(block.text)}</w:p>`);
  }

  return paragraphs;
}

function createDocxDocumentXml(paragraphs: readonly string[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

export function buildDocxDocument(
  markdown: string,
  options: DocxExportPresetOptions = {}
): BuiltDocxDocument {
  const warnings: string[] = [];
  const blocks = parseMarkdownBlocks(markdown);
  const paragraphs = renderDocxParagraphs(blocks, options, warnings);
  const documentXml = createDocxDocumentXml(paragraphs);
  const archive = createStoredZip([
    { name: '[Content_Types].xml', content: toUtf8Bytes(DOCX_CONTENT_TYPES_XML) },
    { name: '_rels/.rels', content: toUtf8Bytes(DOCX_ROOT_RELS_XML) },
    { name: 'word/document.xml', content: toUtf8Bytes(documentXml) },
    { name: 'word/styles.xml', content: toUtf8Bytes(DOCX_STYLE_XML) },
    { name: 'docProps/core.xml', content: toUtf8Bytes(buildDocxCoreProperties(options)) },
  ]);

  return {
    content: archive,
    warnings,
  };
}
