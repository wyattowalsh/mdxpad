import * as path from 'node:path';

import type {
  ExportFormat,
  ExportSupportEntry,
  FileExportError,
} from '@shared/contracts/file-schemas';

interface ExportSerializationSuccess {
  readonly ok: true;
  readonly content: string;
  readonly warnings: readonly string[];
}

interface ExportSerializationFailure {
  readonly ok: false;
  readonly error: Exclude<FileExportError, { code: 'CANCELLED' | 'WRITE_FAILED' }>;
}

export type ExportSerializationResult = ExportSerializationSuccess | ExportSerializationFailure;

export const EXPORT_SUPPORT_MATRIX: readonly ExportSupportEntry[] = [
  {
    format: 'html',
    label: 'HTML',
    extension: 'html',
    mimeType: 'text/html',
    priority: 1,
    supported: true,
  },
  {
    format: 'markdown',
    label: 'Markdown',
    extension: 'md',
    mimeType: 'text/markdown',
    priority: 2,
    supported: true,
  },
  {
    format: 'mdx',
    label: 'MDX',
    extension: 'mdx',
    mimeType: 'text/mdx',
    priority: 3,
    supported: true,
  },
  {
    format: 'pdf',
    label: 'PDF',
    extension: 'pdf',
    mimeType: 'application/pdf',
    priority: 4,
    supported: true,
  },
  {
    format: 'docx',
    label: 'Word',
    extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    priority: 5,
    supported: true,
  },
  {
    format: 'epub',
    label: 'EPUB',
    extension: 'epub',
    mimeType: 'application/epub+zip',
    priority: 6,
    supported: true,
  },
  {
    format: 'latex',
    label: 'LaTeX',
    extension: 'tex',
    mimeType: 'application/x-latex',
    priority: 7,
    supported: true,
  },
  {
    format: 'pandoc',
    label: 'Pandoc',
    extension: 'html',
    mimeType: 'text/html',
    priority: 8,
    supported: true,
  },
] as const;

function getSupportEntry(format: ExportFormat): ExportSupportEntry {
  const entry = EXPORT_SUPPORT_MATRIX.find((candidate) => candidate.format === format);
  if (!entry) {
    return {
      format,
      label: format.toUpperCase(),
      extension: format,
      mimeType: 'application/octet-stream',
      priority: 99,
      supported: false,
      unsupportedReason: 'Unknown export format',
    };
  }
  return entry;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function buildHtmlBody(content: string): { body: string; hasMermaid: boolean } {
  const sections: string[] = [];
  const mermaidFenceRegex = /```mermaid[^\n]*\n([\s\S]*?)```/gi;
  let cursor = 0;
  let hasMermaid = false;

  for (const match of content.matchAll(mermaidFenceRegex)) {
    const matchIndex = match.index;
    const before = content.slice(cursor, matchIndex);
    const mermaidBodyMatch = match[1];
    if (mermaidBodyMatch === undefined) {
      continue;
    }
    const mermaidBody = mermaidBodyMatch.trim();

    if (before.trim().length > 0) {
      sections.push(`<pre class="mdxpad-export-source">${escapeHtml(before)}</pre>`);
    }

    sections.push(`<pre class="mermaid">${escapeHtml(mermaidBody)}</pre>`);
    hasMermaid = true;
    cursor = matchIndex + match[0].length;
  }

  const remainder = content.slice(cursor);
  if (sections.length === 0 || remainder.trim().length > 0) {
    sections.push(`<pre class="mdxpad-export-source">${escapeHtml(remainder)}</pre>`);
  }

  return { body: sections.join('\n'), hasMermaid };
}

function buildHtmlDocument(content: string): ExportSerializationSuccess {
  const { body, hasMermaid } = buildHtmlBody(content);
  const warnings: string[] = [];

  const mermaidScript = hasMermaid
    ? `
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, securityLevel: 'strict' });
  </script>`
    : '';

  if (hasMermaid) {
    warnings.push('Mermaid diagrams in exported HTML require access to jsdelivr to render.');
  }

  return {
    ok: true,
    warnings,
    content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MDXPad Export</title>
  <style>
    body { margin: 0; padding: 2rem; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1f2937; background: #ffffff; }
    .mdxpad-export-source { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; white-space: pre-wrap; overflow-x: auto; }
    .mermaid { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; }
  </style>
</head>
<body>
${body}
${mermaidScript}
</body>
</html>`,
  };
}

export function getDefaultExportPath(
  sourcePath: string | null | undefined,
  format: ExportFormat
): string {
  const entry = getSupportEntry(format);
  if (!sourcePath) {
    return `untitled.${entry.extension}`;
  }

  const directory = path.dirname(sourcePath);
  const filename = path.basename(sourcePath, path.extname(sourcePath)) || 'untitled';
  return path.join(directory, `${filename}.${entry.extension}`);
}

export function serializeForExport(
  content: string,
  format: ExportFormat
): ExportSerializationResult {
  const support = getSupportEntry(format);
  if (!support.supported) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_FORMAT',
        format,
        message: support.unsupportedReason ?? `Export format "${format}" is not supported`,
      },
    };
  }

  switch (format) {
    case 'markdown':
      return { ok: true, content, warnings: [] };
    case 'mdx':
      return { ok: true, content, warnings: [] };
    case 'html':
      return buildHtmlDocument(content);
    case 'pdf':
    case 'docx':
    case 'epub':
    case 'latex':
    case 'pandoc':
      return {
        ok: false,
        error: {
          code: 'UNSUPPORTED_FORMAT',
          format,
          message: support.unsupportedReason ?? `Export format "${format}" is not supported`,
        },
      };
    default:
      return {
        ok: false,
        error: {
          code: 'UNKNOWN',
          message: `Unhandled export format: ${String(format)}`,
        },
      };
  }
}
