import { Buffer } from 'node:buffer';

import type { DocxExportPresetOptions, PdfExportPresetOptions } from '@shared/types/root';
import { advanceFence } from './export-formats/markdown-fence';
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
}

interface MarkdownImageBlock {
  readonly kind: 'image';
  readonly alt: string;
  readonly src: string;
}

type MarkdownBlock = MarkdownHeadingBlock | MarkdownParagraphBlock | MarkdownImageBlock;

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

function plainInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\((?:[^()]|\([^()]*\))+\)/g, '$1')
    .replace(/\[([^\]]+)\]\((?:[^()]|\([^()]*\))+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<![\w])_(.+?)_(?![\w])/g, '$1')
    .replace(/\*(.+?)\*/g, '$1');
}

function pushTextBlock(blocks: MarkdownBlock[], rawLine: string): void {
  const trimmedLine = rawLine.trim();
  const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmedLine);
  const headingText = headingMatch?.[2]?.trim() ?? '';
  if (headingMatch && headingText.length > 0) {
    blocks.push({
      kind: 'heading',
      level: headingMatch[1]?.length ?? 1,
      text: plainInline(headingText),
    });
    return;
  }

  const imageMatch = /^!\[([^\]]*)\]\(((?:[^()]|\([^()]*\))+)\)\s*$/.exec(trimmedLine);
  if (imageMatch) {
    blocks.push({
      kind: 'image',
      alt: imageMatch[1]?.trim() ?? '',
      src: imageMatch[2]?.trim() ?? '',
    });
    return;
  }

  blocks.push({ kind: 'paragraph', text: plainInline(rawLine) });
}

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = expandLinkReferences(markdown).replaceAll('\r\n', '\n').split('\n');
  let fence: string | null = null;

  for (const rawLine of lines) {
    const next = advanceFence(rawLine, fence);
    const boundary = fence !== next;
    if (fence || next) {
      fence = next;
      if (!boundary) {
        blocks.push({ kind: 'paragraph', text: rawLine });
      }
      continue;
    }
    pushTextBlock(blocks, rawLine);
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
        lines.push(normalizePdfLine(block.text));
        break;
      default:
        break;
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

    paragraphs.push(
      `<w:p><w:r><w:t xml:space="preserve">${escapeXml(block.text)}</w:t></w:r></w:p>`
    );
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
