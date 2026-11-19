import { writeRegularFile } from './write-regular-file';

import { PdfExportPresetOptionsSchema } from '@shared/types/root';
import { buildPdfDocument } from '../export-document-builders';

import { allocateHeadingSlug, headingTag, parseAtxHeading } from '@shared/lib/markdown-heading';
import { prepareMarkdownSource } from '@shared/lib/markdown-math';

import { inlineLocalImages } from './export-image';
import { omitLocalMarkdownTargets } from './omit-local-markdown-targets';
import { CODE_HIGHLIGHT_CSS, renderFencedCode } from './markdown-code';
import { renderDisplayMathBlock, renderMarkdownInline } from './markdown-inline-html';
import { isTableRow, markdownTableToHtml, parseMarkdownTable } from './markdown-table';
import { isThematicBreak } from './markdown-break';
import { readHtmlBlock } from './markdown-html';
import { sanitizeExportedHtml } from './markdown-export-address';
import { closesFence, fenceLanguage, openingFence } from './markdown-fence';
import { setextLevel } from './markdown-setext';
import { expandLinkReferences } from './markdown-reference';
import { htmlFootnoteMarkers } from './markdown-footnote';
import { joinParagraphHtml, readSourceLine, type SourceLine } from './markdown-paragraph';
import { isLazyQuoteLine, quoteBody, quoteMarkerLine, quoteToHtml } from './markdown-quote';
import {
  closeHtmlLists,
  continuesList,
  LIST_MARKER_CSS,
  isListContinuation,
  listContentColumn,
  parseListItem,
  pushHtmlListItem,
  shouldOpenListItem,
  type MarkdownListItem,
  type HtmlListFrame,
} from './markdown-list';
import {
  breakListParagraph,
  continueOpenList,
  finishListItemFence,
  openListItem,
  resetListItem,
  takeListItemCode,
  takeListItemFence,
  takeListItemRule,
  takeListItemSetext,
  takeListItemMath,
  takeListItemQuote,
  takeListItemTable,
} from './markdown-list-fence';
import type { Exporter, ExportOptions, ExportResult } from './types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

interface PdfBuild {
  parts: string[];
  paragraph: SourceLine[];
  fence: { marker: string; language: string; lines: string[] } | null;
  lists: HtmlListFrame[];
  displayMath: string[] | null;
  tableLines: string[];
  quoteLines: string[];
  listBreak: boolean;
  listLines: SourceLine[];
  listColumn: number | null;
  itemHtml: string;
  itemFence: { marker: string; language: string; indent: number; lines: string[] } | null;
  itemQuote: string[] | null;
  itemTable: string[] | null;
  itemMath: string[] | null;
  itemCode: string[] | null;
  loose: boolean;
  slugCounts: Map<string, number>;
}

function flushPdfParagraph(build: PdfBuild): void {
  if (build.paragraph.length === 0) {
    return;
  }
  build.parts.push(`<p>${joinParagraphHtml(build.paragraph, renderMarkdownInline)}</p>`);
  build.paragraph.length = 0;
}

function closePdfList(build: PdfBuild): void {
  finishListItemFence(build, renderMarkdownInline);
  closeHtmlLists(build.parts, build.lists);
  build.listColumn = null;
  build.itemHtml = '';
  build.listLines = [];
  build.itemFence = null;
  build.itemQuote = null;
  build.itemTable = null;
  build.itemMath = null;
  build.itemCode = null;
}

function finishDisplayMath(build: PdfBuild): void {
  if (!build.displayMath) {
    return;
  }
  build.parts.push(renderDisplayMathBlock(build.displayMath));
  build.displayMath = null;
}

function consumePdfDisplayMath(build: PdfBuild, line: string): boolean {
  if (build.fence) {
    return false;
  }
  if (takeListItemMath(build, line, renderMarkdownInline, build.lists.length > 0)) {
    return true;
  }
  const trimmed = line.trim();
  if (trimmed === '$$') {
    flushPdfParagraph(build);
    flushPdfTable(build);
    flushPdfQuote(build);
    closePdfList(build);
    if (build.displayMath) {
      finishDisplayMath(build);
    } else {
      build.displayMath = [];
    }
    return true;
  }
  if (build.displayMath) {
    build.displayMath.push(line);
    return true;
  }
  return false;
}

function flushPdfTable(build: PdfBuild): void {
  if (build.tableLines.length === 0) {
    return;
  }
  const lines = build.tableLines.splice(0, build.tableLines.length);
  const table = parseMarkdownTable(lines);
  if (!table) {
    for (const line of lines) {
      build.paragraph.push({ text: line, hardBreak: false });
    }
    flushPdfParagraph(build);
    return;
  }
  build.parts.push(markdownTableToHtml(table, renderMarkdownInline));
}

