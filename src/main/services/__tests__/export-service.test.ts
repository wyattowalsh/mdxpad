import { describe, it, expect } from 'vitest';

import { EXPORT_SUPPORT_MATRIX, getDefaultExportPath, serializeForExport } from '../export-service';

describe('EXPORT_SUPPORT_MATRIX', () => {
  it('marks html, markdown, mdx, pdf, and docx as supported', () => {
    const supportByFormat = new Map(
      EXPORT_SUPPORT_MATRIX.map((entry) => [entry.format, entry.supported])
    );

    expect(supportByFormat.get('html')).toBe(true);
    expect(supportByFormat.get('markdown')).toBe(true);
    expect(supportByFormat.get('mdx')).toBe(true);
    expect(supportByFormat.get('pdf')).toBe(true);
    expect(supportByFormat.get('docx')).toBe(true);
    expect(supportByFormat.get('epub')).toBe(true);
    expect(supportByFormat.get('latex')).toBe(true);
    expect(supportByFormat.get('pandoc')).toBe(true);
  });
});

describe('getDefaultExportPath', () => {
  it('uses source filename when available', () => {
    expect(getDefaultExportPath('/tmp/docs/spec.mdx', 'html')).toBe('/tmp/docs/spec.html');
  });

  it('falls back to untitled basename when source path is missing', () => {
    expect(getDefaultExportPath(null, 'markdown')).toBe('untitled.md');
  });
});

describe('serializeForExport', () => {
  it('returns explicit unsupported-format errors for pdf/docx', () => {
    const pdf = serializeForExport('# hello', 'pdf');
    const docx = serializeForExport('# hello', 'docx');

    expect(pdf.ok).toBe(false);
    expect(docx.ok).toBe(false);

    if (!pdf.ok) {
      expect(pdf.error.code).toBe('UNSUPPORTED_FORMAT');
      if (pdf.error.code === 'UNSUPPORTED_FORMAT') {
        expect(pdf.error.format).toBe('pdf');
      }
    }
    if (!docx.ok) {
      expect(docx.error.code).toBe('UNSUPPORTED_FORMAT');
      if (docx.error.code === 'UNSUPPORTED_FORMAT') {
        expect(docx.error.format).toBe('docx');
      }
    }
  });

  it('renders markdown instead of a source dump', () => {
    const result = serializeForExport('# Title\n\nHello **there**', 'html');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('<h1>Title</h1>');
      expect(result.content).toContain('<strong>there</strong>');
      expect(result.content).not.toContain('mdxpad-export-source');
    }
  });

  it('generates html export with mermaid rendering hook for mermaid fences', () => {
    const result = serializeForExport('```mermaid\ngraph TD\n  A-->B\n```', 'html');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain('class="mermaid"');
      expect(result.content).toContain('cdn.jsdelivr.net/npm/mermaid');
    }
  });
});
