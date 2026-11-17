import { writeFile } from 'node:fs/promises';

import { renderDisplayMathBlock, renderMarkdownInline } from './markdown-inline-html';
import { isTableRow, markdownTableToHtml, parseMarkdownTable } from './markdown-table';
import { isThematicBreak } from './markdown-break';
import { readHtmlBlock } from './markdown-html';
import { closesFence, openingFence } from './markdown-fence';
import { setextLevel } from './markdown-setext';
import { expandLinkReferences } from './markdown-reference';
import { joinParagraphHtml, readSourceLine, type SourceLine } from './markdown-paragraph';
import { isLazyQuoteLine, quoteBody, quoteToHtml } from './markdown-quote';
import {
  closeHtmlLists,
  appendHtmlListText,
  isListContinuation,
  parseListItem,
  pushHtmlListItem,
  type HtmlListFrame,
} from './markdown-list';
import { listItemHtml } from './markdown-task';
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
  fence: string | null;
  lists: HtmlListFrame[];
  displayMath: string[] | null;
  tableLines: string[];
  quoteLines: string[];
  listBreak: boolean;
}

function flushPdfParagraph(build: PdfBuild): void {
  if (build.paragraph.length === 0) {
    return;
  }
  build.parts.push(`<p>${joinParagraphHtml(build.paragraph, renderMarkdownInline)}</p>`);
  build.paragraph.length = 0;
}

function closePdfList(build: PdfBuild): void {
  closeHtmlLists(build.parts, build.lists);
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

function consumePdfTable(build: PdfBuild, trimmed: string): boolean {
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
  build.parts.push(quoteToHtml(lines, renderMarkdownInline));
}

function consumePdfQuote(build: PdfBuild, line: string): boolean {
  const body = quoteBody(line);
  if (body !== null) {
    flushPdfParagraph(build);
    closePdfList(build);
    flushPdfTable(build);
    build.quoteLines.push(body);
    return true;
  }
  if (build.quoteLines.length > 0 && isLazyQuoteLine(line)) {
    build.quoteLines.push(line.trim());
    return true;
  }
  if (build.quoteLines.length > 0) {
    flushPdfQuote(build);
  }
  return false;
}

function consumePdfHtml(build: PdfBuild, lines: readonly string[], index: number): number {
  if (build.fence || build.displayMath) {
    return index;
  }
  const block = readHtmlBlock(lines, index);
  if (!block) {
    return index;
  }
  finishDisplayMath(build);
  flushPdfTable(build);
  flushPdfQuote(build);
  flushPdfParagraph(build);
  closePdfList(build);
  build.parts.push(block.html);
  return block.nextIndex;
}

function appendPdfLine(build: PdfBuild, line: string): void {
  if (build.fence) {
    if (closesFence(line, build.fence)) {
      build.parts.push('</code></pre>');
      build.fence = null;
    } else {
      build.parts.push(escapeHtml(line));
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
    build.parts.push('<pre><code>');
    build.fence = marker;
    return;
  }
  const trimmed = line.trim();
  if (consumePdfDisplayMath(build, line)) {
    return;
  }
  if (consumePdfTable(build, trimmed)) {
    return;
  }
  if (consumePdfQuote(build, trimmed)) {
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
  build.parts.push(`<h${level}>${renderMarkdownInline(text)}</h${level}>`);
  return true;
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
  const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
  if (heading) {
    flushPdfParagraph(build);
    closePdfList(build);
    const level = heading[1]?.length ?? 1;
    build.parts.push(`<h${level}>${renderMarkdownInline(heading[2] ?? '')}</h${level}>`);
    return;
  }
  if (trimmed.length === 0) {
    flushPdfParagraph(build);
    if (build.lists.length > 0 && !build.listBreak) {
      build.listBreak = true;
    } else {
      closePdfList(build);
      build.listBreak = false;
    }
    return;
  }
  if (build.listBreak && parseListItem(raw) === null && !isListContinuation(raw)) {
    closePdfList(build);
  }
  build.listBreak = false;
  const item = parseListItem(raw);
  if (item) {
    flushPdfParagraph(build);
    pushHtmlListItem(build.parts, build.lists, item, listItemHtml(item.text, renderMarkdownInline));
    return;
  }
  if (
    build.lists.length > 0 &&
    isListContinuation(raw) &&
    appendHtmlListText(build.parts, renderMarkdownInline(raw.trim()))
  ) {
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
    displayMath: null,
    tableLines: [],
    quoteLines: [],
  };
  const lines = expandLinkReferences(content).split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const htmlEnd = consumePdfHtml(build, lines, index);
    if (htmlEnd > index) {
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
  if (build.fence) {
    build.parts.push('</code></pre>');
  }
  return build.parts.join('\n');
}

function contentToHtml(content: string, title: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      margin: 0;
      padding: 2rem;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      color: #1f2937;
      line-height: 1.6;
    }
    pre { background: #f3f4f6; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    code { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 0.9em; }
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
      const html = contentToHtml(options.content, title);

      win = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: true },
      });

      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      const pdfBuffer = await win.webContents.printToPDF(buildPrintOptions(options));
      await writeFile(options.outputPath, pdfBuffer);

      return { ok: true, outputPath: options.outputPath, warnings };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'PDF export failed',
        warnings,
      };
    } finally {
      if (win && !win.isDestroyed()) {
        win.destroy();
      }
    }
  }
}