function consumePdfTable(build: PdfBuild, line: string): boolean {
  if (takeListItemTable(build, line, renderMarkdownInline, build.lists.length > 0)) {
    return true;
  }
  const trimmed = line.trim();
  if (isTableRow(trimmed)) {
    flushPdfParagraph(build);
    closePdfList(build);
    build.tableLines.push(trimmed);
    return true;
  }
  if (build.tableLines.length > 0) {
    flushPdfTable(build);
  }
  return false;
}

function flushPdfQuote(build: PdfBuild): void {
  if (build.quoteLines.length === 0) {
    return;
  }
  const lines = build.quoteLines.splice(0, build.quoteLines.length);
  build.parts.push(quoteToHtml(lines, renderMarkdownInline, build.slugCounts));
}

function consumePdfQuote(build: PdfBuild, line: string): boolean {
  if (takeListItemQuote(build, line, renderMarkdownInline, build.lists.length > 0)) {
    return true;
  }
  const body = quoteBody(line);
  if (body !== null) {
    flushPdfParagraph(build);
    closePdfList(build);
    flushPdfTable(build);
    build.quoteLines.push(quoteMarkerLine(body));
    return true;
  }
  if (build.quoteLines.length > 0 && isLazyQuoteLine(line)) {
    build.quoteLines.push(line);
    return true;
  }
  if (build.quoteLines.length > 0) {
    flushPdfQuote(build);
  }
  return false;
}

function consumePdfHtml(build: PdfBuild, lines: readonly string[], index: number): number | null {
  if (build.fence || build.displayMath) {
    return null;
  }
  const block = readHtmlBlock(lines, index);
  if (!block) {
    return null;
  }
  finishDisplayMath(build);
  flushPdfTable(build);
  flushPdfQuote(build);
  flushPdfParagraph(build);
  closePdfList(build);
  build.parts.push(sanitizeExportedHtml(block.html));
  return block.nextIndex;
}

function flushPdfFence(build: PdfBuild): void {
  if (!build.fence) {
    return;
  }
  build.parts.push(renderFencedCode(build.fence.language, build.fence.lines));
  build.fence = null;
}

function appendPdfLine(build: PdfBuild, line: string): void {
  if (
    takeListItemCode(build, line, renderMarkdownInline, build.lists.length > 0) ||
    takeListItemSetext(
      build,
      line,
      (level, text) => pdfHeading(build, level, text),
      build.lists.length > 0
    ) ||
    takeListItemRule(build, line, renderMarkdownInline, build.lists.length > 0)
  ) {
    return;
  }
  if (takeListItemFence(build, line, renderMarkdownInline, build.lists.length > 0)) {
    return;
  }
  if (build.fence) {
    if (closesFence(line, build.fence.marker)) {
      flushPdfFence(build);
    } else {
      build.fence.lines.push(line);
    }
    return;
  }
  const marker = openingFence(line);
  if (marker) {
    finishDisplayMath(build);
    flushPdfTable(build);
    flushPdfQuote(build);
    flushPdfParagraph(build);
    closePdfList(build);
    build.fence = { marker, language: fenceLanguage(line), lines: [] };
    return;
  }
  if (consumePdfDisplayMath(build, line)) {
    return;
  }
  if (consumePdfTable(build, line)) {
    return;
  }
  if (consumePdfQuote(build, line)) {
    return;
  }
  appendPdfFlow(build, line);
}

function takePdfSetext(build: PdfBuild, raw: string): boolean {
  const level = setextLevel(raw);
  if (level === null || build.paragraph.length === 0) {
    return false;
  }
  const text = build.paragraph.map((line) => line.text).join(' ');
  build.paragraph.length = 0;
  closePdfList(build);
  build.parts.push(pdfHeading(build, level, text));
  return true;
}

function takePdfListBreak(build: PdfBuild, raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    flushPdfParagraph(build);
    if (build.lists.length > 0) {
      if (!build.listBreak) {
        breakListParagraph(build, renderMarkdownInline);
        build.listBreak = true;
      }
    } else {
      closePdfList(build);
      build.listBreak = false;
    }
    return true;
  }
  if (
    build.listBreak &&
    parseListItem(raw) === null &&
    !isListContinuation(raw, build.listColumn ?? 2) &&
    !continuesList(build.lists, raw)
  ) {
    closePdfList(build);
    build.listBreak = false;
  }
  return false;
}

function pdfHeading(build: PdfBuild, depth: number, text: string): string {
  return headingTag(depth, renderMarkdownInline(text), allocateHeadingSlug(text, build.slugCounts));
}

