import type { ExportSupportEntry } from '@shared/contracts/file-schemas';

import type { Exporter } from './types';
import { PdfExporter } from './pdf-exporter';
import { DocxExporter } from './docx-exporter';
import { EpubExporter } from './epub-exporter';
import { LatexExporter } from './latex-exporter';
import { PandocRawExporter } from './pandoc-bridge';

export type { Exporter, ExportOptions, ExportResult } from './types';
export { PdfExporter } from './pdf-exporter';
export { DocxExporter } from './docx-exporter';
export { EpubExporter } from './epub-exporter';
export { LatexExporter } from './latex-exporter';
export { PandocBridge, PandocRawExporter } from './pandoc-bridge';
export { detectPandoc, clearPandocCache } from './pandoc-detector';
export type { PandocDetectionResult } from './pandoc-detector';

const EXPORTERS: readonly Exporter[] = [
  new PdfExporter(),
  new DocxExporter(),
  new EpubExporter(),
  new LatexExporter(),
  new PandocRawExporter(),
];

const EXPORTER_MAP = new Map<string, Exporter>(EXPORTERS.map((e) => [e.format, e]));

export function getExporter(format: string): Exporter | undefined {
  return EXPORTER_MAP.get(format);
}

export function getAllExporters(): Exporter[] {
  return [...EXPORTERS];
}

export function getNewExportSupportEntries(): ExportSupportEntry[] {
  return [
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
      format: 'epub' as ExportSupportEntry['format'],
      label: 'EPUB',
      extension: 'epub',
      mimeType: 'application/epub+zip',
      priority: 6,
      supported: true,
    },
    {
      format: 'latex' as ExportSupportEntry['format'],
      label: 'LaTeX',
      extension: 'tex',
      mimeType: 'application/x-latex',
      priority: 7,
      supported: true,
    },
    {
      format: 'pandoc' as ExportSupportEntry['format'],
      label: 'Pandoc (Custom)',
      extension: 'txt',
      mimeType: 'application/octet-stream',
      priority: 8,
      supported: true,
      unsupportedReason: undefined,
    },
  ];
}
