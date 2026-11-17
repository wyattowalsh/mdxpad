import { writeFile } from 'node:fs/promises';

import type { Exporter, ExportOptions, ExportResult } from './types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderInline(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

export function markdownToPdfHtml(content: string): string {
  const parts: string[] = [];
  const paragraph: string[] = [];
  let inCode = false;

  const flushParagraph = (): void => {
    if (paragraph.length === 0) {
      return;
    }
    parts.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph.length = 0;
  };

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      flushParagraph();
      parts.push(inCode ? '</code></pre>' : '<pre><code>');
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      parts.push(escapeHtml(line));
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      const level = heading[1]?.length ?? 1;
      parts.push(`<h${level}>${renderInline(heading[2] ?? '')}</h${level}>`);
      continue;
    }
    if (trimmed.length === 0) {
      flushParagraph();
      continue;
    }
    const item = /^[-*]\s+(.+)$/.exec(trimmed);
    if (item) {
      flushParagraph();
      parts.push(`<ul><li>${renderInline(item[1] ?? '')}</li></ul>`);
      continue;
    }
    paragraph.push(trimmed);
  }

  flushParagraph();
  if (inCode) {
    parts.push('</code></pre>');
  }
  return parts.join('\n');
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