function startPdfListItem(build: PdfBuild, raw: string, item: MarkdownListItem): void {
  const heading = parseAtxHeading(item.text);
  const column = listContentColumn(raw) ?? 2;
  if (heading) {
    resetListItem(build);
    build.listColumn = column;
    build.loose = true;
    build.itemHtml = pdfHeading(build, heading.depth, heading.text);
    pushHtmlListItem(build.parts, build.lists, item, build.itemHtml, column, build.listBreak);
    build.loose = build.lists[build.lists.length - 1]?.loose === true;
    return;
  }
  const separated = build.listBreak;
  const html = openListItem(
    build,
    raw,
    item.text,
    readSourceLine(raw).hardBreak,
    listContentColumn(raw) ?? 2,
    renderMarkdownInline
  );
  pushHtmlListItem(build.parts, build.lists, item, html, listContentColumn(raw) ?? 2, separated);
  build.loose = build.lists[build.lists.length - 1]?.loose === true;
}

function continuePdfListItem(build: PdfBuild, raw: string): boolean {
  return continueOpenList(build.parts, build.lists, build, raw, renderMarkdownInline);
}

function appendPdfFlow(build: PdfBuild, raw: string): void {
  const trimmed = raw.trim();
  if (takePdfSetext(build, raw)) {
    return;
  }
  if (isThematicBreak(trimmed)) {
    flushPdfParagraph(build);
    closePdfList(build);
    build.parts.push('<hr />');
    return;
  }
  const heading = parseAtxHeading(trimmed);
  if (heading) {
    flushPdfParagraph(build);
    closePdfList(build);
    build.parts.push(pdfHeading(build, heading.depth, heading.text));
    return;
  }
  if (takePdfListBreak(build, raw)) {
    return;
  }
  const item = parseListItem(raw);
  if (item && shouldOpenListItem(item, build.lists, build.listBreak, build.paragraph.length > 0)) {
    flushPdfParagraph(build);
    startPdfListItem(build, raw, item);
    return;
  }
  if (continuePdfListItem(build, raw)) {
    return;
  }
  closePdfList(build);
  build.paragraph.push(readSourceLine(raw));
}

export function markdownToPdfHtml(content: string): string {
  const build: PdfBuild = {
    parts: [],
    paragraph: [],
    fence: null,
    lists: [],
    listBreak: false,
    listLines: [],
    listColumn: null,
    itemHtml: '',
    itemFence: null,
    itemQuote: null,
    itemTable: null,
    itemMath: null,
    itemCode: null,
    loose: false,
    displayMath: null,
    tableLines: [],
    quoteLines: [],
    slugCounts: new Map<string, number>(),
  };
  const lines = expandLinkReferences(prepareMarkdownSource(content, { preserveHtml: true })).split(
    '\n'
  );
  for (let index = 0; index < lines.length; index += 1) {
    const htmlEnd = consumePdfHtml(build, lines, index);
    if (htmlEnd !== null) {
      index = htmlEnd;
      continue;
    }
    appendPdfLine(build, lines[index] ?? '');
  }
  finishDisplayMath(build);
  flushPdfTable(build);
  flushPdfQuote(build);
  flushPdfParagraph(build);
  closePdfList(build);
  flushPdfFence(build);
  return htmlFootnoteMarkers(build.parts.join('\n'));
}

const PDF_FONT_FAMILY = /^[A-Za-z0-9 ,.'"-]{1,80}$/;
const DEFAULT_PDF_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

function pdfFontFamily(metadata: Record<string, unknown> | undefined): string {
  const value = metadata?.fontFamily;
  return typeof value === 'string' && PDF_FONT_FAMILY.test(value) ? value : DEFAULT_PDF_FONT;
}

function pdfFontSize(metadata: Record<string, unknown> | undefined): string {
  const value = metadata?.fontSizePt;
  return typeof value === 'number' && value >= 8 && value <= 24 ? `${value}pt` : '11pt';
}

function contentToHtml(content: string, title: string, metadata?: Record<string, unknown>): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      margin: 0;
      padding: 2rem;
      font-family: ${pdfFontFamily(metadata)};
      font-size: ${pdfFontSize(metadata)};
      color: #1f2937;
      line-height: 1.6;
    }
    pre { background: #f3f4f6; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    code { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 0.9em; }
    ${CODE_HIGHLIGHT_CSS}
    ${LIST_MARKER_CSS}
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
    blockquote { border-left: 3px solid #d1d5db; margin: 1rem 0; padding-left: 1rem; }
    table { border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid #d1d5db; padding: 0.4rem 0.6rem; text-align: left; }
  </style>
</head>
<body>
${markdownToPdfHtml(content)}
</body>
</html>`;
}

interface PdfMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function resolveMargins(options: ExportOptions): PdfMargins {
  const meta = options.metadata ?? {};
  const margins = meta.margins as Partial<PdfMargins> | undefined;
  return {
    top: margins?.top ?? 0.4,
    right: margins?.right ?? 0.4,
    bottom: margins?.bottom ?? 0.4,
    left: margins?.left ?? 0.4,
  };
}

function resolveLandscape(options: ExportOptions): boolean {
  const meta = options.metadata ?? {};
  return (meta.landscape as boolean | undefined) ?? false;
}

function resolvePageSize(options: ExportOptions): { width: number; height: number } | undefined {
  const meta = options.metadata ?? {};
  const pageSize = meta.pageSize as string | undefined;
  switch (pageSize) {
    case 'Letter':
      return { width: 215_900, height: 279_400 };
    case 'Legal':
      return { width: 215_900, height: 355_600 };
    case 'A4':
      return { width: 210_000, height: 297_000 };
    default:
      return undefined;
  }
}

function buildPrintOptions(options: ExportOptions): Electron.PrintToPDFOptions {
  const margins = resolveMargins(options);
  const landscape = resolveLandscape(options);
  const pageSize = resolvePageSize(options);

  const printOptions: Electron.PrintToPDFOptions = {
    printBackground: true,
    landscape,
    margins: {
      top: margins.top,
      bottom: margins.bottom,
      left: margins.left,
      right: margins.right,
    },
  };

  if (pageSize) {
    printOptions.pageSize = pageSize;
  }

  return printOptions;
}

const TEXT_PDF_WARNING = 'PDF print was unavailable, so a text PDF was written.';

function textPdfPreset(options: ExportOptions) {
  const meta = options.metadata ?? {};
  const pageSize = meta.pageSize;
  const margins = meta.margins;
  const marginInches =
    margins !== null && typeof margins === 'object' && 'top' in margins
      ? (margins as { top?: unknown }).top
      : undefined;
  const parsed = PdfExportPresetOptionsSchema.safeParse({
    ...(pageSize === 'A4' || pageSize === 'Letter' ? { pageSize } : {}),
    ...(typeof meta.fontSizePt === 'number' ? { fontSizePt: meta.fontSizePt } : {}),
    ...(typeof meta.fontFamily === 'string' ? { fontFamily: meta.fontFamily } : {}),
    ...(typeof meta.subject === 'string' ? { subject: meta.subject } : {}),
    ...(typeof marginInches === 'number' ? { marginInches } : {}),
    ...(options.title ? { title: options.title } : {}),
    ...(options.author ? { author: options.author } : {}),
  });
  return parsed.success ? parsed.data : {};
}

async function writeTextPdf(options: ExportOptions): Promise<ExportResult> {
  const parsed = textPdfPreset(options);
  const built = buildPdfDocument(options.content, parsed);
  await writeRegularFile(options.outputPath, built.content);
  return {
    ok: true,
    outputPath: options.outputPath,
    warnings: [...built.warnings, TEXT_PDF_WARNING],
  };
}

function confinePrintNavigation(contents: { on?: unknown }): void {
  if (typeof contents.on !== 'function') {
    return;
  }
  const listen = contents.on as (
    event: string,
    listener: (event: { preventDefault: () => void }) => void
  ) => void;
  const deny = (event: { preventDefault: () => void }): void => {
    event.preventDefault();
  };
  listen('will-navigate', deny);
  listen('will-redirect', deny);
}

export class PdfExporter implements Exporter {
  readonly format = 'pdf';
  readonly label = 'PDF';
  readonly extension = 'pdf';
  readonly mimeType = 'application/pdf';

  async export(options: ExportOptions): Promise<ExportResult> {
    const warnings: string[] = [];
    const { BrowserWindow } = await import('electron');
    let win: InstanceType<typeof BrowserWindow> | undefined;

    try {
      const title = options.title ?? 'MDXPad Export';
      const inlined = await inlineLocalImages(options.content, options.sourcePath, 'document');
      const content = omitLocalMarkdownTargets(inlined, options.sourcePath);
      const html = contentToHtml(content, title, options.metadata);

      win = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: {
          offscreen: true,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
          javascript: false,
        },
      });
      confinePrintNavigation(win.webContents);

      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      const pdfBuffer = await win.webContents.printToPDF(buildPrintOptions(options));
      await writeRegularFile(options.outputPath, pdfBuffer);

      return { ok: true, outputPath: options.outputPath, warnings };
    } catch {
      try {
        return await writeTextPdf(options);
      } catch (fallbackError: unknown) {
        return {
          ok: false,
          error: fallbackError instanceof Error ? fallbackError.message : 'PDF export failed',
          warnings,
        };
      }
    } finally {
      if (win && !win.isDestroyed()) {
        win.destroy();
      }
    }
  }
}
